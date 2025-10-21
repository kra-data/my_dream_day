// controllers/workShiftController.ts
import { RequestHandler, Response } from 'express';
import { prisma } from '../db/prisma';
import { z } from 'zod';
import { AuthRequiredRequest } from '../middlewares/requireUser';
// 최상단에 추가
import { toJSONSafe, asBigInt } from '../utils/serialize';


// ───────── KST ⇄ UTC 유틸 ─────────
const toKst = (d: Date) => new Date(d.getTime() + 9 * 60 * 60 * 1000);
const fromKstParts = (y: number, m1: number, d: number, hh = 0, mm = 0, ss = 0, ms = 0) =>
  new Date(Date.UTC(y, m1, d, hh - 9, mm, ss, ms));
const startOfKstDay = (base: Date) => {
  const k = toKst(base);
  return fromKstParts(k.getUTCFullYear(), k.getUTCMonth(), k.getUTCDate(), 0, 0, 0, 0);
};
const intersectMinutes = (a0: Date, a1: Date, b0: Date, b1: Date) => {
  const st = a0 > b0 ? a0 : b0;
  const en = a1 < b1 ? a1 : b1;
  if (en <= st) return 0;
  return diffMinutes(st, en);
};
const kstYesterdayRange = () => {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const start = startOfKstDay(yesterday);
  const end   = endOfKstDay(yesterday);
  return { start, end };
};
const OPEN_END = new Date('9999-12-31T23:59:59.999Z');

const endOrMax = (d: Date | null) => d ?? OPEN_END;
const endOfKstDay = (base: Date) => {
  const k = toKst(base);
  return fromKstParts(k.getUTCFullYear(), k.getUTCMonth(), k.getUTCDate(), 23, 59, 59, 999);
};
const parseBool = (v?: string) => v === '1' || v === 'true';
const parseHHMM = (s: string) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s);
  if (!m) return null;
  const hh = +m[1], mm = +m[2];
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return { hh, mm };
};
// 파일 상단 유틸 근처에 추가
const diffMin = (a: Date, b: Date) =>
  Math.max(0, Math.floor((b.getTime() - a.getTime()) / 60000));

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
  status: z.enum(['SCHEDULED','IN_PROGRESS','COMPLETED','CANCELED','REVIEW']).optional(),
});

const updateShiftSchema = z.object({
  startAt: z.string().datetime().optional(),
  endAt:   z.string().datetime().optional(),
  status:  z.enum(['SCHEDULED','IN_PROGRESS','COMPLETED','CANCELED','REVIEW']).optional(),
});
const resolveReviewSchema = z.object({
  // 필요한 보정값을 선택적으로 허용 (없으면 현행 유지)
  startAt: z.string().datetime(),
  endAt:   z.string().datetime(),
  memo: z.string().max(500).optional()
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
const overlapWhere = (employeeId: bigint, shopId: bigint, startAt: Date, endAt: Date, excludeId?: bigint) => ({
  employeeId,
  shopId,
  startAt: { lt: endAt },   // 기존시작 < 새끝
  endAt:   { gt: startAt }, // 기존끝 > 새시작
  ...(excludeId ? { NOT: { id: excludeId } } : {}),
});
const LATE_GRACE_MIN_FOR_PAYABLE = Number(process.env.LATE_GRACE_MIN_FOR_PAYABLE ?? '10'); // ≤10 지각 인정(정산 삭감 없음)
/* ───────────────── 직원 전용: 내 근무일정 생성 ───────────────── */
export const myCreateShift = async (req: AuthRequiredRequest, res: Response): Promise<void> => {
  const parsed = createShiftSchema.safeParse(req.body);

  if (!parsed.success) { res.status(400).json({ error: 'Invalid payload' }); return; }

  let startAt: Date, endAt: Date;
  try {
    ({ startAt, endAt } = resolveRangeKst(parsed.data));
  } catch (e: any) {
    res.status(400).json({ error: e?.message ?? 'Invalid time format' });
    return;
  }
  if (!(startAt < endAt)) { res.status(400).json({ error: 'endAt must be after startAt' }); return; }

  const employeeId = asBigInt(req.user.userId, 'employeeId');
  const shopId     = asBigInt(req.user.shopId, 'shopId');

  const exists = await prisma.workShift.findFirst({ where: overlapWhere(employeeId, shopId, startAt, endAt) });
  if (exists) { res.status(409).json({ error: '이미 겹치는 근무일정이 있습니다.' }); return; }

  const created = await prisma.workShift.create({
    data: { shopId, employeeId, startAt, endAt, status: 'SCHEDULED', createdByEmployeeId: employeeId ,    workedMinutes: diffMin(startAt, endAt),}
  });
  res.status(201).json(toJSONSafe(created));
};

/* ───────────────── 직원 전용: 내 근무일정 목록 ───────────────── */
export const myListShifts = async (req: AuthRequiredRequest, res: Response): Promise<void> => {
  const parsed = listQuerySchema.safeParse(req.query);

  if (!parsed.success) { res.status(400).json({ error: 'Invalid query' }); return; }
  const { from, to, status } = parsed.data;
  const employeeId = asBigInt(req.user.userId, 'employeeId');
  const shopId     = asBigInt(req.user.shopId, 'shopId');

  const where: any = { employeeId, shopId };
  if (status) where.status = status;
  if (from || to) {
    const AND: any[] = [];
    if (from) {
      AND.push({
        OR: [
          { endAt: null },                     // 진행 중(open-ended)도 포함
          { endAt: { gte: new Date(from) } }   // 종료가 범위 이후
        ]
      });
    }
    if (to) {
      AND.push({ startAt: { lte: new Date(to) } }); // 시작이 범위 이전(=교집합)
    }
    if (AND.length) where.AND = AND;
  }

  const rows = await prisma.workShift.findMany({ where, orderBy: { startAt: 'asc' } });
  res.json(toJSONSafe(rows));
};

/* ───────────────── 관리자/점주: 가게 내 모든 직원 일정 목록 ───────────────── */
export const adminListShifts = async (req: AuthRequiredRequest, res: Response): Promise<void> => {
    const shopId = asBigInt(req.params.shopId, 'shopId');
  if (asBigInt(req.user.shopId) !== shopId) { res.status(403).json({ error: '다른 가게는 조회할 수 없습니다.' }); return; }
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: 'Invalid query' }); return; }
  const { from, to, employeeId, status } = parsed.data;

  const where: any = { shopId };
  if (employeeId) where.employeeId = asBigInt(employeeId, 'employeeId');
  if (status)     where.status = status;
  if (from || to) {
    const AND: any[] = [];
    if (from) {
      AND.push({
        OR: [
          { endAt: null },                     // 진행 중(open-ended)도 포함
          { endAt: { gte: new Date(from) } }   // 종료가 범위(from) 이후
        ]
      });
    }
    if (to) {
      AND.push({ startAt: { lte: new Date(to) } }); // 시작이 범위(to) 이전 → 교집합 존재
    }
    if (AND.length) where.AND = AND;
  }
 const rows = await prisma.workShift.findMany({
    where,
    orderBy: [{ startAt: 'asc' }, { employeeId: 'asc' }],
    // ✅ 필요한 컬럼만 반환 (select 사용)
    select: {
      id: true,
      employeeId: true,
      startAt: true,
      endAt: true,
      status: true,
      finalPayAmount: true,
      workedMinutes:true,
      // 필요 시 아래 주석 해제
      // graceInMin: true,
      employee: {
        select: {
          name: true,
          position: true,
          section: true,
          pay: true,       // 금액 (시급/월급)
          payUnit: true,   // 'HOURLY' | 'MONTHLY'
          personalColor: true,
        }
      }
    }
  });

  res.json(toJSONSafe(rows));
};
/** (직원) 오늘 내 시프트 */
export const getMyTodayWorkshifts = async (req: AuthRequiredRequest, res: Response) => {

  const employeeId = asBigInt(req.user.userId, 'employeeId');
  const activeOnly = parseBool(req.query.activeOnly as string | undefined);
  const now = new Date();
  const start = startOfKstDay(now);
  const end   = endOfKstDay(now);

  const where: any = {
    employeeId,
    startAt: { lt: end },
    OR: [
      { endAt: null },         // 진행 중 시프트 포함
      { endAt: { gt: start } } // 오늘과 교집합이 있는 종료
    ],
  };
  if (activeOnly) where.status = { notIn: ['COMPLETED', 'CANCELED'] };

  const rows = await prisma.workShift.findMany({
    where,
    orderBy: { startAt: 'asc' },
  });

  res.json(toJSONSafe(rows));
};
const diffMinutes = (a: Date, b: Date) => Math.max(0, Math.floor((b.getTime() - a.getTime()) / 60000));
export const resolveReviewShiftScheduleOnly = async (req: AuthRequiredRequest, res: Response) => {
  const shopId  = asBigInt(req.params.shopId, 'shopId');
  const shiftId = asBigInt(req.params.shiftId, 'shiftId');
  if (asBigInt(req.user.shopId) !== shopId) { res.status(403).json({ error: '다른 가게는 관리할 수 없습니다.' }); return; }

  const parsed = resolveReviewSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid payload', detail: parsed.error.flatten() });
    return;
  }
  const { startAt, endAt,memo } = parsed.data;

  // REVIEW 상태의 시프트만 대상으로 함
  const shift = await prisma.workShift.findFirst({
    where: { id: shiftId, shopId, status: 'REVIEW' as any },
    include: { employee: { select: { pay: true, payUnit: true } } }
  });
  if (!shift) { res.status(404).json({ error: 'REVIEW 상태의 시프트를 찾을 수 없습니다.' }); return; }

  const nextStartAt = new Date(startAt);
  const nextEndAt   = new Date(endAt);
  if (!(nextStartAt < nextEndAt)) { res.status(400).json({ error: 'endAt은 startAt 이후여야 합니다.' }); return; }

  // 동일 직원의 다른 시프트와 겹침 방지
  const overlap = await prisma.workShift.findFirst({
    where: {
      shopId,
      employeeId: shift.employeeId,
      id: { not: shiftId },
      startAt: { lt: nextEndAt },
      endAt:   { gt: nextStartAt },
    },
    select: { id: true, startAt: true, endAt: true },
  });
  if (overlap) { res.status(409).json({ error: '다른 근무일정과 시간이 겹칩니다.', overlap }); return; }

  // actual은 건드리지 않음
  const nextActualInAt  = shift.actualInAt;
  const nextActualOutAt = shift.actualOutAt;

  // 상태 결정(실근무 기록 유무만으로)
  let nextStatus: any ='COMPLETED';

  // 분 계산
 const computedActualMinutes =
   (nextActualInAt && nextActualOutAt) ? diffMinutes(nextActualInAt, nextActualOutAt) : null;


  // ✅ REVIEW 해소 정책: 지각 유예 없이 "순수 교집합"으로 payable 산출
  const computedWorkedMinutes = diffMinutes(nextStartAt, nextEndAt);

  // 확정 급여(시급제 & COMPLETED & 근무분 존재 시)
  let nextFinalPayAmount: number | null = null;
  if (nextStatus === 'COMPLETED' && computedWorkedMinutes != null && shift.employee.payUnit === 'HOURLY') {
    nextFinalPayAmount = Math.round((computedWorkedMinutes / 60) * (shift.employee.pay ?? 0).toNumber());
  }

  const updated = await prisma.workShift.update({
    where: { id: shiftId },
    data: {
      // 스케줄만 보정
      startAt: nextStartAt,
      endAt: nextEndAt,
      // 리뷰 해소 이력
      reviewResolvedAt: new Date(),
      reviewedBy: req.user.userId,
      // 상태/산출치 갱신
      status: 'COMPLETED',
      workedMinutes: computedWorkedMinutes,
      finalPayAmount: nextFinalPayAmount,
      updatedByEmployeeId: req.user.userId,
      // reviewReason/memo 등은 변경하지 않음(원하면 여기서 유지/수정 가능)
    },
  });

  res.json({
    ok: true,
    shift: updated,
    summary: {
             status: nextStatus,
      workedMinutes: computedWorkedMinutes,
      finalPayAmount: nextFinalPayAmount,
    }
  });
};
/* ───────────────── 관리자/점주: 특정 직원 일정 생성 ───────────────── */
 export const adminCreateShift = async (req: AuthRequiredRequest, res: Response): Promise<void> => {
  const shopId     = asBigInt(req.params.shopId, 'shopId');
  const employeeId = asBigInt(req.params.employeeId, 'employeeId');
  if (asBigInt(req.user.shopId) !== shopId) { res.status(403).json({ error: '다른 가게는 관리할 수 없습니다.' }); return; }

  const emp = await prisma.employeeMember.findFirst({ where: { id: employeeId, shopId }, select: { id: true } });
  if (!emp) { res.status(404).json({ error: '직원이 존재하지 않거나 다른 가게 소속입니다.' }); return; }

  const parsed = createShiftSchema.safeParse(req.body);
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
    data: { shopId, employeeId, startAt, endAt, status: 'SCHEDULED', createdByUserId: req.user.userId,    workedMinutes: diffMin(startAt, endAt), }
  });
  res.status(201).json(toJSONSafe(created));
};
const reviewListQuery = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  employeeId: z.coerce.number().int().positive().optional(),
  cursor: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  unresolvedOnly: z
    .union([z.literal('1'), z.literal('0'), z.literal('true'), z.literal('false')])
    .optional()
});

export const adminListReviewShifts = async (req: AuthRequiredRequest, res: Response): Promise<void> => {
const shopId = asBigInt(req.params.shopId, 'shopId');
  if (asBigInt(req.user.shopId) !== shopId) { res.status(403).json({ error: '다른 가게는 조회할 수 없습니다.' }); return; }


  const parsed = reviewListQuery.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid query', detail: parsed.error.flatten() });
    return;
  }
  const { from, to, employeeId, cursor, limit, unresolvedOnly } = parsed.data;

  const where: any = {
    shopId,
    status: 'REVIEW',
    ...(employeeId ? { employeeId } : {}),
    ...(from || to
      ? { startAt: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) } }
      : {}),
  };

  // 기본은 미해결만 노출(needsReview=true). unresolvedOnly=0/false면 전체 REVIEW 노출
  const unresolved =
    unresolvedOnly === undefined ? true :
    (unresolvedOnly === '1' || unresolvedOnly === 'true');
if (unresolved) where.reviewResolvedAt = null;

  const rows = await prisma.workShift.findMany({
    where,
    include: {
      employee: { select: { name: true, position: true, section: true,personalColor: true, } }
    },
    orderBy: [{ id: 'desc' }],
     ...(cursor ? { cursor: { id: asBigInt(cursor, 'cursor') }, skip: 1 } : {}),
    take: limit,
  });

  const items = rows.map(r => ({
    id: r.id,
    shopId: r.shopId,
    employeeId: r.employeeId,
    startAt: r.startAt,
    endAt: r.endAt,
    status: r.status,              // 'REVIEW'
    reviewReason: r.reviewReason,  // 'LATE_IN' | 'EARLY_OUT' | 'LATE_OUT' | 'EXTENDED' | 'EARLY_IN'
    memo: r.memo ?? null,
    reviewResolvedAt: r.reviewResolvedAt ?? null,
    actualInAt: r.actualInAt ?? null,
    actualOutAt: r.actualOutAt ?? null,
    late: r.late ?? null,
    earlyOut: r.earlyOut ?? null,
    workedMinutes: r.workedMinutes ?? null,
    employee: {
      name: r.employee.name,
      position: r.employee.position,
      section: r.employee.section,
      personalColor: r.employee.personalColor,
    }
  }));

  res.json(toJSONSafe({
    items,
    nextCursor: rows.length === (limit ?? 20) ? rows[rows.length - 1].id : null
  }));
};
/* ───────────────── 관리자/점주: 일정 수정 ───────────────── */
 export const adminUpdateShift = async (req: AuthRequiredRequest, res: Response): Promise<void> => {
  const shopId  = asBigInt(req.params.shopId, 'shopId');
  const shiftId = asBigInt(req.params.shiftId, 'shiftId');
  if (asBigInt(req.user.shopId) !== shopId) { res.status(403).json({ error: '다른 가게는 관리할 수 없습니다.' }); return; }

  const parsed = updateShiftSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Invalid payload' }); return; }
  const { startAt, endAt, status } = parsed.data;

  const shift = await prisma.workShift.findUnique({
    where: { id: shiftId },
    include: { employee: { select: { pay: true, payUnit: true } } }
  });
  if (!shift || shift.shopId !== shopId) { res.status(404).json({ error: '일정을 찾을 수 없습니다.' }); return; }

  const nextStart = startAt ? new Date(startAt) : shift.startAt;
  const nextEnd   = endAt   ? new Date(endAt)   : shift.endAt;
  if (nextEnd && !(nextStart < nextEnd)) {
    res.status(400).json({ error: 'endAt must be after startAt' });
    return;
  }

  const overlap = await prisma.workShift.findFirst({
     where: overlapWhere(shift.employeeId, shopId, nextStart, endOrMax(nextEnd), shiftId)
  });
  if (overlap) { res.status(409).json({ error: '이미 겹치는 근무일정이 있습니다.' }); return; }

  // 다음 상태 결정(넘겨주면 반영, 없으면 기존 유지)
  const nextStatus = status ?? shift.status;

  // ✅ 실제 기록이 있는 경우에만 payable(교집합) 재산출
  let nextWorkedMinutes: number | null = shift.workedMinutes ?? null;
  if (startAt || endAt) {
nextWorkedMinutes = nextEnd ? diffMin(nextStart, nextEnd) : null;
  }

  // ✅ finalPayAmount: COMPLETED이고 HOURLY이며 workedMinutes가 있을 때만 산출
  let nextFinalPayAmount: number | null = shift.finalPayAmount ?? null;
  if (nextStatus === 'COMPLETED' && shift.employee?.payUnit === 'HOURLY') {
    const mins = (startAt || endAt) ? (nextWorkedMinutes ?? 0) : (shift.workedMinutes ?? 0);
    nextFinalPayAmount = Math.round((mins / 60) * (shift.employee?.pay ?? 0).toNumber());
  } else if (nextStatus !== 'COMPLETED') {
    // 완료가 아니면 금액은 들고 있을 이유가 없음 → 초기화
    nextFinalPayAmount = null;
  }


  const updated = await prisma.workShift.update({
    where: { id: shiftId },
    data: {
      startAt: startAt ? nextStart : undefined,
      endAt:   endAt   ? nextEnd   : undefined,
      status:  status  ?? undefined,
      updatedByEmployeeId: req.user.userId,
      // 스케줄이 바뀌었을 때만 스케줄 분(=workedMinutes) 갱신
      workedMinutes: (startAt || endAt) ? nextWorkedMinutes : undefined,
      finalPayAmount: nextFinalPayAmount
    },
    select: {
      id: true, shopId: true, employeeId: true,
      startAt: true, endAt: true, status: true,
      workedMinutes: true, finalPayAmount: true,
      updatedAt: true
    }
  });
  res.json(toJSONSafe(updated));
};

/* ───────────────── 관리자/점주: 일정 삭제 ───────────────── */
 export const adminDeleteShift = async (req: AuthRequiredRequest, res: Response): Promise<void> => {
  const shopId  = asBigInt(req.params.shopId, 'shopId');
  const shiftId = asBigInt(req.params.shiftId, 'shiftId');
  if (asBigInt(req.user.shopId) !== shopId) { res.status(403).json({ error: '다른 가게는 관리할 수 없습니다.' }); return; }

  const shift = await prisma.workShift.findUnique({ where: { id: shiftId } });
  if (!shift || shift.shopId !== shopId) { res.status(404).json({ error: '일정을 찾을 수 없습니다.' }); return; }

  await prisma.workShift.delete({ where: { id: shiftId } });
  res.status(204).send();
};
/* ───────────────── 관리자/점주: 일정 상세 조회 ───────────────── */
export const adminGetShiftDetail = async (req: AuthRequiredRequest, res: Response): Promise<void> => {
const shopId  = asBigInt(req.params.shopId, 'shopId');
  const shiftId = asBigInt(req.params.shiftId, 'shiftId');
  if (asBigInt(req.user.shopId) !== shopId) { res.status(403).json({ error: '다른 가게는 조회할 수 없습니다.' }); return; }

  const shift = await prisma.workShift.findFirst({
    where: { id: shiftId, shopId },
    include: {
      employee: {
        select: {
          id: true,
          name: true,
          position: true,
          section: true,
          pay: true,
          payUnit: true,
          personalColor: true,
        }
      }
    }
  });

  if (!shift) {
    res.status(404).json({ error: '일정을 찾을 수 없습니다.' });
    return;
  }

  // 참고용 요약(분 계산)
  const plannedMinutes =
shift.endAt
      ? Math.max(0, Math.floor((shift.endAt.getTime() - shift.startAt.getTime()) / 60000))
      : null;

  res.json(toJSONSafe({
    ok: true,
    shift,
    summary: {
      plannedMinutes,
      workedMinutes: shift.workedMinutes ?? null,
      late: shift.late ?? null,
      earlyOut: shift.earlyOut ?? null,
      status: shift.status
    }
  }));
};

// ───────────────── 직원 전용: 내 근무일정 수정(항상 REVIEW로)
const myUpdateShiftSchema = z.object({
  startAt: z.string().datetime().optional(),
  endAt:   z.string().datetime().optional(),
  memo: z.string().max(500).optional(),
}).refine(v => !!v.startAt || !!v.endAt || !!v.memo, {
  message: 'startAt / endAt / memo 중 최소 1개는 필요합니다.'
});

export const myUpdateShift = async (req: AuthRequiredRequest, res: Response): Promise<void> => {
  const shiftId = asBigInt(req.params.shiftId, 'shiftId');

  const parsed = myUpdateShiftSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid payload', detail: parsed.error.flatten() });
    return;
  }
  const { startAt, endAt, memo } = parsed.data;
  const employeeId  = asBigInt(req.params.shopId, 'employeeId');
  const shopId = asBigInt(req.params.shiftId, 'shopId');

  const shift = await prisma.workShift.findFirst({ where: { id: shiftId, shopId, employeeId } });
  if (!shift) { res.status(404).json({ error: '내 근무일정이 아니거나 존재하지 않습니다.' }); return; }

  // 완료/취소된 일정은 직원이 수정 불가 (정책에 맞게 조정 가능)
  if (shift.status === 'COMPLETED' || shift.status === 'CANCELED' || shift.status === 'REVIEW' ) {
    res.status(409).json({ error: '완료되었거나 취소, 관리자 검토가 필요한 일정은 수정할 수 없습니다.' });
    return;
  }

  const nextStart = startAt ? new Date(startAt) : shift.startAt;
  const nextEnd   = endAt   ? new Date(endAt)   : shift.endAt;
  if (nextEnd && !(nextStart < nextEnd)) {
    res.status(400).json({ error: 'endAt은 startAt 이후여야 합니다.' });
    return;
  }

  // 동일 직원/매장 내 겹침 방지
  const overlap = await prisma.workShift.findFirst({
   where: overlapWhere(employeeId, shopId, nextStart, endOrMax(nextEnd), shiftId),
    select: { id: true }
  });
  if (overlap) {
    res.status(409).json({ error: '다른 근무일정과 시간이 겹칩니다.', overlapId: overlap.id });
    return;
  }

  const updated = await prisma.workShift.update({
    where: { id: shiftId },
    data: {
      startAt: startAt ? nextStart : undefined,
      endAt:   endAt   ? nextEnd   : undefined,
      // ✅ 직원 수정 시 항상 리뷰 필요
      status: 'REVIEW',
      memo: memo ?? shift.memo,
      reviewResolvedAt: null,
      updatedByEmployeeId: employeeId,
      ...(startAt || endAt ? { workedMinutes: nextEnd ? diffMin(nextStart, nextEnd) : null } : {}),
    },
    select: {
      id: true, shopId: true, employeeId: true,
      startAt: true, endAt: true, status: true,
      reviewReason: true, memo: true,
      updatedAt: true, workedMinutes: true
    }
  });

  res.json(toJSONSafe({ ok: true, shift: updated }));
};
/* ───────────────── 관리자/점주: (어제) 미체크 & 완료된 근무일정 목록 ───────────────── */
export const adminListUncheckedCompletedShiftsYesterday = async (req: AuthRequiredRequest, res: Response) => {
  const shopId = Number(req.params.shopId);
  if (req.user.shopId !== shopId) { res.status(403).json({ error: '다른 가게는 조회할 수 없습니다.' }); return; }

  const { start, end } = kstYesterdayRange();

  const rows = await prisma.workShift.findMany({
    where: {
      shopId,
      status: 'COMPLETED',
      adminChecked: false,          // ✅ 아직 체크 안 된 것만
      startAt: { lt: end },         // 어제와 교집합
      endAt:   { gt: start },
    },
    orderBy: [{ startAt: 'asc' }, { employeeId: 'asc' }],
    select: {
      id: true, employeeId: true, startAt: true, endAt: true,
      workedMinutes: true, finalPayAmount: true, status: true, adminChecked: true,
      employee: {
        select: { name: true, position: true, section: true, personalColor: true, pay: true, payUnit: true }
      }
    }
  });

  res.json({
    ok: true,
    range: { start, end },
    items: rows
  });
};

/* ───────────────── 관리자/점주: 근무일정 체크 처리 ───────────────── */
export const adminSetShiftChecked = async (req: AuthRequiredRequest, res: Response) => {
  const shopId  = asBigInt(req.params.shopId, 'shopId');
  const shiftId = asBigInt(req.params.shiftId, 'shiftId');
  if (asBigInt(req.user.shopId) !== shopId) { res.status(403).json({ error: '다른 가게는 관리할 수 없습니다.' }); return; }

  const shift = await prisma.workShift.findUnique({ where: { id: shiftId } });
  if (!shift || shift.shopId !== shopId) { res.status(404).json({ error: '일정을 찾을 수 없습니다.' }); return; }

  const updated = await prisma.workShift.update({
    where: { id: shiftId },
    data: { adminChecked: true }, // ✅ 체크 처리
    select: {
      id: true, shopId: true, employeeId: true, startAt: true, endAt: true,
      status: true, adminChecked: true, updatedAt: true
    }
  });

  res.json(toJSONSafe({ ok: true, shift: updated }));
};

export const myDeleteShift = async (req: AuthRequiredRequest, res: Response): Promise<void> => {
  const shiftId = asBigInt(req.params.shiftId, 'shiftId');
  const employeeId = asBigInt(req.user.userId, 'employeeId');
  const shopId     = asBigInt(req.user.shopId, 'shopId');
  if (!Number.isFinite(shiftId)) {
    res.status(400).json({ error: 'shiftId must be a number' });
    return;
  }
  const shift = await prisma.workShift.findFirst({
    where: { id: shiftId, shopId, employeeId },
    select: {
      id: true, status: true,
      actualInAt: true, actualOutAt: true,
      settlementId: true
    }
  });
  if (!shift) {
    res.status(404).json({ error: '내 근무일정이 아니거나 존재하지 않습니다.' });
    return;
  }

  // 이미 시작/완료/취소된 일정은 삭제 불가
  if (shift.actualInAt || shift.actualOutAt ||
      shift.status === 'IN_PROGRESS' ||
      shift.status === 'COMPLETED' ||
      shift.status === 'CANCELED') {
    res.status(409).json({ error: '이미 시작되었거나 완료/취소된 일정은 삭제할 수 없습니다.' });
    return;
  }

  // 정산 연결된 일정은 삭제 불가
  if (shift.settlementId) {
    res.status(409).json({ error: '정산에 연결된 일정은 삭제할 수 없습니다.' });
    return;
  }

  await prisma.workShift.delete({ where: { id: shiftId } });
  res.status(204).send();
};