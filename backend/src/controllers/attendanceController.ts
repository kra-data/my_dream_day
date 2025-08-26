import { Response } from 'express';
import { prisma } from '../db/prisma';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { AuthRequiredRequest } from '../middlewares/requireUser';

/* ───────── 공통 유틸 ───────── */

const toEndOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
};

const diffMinutes = (a: Date, b: Date) => Math.max(0, Math.floor((b.getTime() - a.getTime()) / 60000));

const calcExtraMinutes = (worked: number) => (worked > 480 ? Math.floor((worked - 480) / 30) * 30 : 0);

/* ───────── Zod 스키마 ───────── */

const dateStr = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD 형식이어야 합니다.');

const myAttendanceQuerySchema = z.object({
  start: dateStr.optional(),
  end: dateStr.optional(),
  cursor: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(50).optional().default(10),
});

const adminListQuerySchema = z.object({
  start: dateStr.optional(),
  end: dateStr.optional(),
  employeeId: z.coerce.number().int().positive().optional(),
  cursor: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(50).optional().default(10),
});

const adminCreateOrCloseAttendanceSchema = z
  .object({
    clockInAt: z.string().datetime().optional(),
    clockOutAt: z.string().datetime().optional(),
  })
  .refine((v) => !!v.clockInAt || !!v.clockOutAt, {
    message: 'clockInAt 또는 clockOutAt 중 하나는 필요합니다.',
  });

const adminUpdateAttendanceSchema = z
  .object({
    clockInAt: z.string().datetime().optional(),
    clockOutAt: z.string().datetime().optional(),
  })
  .refine((v) => !!v.clockInAt || !!v.clockOutAt, {
    message: '변경할 필드를 제공하세요.',
  });

const recordAttendanceSchema = z.object({
  shopId: z.coerce.number().int().positive(),
  type: z.enum(['IN', 'OUT']),
});

/* ───────── 컨트롤러들 ───────── */

/**
 * GET /api/attendance/me
 *   ?start=YYYY-MM-DD&end=YYYY-MM-DD&cursor=number&limit=number
 * ▸ 로그인한 직원이 자신의 출‧퇴근 기록을 조회 (커서 기반)
 */
export const getMyAttendance = async (
  req: AuthRequiredRequest,
  res: Response
): Promise<void> => {
  const parsed = myAttendanceQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid query' });
    return;
  }
  const { start, end, cursor, limit } = parsed.data;

  const employeeId = req.user.userId;
  const pageSize = limit;

  const where: Prisma.AttendanceRecordWhereInput = {
    employeeId,
    paired: true,
  };

  if (start || end) {
    where.clockInAt = {};
    if (start) where.clockInAt.gte = new Date(start);
    if (end) where.clockInAt.lte = toEndOfDay(new Date(end));
  }

  if (cursor) {
    where.id = { lt: cursor };
  }

  const logs = await prisma.attendanceRecord.findMany({
    where,
    orderBy: [{ clockInAt: 'desc' }, { id: 'desc' }],
    take: pageSize,
  });

  const worked = logs.reduce((s, l) => s + (l.workedMinutes ?? 0), 0);
  const extras = logs.reduce((s, l) => s + (l.extraMinutes ?? 0), 0);

  const nextCursor = logs.length === pageSize ? logs[logs.length - 1].id : null;

  res.json({
    employeeId,
    totalWorkedMinutes: worked,
    totalExtraMinutes: extras,
    records: logs.map((l) => ({
      id: l.id,
      date: l.clockInAt ? l.clockInAt.toISOString().slice(0, 10) : null,
      clockInAt: l.clockInAt,
      clockOutAt: l.clockOutAt,
      workedMinutes: l.workedMinutes,
      extraMinutes: l.extraMinutes,
    })),
    nextCursor,
  });
};

/**
 * GET /api/attendance/admin/shops/:shopId/attendance
 *   ?start=YYYY-MM-DD&end=YYYY-MM-DD&employeeId=number&cursor=number&limit=number
 * ▸ 관리자가 가게의 출퇴근 기록 조회 (커서 기반)
 *  - 라우터에서 already: authenticateJWT → requireUser → requireRoles('admin','owner')
 */
export const getAttendanceRecords = async (
  req: AuthRequiredRequest,
  res: Response
): Promise<void> => {
  const shopId = Number(req.params.shopId);
  // 소속 가게인지 확인 (역할 가드는 라우트에서 처리)
  if (req.user.shopId !== shopId) {
    res.status(403).json({ error: '다른 가게는 조회할 수 없습니다.' });
    return;
  }

  const parsed = adminListQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid query' });
    return;
  }
  const { start, end, employeeId, cursor, limit } = parsed.data;
  const pageSize = limit;

  const where: Prisma.AttendanceRecordWhereInput = { shopId };

  if (employeeId) where.employeeId = employeeId;
  if (start || end) {
    where.clockInAt = {};
    if (start) where.clockInAt.gte = new Date(start);
    if (end) where.clockInAt.lte = toEndOfDay(new Date(end));
  }
  if (cursor) {
    where.id = { lt: cursor };
  }

  const records = await prisma.attendanceRecord.findMany({
    where,
    orderBy: [{ clockInAt: 'desc' }, { id: 'desc' }],
    take: pageSize,
    include: {
      employee: { select: { name: true, position: true, section: true } },
    },
  });

  const nextCursor = records.length === pageSize ? records[records.length - 1].id : null;

  res.json({ records, nextCursor });
};

/**
 * POST /api/attendance/admin/shops/:shopId/attendance/employees/:employeeId
 * body: { clockInAt?: string(ISO), clockOutAt?: string(ISO) }
 * ▸ 관리자가 임의 시각으로 출근/퇴근을 생성하거나, 열린(IN) 기록에 퇴근을 입력
 *  - 라우터에서 already: authenticateJWT → requireUser → requireRoles('admin','owner')
 */
export const adminCreateOrCloseAttendance = async (
  req: AuthRequiredRequest,
  res: Response
): Promise<void> => {
  const shopId = Number(req.params.shopId);
  const employeeId = Number(req.params.employeeId);

  if (req.user.shopId !== shopId) {
    res.status(403).json({ error: '다른 가게는 관리할 수 없습니다.' });
    return;
  }

  const parsed = adminCreateOrCloseAttendanceSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid payload' });
    return;
  }
  const { clockInAt, clockOutAt } = parsed.data;

  const emp = await prisma.employee.findFirst({ where: { id: employeeId, shopId } });
  if (!emp) {
    res.status(404).json({ error: '직원이 존재하지 않거나 다른 가게 소속입니다.' });
    return;
  }

  const inAt = clockInAt ? new Date(clockInAt) : undefined;
  const outAt = clockOutAt ? new Date(clockOutAt) : undefined;

  if (inAt && outAt && outAt <= inAt) {
    res.status(400).json({ error: 'clockOutAt은 clockInAt보다 이후여야 합니다.' });
    return;
  }

  // 둘 다 제공 → 완전한 하루 기록 생성
  if (inAt && outAt) {
    const workedMinutes = diffMinutes(inAt, outAt);
    const extraMinutes = calcExtraMinutes(workedMinutes);
    const rec = await prisma.attendanceRecord.create({
      data: {
        shopId,
        employeeId,
        type: 'OUT',
        clockInAt: inAt,
        clockOutAt: outAt,
        workedMinutes,
        extraMinutes,
        paired: true,
      },
    });
    res.status(201).json(rec);
    return;
  }

  // clockInAt만 제공 → 열린(IN) 기록 생성
  if (inAt && !outAt) {
    const open = await prisma.attendanceRecord.findFirst({
      where: { employeeId, paired: false },
    });
    if (open) {
      res.status(400).json({ error: '이미 열린 출근 기록이 있습니다.' });
      return;
    }
    const rec = await prisma.attendanceRecord.create({
      data: { shopId, employeeId, type: 'IN', clockInAt: inAt, paired: false },
    });
    res.status(201).json(rec);
    return;
  }

  // clockOutAt만 제공 → 가장 최근 열린(IN) 기록에 퇴근 입력
  if (!inAt && outAt) {
    const open = await prisma.attendanceRecord.findFirst({
      where: { employeeId, paired: false },
      orderBy: { clockInAt: 'desc' },
    });
    if (!open || !open.clockInAt) {
      res.status(400).json({ error: '열린 출근 기록이 없습니다.' });
      return;
    }
    if (outAt <= open.clockInAt) {
      res.status(400).json({ error: '퇴근 시각이 출근 시각보다 빠릅니다.' });
      return;
    }
    const workedMinutes = diffMinutes(open.clockInAt, outAt);
    const extraMinutes = calcExtraMinutes(workedMinutes);
    const rec = await prisma.attendanceRecord.update({
      where: { id: open.id },
      data: {
        type: 'OUT',
        clockOutAt: outAt,
        workedMinutes,
        extraMinutes,
        paired: true,
      },
    });
    res.json(rec);
    return;
  }
};

/**
 * PUT /api/attendance/admin/shops/:shopId/attendance/records/:id
 * body: { clockInAt?: string(ISO), clockOutAt?: string(ISO) }
 * ▸ 기존 기록의 시각 수정 및 근무시간 재계산
 *  - 라우터에서 already: authenticateJWT → requireUser → requireRoles('admin','owner')
 */
export const adminUpdateAttendance = async (
  req: AuthRequiredRequest,
  res: Response
): Promise<void> => {
  const shopId = Number(req.params.shopId);
  const id = Number(req.params.id);

  if (req.user.shopId !== shopId) {
    res.status(403).json({ error: '다른 가게는 관리할 수 없습니다.' });
    return;
  }

  const parsed = adminUpdateAttendanceSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid payload' });
    return;
  }
  const { clockInAt, clockOutAt } = parsed.data;

  const rec = await prisma.attendanceRecord.findUnique({ where: { id } });
  if (!rec || rec.shopId !== shopId) {
    res.status(404).json({ error: '기록을 찾을 수 없습니다.' });
    return;
  }

  const nextIn = clockInAt ? new Date(clockInAt) : rec.clockInAt ?? undefined;
  const nextOut = clockOutAt ? new Date(clockOutAt) : rec.clockOutAt ?? undefined;

  if (nextIn && nextOut && nextOut <= nextIn) {
    res.status(400).json({ error: 'clockOutAt은 clockInAt보다 이후여야 합니다.' });
    return;
  }

  let workedMinutes: number | null = rec.workedMinutes ?? null;
  let extraMinutes: number | null = rec.extraMinutes ?? null;
  let paired = rec.paired;
  let type = rec.type;

  if (nextIn && nextOut) {
    workedMinutes = diffMinutes(nextIn, nextOut);
    extraMinutes = calcExtraMinutes(workedMinutes);
    paired = true;
    type = 'OUT';
  } else if (nextIn && !nextOut) {
    workedMinutes = null;
    extraMinutes = null;
    paired = false;
    type = 'IN';
  } else if (!nextIn && nextOut) {
    res.status(400).json({ error: 'clockInAt 없이 clockOutAt만 수정할 수 없습니다.' });
    return;
  }

  const updated = await prisma.attendanceRecord.update({
    where: { id },
    data: {
      clockInAt: nextIn ?? null,
      clockOutAt: nextOut ?? null,
      workedMinutes: workedMinutes ?? undefined,
      extraMinutes: extraMinutes ?? undefined,
      paired,
      type,
    },
  });

  res.json(updated);
};

/**
 * POST /api/attendance
 * body: { shopId, type: "IN" | "OUT" }
 *  - 라우터에서 already: authenticateJWT → requireUser → requireRoles('employee')
 */
export const recordAttendance = async (
  req: AuthRequiredRequest,
  res: Response
): Promise<void> => {
  const parsed = recordAttendanceSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid payload' });
    return;
  }
  const { shopId, type } = parsed.data;

  if (shopId !== req.user.shopId) {
    res.status(403).json({ error: '다른 가게 QR입니다.' });
    return;
  }

  const employeeId = req.user.userId;
  const now = new Date();

  if (type === 'IN') {
    const openIn = await prisma.attendanceRecord.findFirst({
      where: { employeeId, paired: false }
    });
    if (openIn) {
      res.status(400).json({ error: '이미 출근 상태입니다.' });
      return;
    }
    const newRecord = await prisma.attendanceRecord.create({
      data: { shopId, employeeId, type: 'IN', clockInAt: now, paired: false }
    });
    res.json({ ok: true, message: '출근 완료', clockInAt: newRecord.clockInAt });
    return;
  }

  if (type === 'OUT') {
    const inRecord = await prisma.attendanceRecord.findFirst({
      where: { employeeId, paired: false },
      orderBy: { clockInAt: 'desc' }
    });
    if (!inRecord) {
      res.status(400).json({ error: '출근 기록이 없습니다.' });
      return;
    }

    const workedMinutes = diffMinutes(inRecord.clockInAt!, now);
    const extraMinutes = calcExtraMinutes(workedMinutes);

    await prisma.attendanceRecord.update({
      where: { id: inRecord.id },
      data: {
        type: 'OUT',
        clockOutAt: now,
        workedMinutes,
        extraMinutes,
        paired: true
      }
    });

    res.json({
      ok: true,
      message: '퇴근 완료',
      clockOutAt: now,
      workedMinutes,
      extraMinutes
    });
    return;
  }

  res.status(400).json({ error: 'type은 IN 또는 OUT 이어야 합니다.' });
};

/**
 * GET /api/attendance/me/status
 *  - 라우터에서 already: authenticateJWT → requireUser → requireRoles('employee')
 */
export const getMyCurrentStatus = async (
  req: AuthRequiredRequest,
  res: Response
): Promise<void> => {
  const employeeId = req.user.userId;
  const now = new Date();

  const inRecord = await prisma.attendanceRecord.findFirst({
    where: { employeeId, paired: false },
    orderBy: { clockInAt: 'desc' }
  });

  if (!inRecord) {
    res.json({ onDuty: false });
    return;
  }

  const workedMinutes = diffMinutes(inRecord.clockInAt!, now);
  const extraMinutes = calcExtraMinutes(workedMinutes);

  res.json({
    onDuty: true,
    clockInAt: inRecord.clockInAt,
    workedMinutes,
    extraMinutes
  });
};
