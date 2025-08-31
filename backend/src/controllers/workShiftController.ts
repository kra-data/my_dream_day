// controllers/workShiftController.ts
import { RequestHandler, Response } from 'express';
import { prisma } from '../db/prisma';
import { z } from 'zod';
import { AuthRequiredRequest } from '../middlewares/requireUser';

// ───────── KST ⇄ UTC 유틸 ─────────
const toKst = (d: Date) => new Date(d.getTime() + 9 * 60 * 60 * 1000);
const fromKstParts = (y: number, m1: number, d: number, hh = 0, mm = 0) =>
  new Date(Date.UTC(y, m1, d, hh - 9, mm, 0, 0));
const parseHHMM = (s: string) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s);
  if (!m) return null;
  const hh = +m[1], mm = +m[2];
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return { hh, mm };
};

// ───────── Zod 스키마 (두 가지 입력 방식 지원) ─────────
const byIso = z.object({
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
});
const byLocal = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  start: z.string(), // 'HH:MM'
  end: z.string(),   // 'HH:MM'
});
const createShiftSchema = z.union([byIso, byLocal]);

const listQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to:   z.string().datetime().optional(),
  employeeId: z.coerce.number().int().positive().optional(), // admin 전용
  status: z.enum(['SCHEDULED','COMPLETED','CANCELED']).optional(),
});

const updateShiftSchema = z.object({
  startAt: z.string().datetime().optional(),
  endAt:   z.string().datetime().optional(),
  status:  z.enum(['SCHEDULED','COMPLETED','CANCELED']).optional(),
});

// ───────── 공통 파서 ─────────
function resolveRangeKst(body: z.infer<typeof createShiftSchema>) {
  if ('startAt' in body) {
    const startAt = new Date(body.startAt);
    const endAt = new Date(body.endAt);
    return { startAt, endAt };
  } else {
    const [y, m, d] = body.date.split('-').map(Number);
    const st = parseHHMM(body.start);
    const ed = parseHHMM(body.end);
    if (!st || !ed) throw new Error('HH:MM 형식이 올바르지 않습니다.');
    const startAt = fromKstParts(y, m - 1, d, st.hh, st.mm);
    const endAt   = fromKstParts(y, m - 1, d, ed.hh, ed.mm);
    return { startAt, endAt };
  }
}

// ───────── 중복(겹침) 검사 where ─────────
const overlapWhere = (employeeId: number, shopId: number, startAt: Date, endAt: Date, excludeId?: number) => ({
  employeeId,
  shopId,
  startAt: { lt: endAt },   // 기존시작 < 새끝
  endAt:   { gt: startAt }, // 기존끝 > 새시작
  ...(excludeId ? { NOT: { id: excludeId } } : {}),
});

/* ───────────────── 직원 전용: 내 근무일정 생성 ───────────────── */
export const myCreateShift: RequestHandler = async (req, res) => {
  const auth = req as AuthRequiredRequest;

  const parsed = createShiftSchema.safeParse(auth.body);
  if (!parsed.success) { res.status(400).json({ error: 'Invalid payload' }); return; }

  let startAt: Date, endAt: Date;
  try {
    ({ startAt, endAt } = resolveRangeKst(parsed.data));
  } catch (e: any) {
    res.status(400).json({ error: e?.message ?? 'Invalid time format' });
    return;
  }
  if (!(startAt < endAt)) { res.status(400).json({ error: 'endAt must be after startAt' }); return; }

  const employeeId = auth.user.userId;
  const shopId     = auth.user.shopId;

  const exists = await prisma.workShift.findFirst({ where: overlapWhere(employeeId, shopId, startAt, endAt) });
  if (exists) { res.status(409).json({ error: '이미 겹치는 근무일정이 있습니다.' }); return; }

  const created = await prisma.workShift.create({
    data: { shopId, employeeId, startAt, endAt, status: 'SCHEDULED', createdBy: employeeId }
  });
  res.status(201).json(created);
};

/* ───────────────── 직원 전용: 내 근무일정 목록 ───────────────── */
export const myListShifts: RequestHandler = async (req, res) => {
  const auth = req as AuthRequiredRequest;

  const parsed = listQuerySchema.safeParse(auth.query);
  if (!parsed.success) { res.status(400).json({ error: 'Invalid query' }); return; }
  const { from, to, status } = parsed.data;

  const employeeId = auth.user.userId;
  const shopId     = auth.user.shopId;

  const where: any = { employeeId, shopId };
  if (status) where.status = status;
  if (from || to) {
    if (from) where.endAt   = { ...(where.endAt ?? {}),   gte: new Date(from) };
    if (to)   where.startAt = { ...(where.startAt ?? {}), lte: new Date(to)   };
  }

  const rows = await prisma.workShift.findMany({ where, orderBy: { startAt: 'asc' } });
  res.json(rows);
};

/* ───────────────── 관리자/점주: 가게 내 모든 직원 일정 목록 ───────────────── */
export const adminListShifts: RequestHandler = async (req, res) => {
  const auth = req as AuthRequiredRequest;
  const shopId = Number(auth.params.shopId);
  if (auth.user.shopId !== shopId) { res.status(403).json({ error: '다른 가게는 조회할 수 없습니다.' }); return; }

  const parsed = listQuerySchema.safeParse(auth.query);
  if (!parsed.success) { res.status(400).json({ error: 'Invalid query' }); return; }
  const { from, to, employeeId, status } = parsed.data;

  const where: any = { shopId };
  if (employeeId) where.employeeId = employeeId;
  if (status)     where.status = status;
  if (from || to) {
    if (from) where.endAt   = { ...(where.endAt ?? {}),   gte: new Date(from) };
    if (to)   where.startAt = { ...(where.startAt ?? {}), lte: new Date(to)   };
  }

  const rows = await prisma.workShift.findMany({
    where,
    orderBy: [{ startAt: 'asc' }, { employeeId: 'asc' }],
    include: { employee: { select: { name: true, position: true, section: true } } }
  });
  res.json(rows);
};

/* ───────────────── 관리자/점주: 특정 직원 일정 생성 ───────────────── */
export const adminCreateShift: RequestHandler = async (req, res) => {
  const auth = req as AuthRequiredRequest;
  const shopId     = Number(auth.params.shopId);
  const employeeId = Number(auth.params.employeeId);
  if (auth.user.shopId !== shopId) { res.status(403).json({ error: '다른 가게는 관리할 수 없습니다.' }); return; }

  const emp = await prisma.employee.findFirst({ where: { id: employeeId, shopId }, select: { id: true } });
  if (!emp) { res.status(404).json({ error: '직원이 존재하지 않거나 다른 가게 소속입니다.' }); return; }

  const parsed = createShiftSchema.safeParse(auth.body);
  if (!parsed.success) { res.status(400).json({ error: 'Invalid payload' }); return; }

  let startAt: Date, endAt: Date;
  try {
    ({ startAt, endAt } = resolveRangeKst(parsed.data));
  } catch (e: any) {
    res.status(400).json({ error: e?.message ?? 'Invalid time format' });
    return;
  }
  if (!(startAt < endAt)) { res.status(400).json({ error: 'endAt must be after startAt' }); return; }

  const exists = await prisma.workShift.findFirst({ where: overlapWhere(employeeId, shopId, startAt, endAt) });
  if (exists) { res.status(409).json({ error: '이미 겹치는 근무일정이 있습니다.' }); return; }

  const created = await prisma.workShift.create({
    data: { shopId, employeeId, startAt, endAt, status: 'SCHEDULED', createdBy: auth.user.userId }
  });
  res.status(201).json(created);
};

/* ───────────────── 관리자/점주: 일정 수정 ───────────────── */
export const adminUpdateShift: RequestHandler = async (req, res) => {
  const auth = req as AuthRequiredRequest;
  const shopId  = Number(auth.params.shopId);
  const shiftId = Number(auth.params.shiftId);
  if (auth.user.shopId !== shopId) { res.status(403).json({ error: '다른 가게는 관리할 수 없습니다.' }); return; }

  const parsed = updateShiftSchema.safeParse(auth.body);
  if (!parsed.success) { res.status(400).json({ error: 'Invalid payload' }); return; }
  const { startAt, endAt, status } = parsed.data;

  const shift = await prisma.workShift.findUnique({ where: { id: shiftId } });
  if (!shift || shift.shopId !== shopId) { res.status(404).json({ error: '일정을 찾을 수 없습니다.' }); return; }

  const nextStart = startAt ? new Date(startAt) : shift.startAt;
  const nextEnd   = endAt   ? new Date(endAt)   : shift.endAt;
  if (!(nextStart < nextEnd)) { res.status(400).json({ error: 'endAt must be after startAt' }); return; }

  const overlap = await prisma.workShift.findFirst({
    where: overlapWhere(shift.employeeId, shopId, nextStart, nextEnd, shiftId)
  });
  if (overlap) { res.status(409).json({ error: '이미 겹치는 근무일정이 있습니다.' }); return; }

  const updated = await prisma.workShift.update({
    where: { id: shiftId },
    data: {
      startAt: startAt ? new Date(startAt) : undefined,
      endAt:   endAt   ? new Date(endAt)   : undefined,
      status:  status  ?? undefined,
      updatedBy: auth.user.userId,
    }
  });
  res.json(updated);
};

/* ───────────────── 관리자/점주: 일정 삭제 ───────────────── */
export const adminDeleteShift: RequestHandler = async (req, res) => {
  const auth = req as AuthRequiredRequest;
  const shopId  = Number(auth.params.shopId);
  const shiftId = Number(auth.params.shiftId);
  if (auth.user.shopId !== shopId) { res.status(403).json({ error: '다른 가게는 관리할 수 없습니다.' }); return; }

  const shift = await prisma.workShift.findUnique({ where: { id: shiftId } });
  if (!shift || shift.shopId !== shopId) { res.status(404).json({ error: '일정을 찾을 수 없습니다.' }); return; }

  await prisma.workShift.delete({ where: { id: shiftId } });
  res.status(204).send();
};
