// src/controllers/attendanceController.ts
import { Response } from 'express';
import { prisma } from '../db/prisma';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { AuthRequiredRequest } from '../middlewares/requireUser';

/* ───────── KST 유틸 ───────── */
const toKst = (d: Date) => new Date(d.getTime() + 9 * 60 * 60 * 1000);
const fromKstParts = (y: number, m1: number, d: number, hh=0, mm=0, ss=0, ms=0) =>
  new Date(Date.UTC(y, m1, d, hh - 9, mm, ss, ms));
const kstDow = (d: Date) => toKst(d).getUTCDay(); // 0~6 일~토

/** 'HH:MM' -> 분 */
const toMin = (hhmm: string) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm); if (!m) return null;
  const hh = +m[1], mm = +m[2];
  if (hh<0 || hh>23 || mm<0 || mm>59) return null;
  return hh*60 + mm;
};

/** 직원 주간 스케줄 JSON을 파싱하여 {0..6: {startMin,endMin}} 반환 */
type DaySpec = { startMin: number; endMin: number } | null;
const WKEYS: Array<'sun'|'mon'|'tue'|'wed'|'thu'|'fri'|'sat'> = ['sun','mon','tue','wed','thu','fri','sat'];
const parseSchedule = (schedule: any): Record<number, DaySpec> => {
  const out: Record<number, DaySpec> = {0:null,1:null,2:null,3:null,4:null,5:null,6:null};
  if (!schedule || typeof schedule !== 'object') return out;
  for (let i=0;i<7;i++) {
    const key = WKEYS[i];
    const v = schedule[key];
    if (!v) { out[i] = null; continue; }
    const pick = Array.isArray(v) ? v[0] : v;
    if (pick?.off) { out[i] = null; continue; }
    const startMin = typeof pick?.start === 'string' ? toMin(pick.start) : null;
    const endMin   = typeof pick?.end   === 'string' ? toMin(pick.end)   : null;
    if (startMin==null || endMin==null) { out[i]=null; continue; }
    out[i] = { startMin, endMin };
  }
  return out;
};

/** 특정 날짜(KST)의 계획 근무 구간 생성 */
const getPlannedShiftFor = (anchor: Date, schedule: any): { startAt: Date; endAt: Date } | null => {
  const specByDow = parseSchedule(schedule);
  const k = toKst(anchor);
  const dow = k.getUTCDay();
  const spec = specByDow[dow];
  if (!spec) return null;
  const y = k.getUTCFullYear(), m = k.getUTCMonth()+1, d = k.getUTCDate();
  const startAt = fromKstParts(y, m-1, d, Math.floor(spec.startMin/60), spec.startMin%60);
  const endAt   = fromKstParts(y, m-1, d, Math.floor(spec.endMin/60),   spec.endMin%60);
  return { startAt, endAt };
};

/* ───────── 공통 유틸 ───────── */
const toEndOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
};
const diffMinutes = (a: Date, b: Date) =>
  Math.max(0, Math.floor((b.getTime() - a.getTime()) / 60000));

/** 두 구간의 교집합(분) */
const intersectMinutes = (aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) => {
  const s = Math.max(aStart.getTime(), bStart.getTime());
  const e = Math.min(aEnd.getTime(), bEnd.getTime());
  return e <= s ? 0 : Math.floor((e - s) / 60000);
};

/** 실제 체류 vs 지급 인정(스케줄 교집합) 동시 계산 */
const calcActualAndPayable = (inAt: Date, outAt: Date, planned?: { startAt: Date; endAt: Date } | null) => {
  const actual = diffMinutes(inAt, outAt);
  const payable = planned ? intersectMinutes(inAt, outAt, planned.startAt, planned.endAt) : actual;
  return { actual, payable };
};

/* ───────── Zod 스키마 ───────── */
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD 형식이어야 합니다.');

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

const adminCreateOrCloseAttendanceSchema = z.object({
  clockInAt: z.string().datetime().optional(),
  clockOutAt: z.string().datetime().optional(),
}).refine(v => !!v.clockInAt || !!v.clockOutAt, {
  message: 'clockInAt 또는 clockOutAt 중 하나는 필요합니다.',
});

const adminUpdateAttendanceSchema = z.object({
  clockInAt: z.string().datetime().optional(),
  clockOutAt: z.string().datetime().optional(),
}).refine(v => !!v.clockInAt || !!v.clockOutAt, {
  message: '변경할 필드를 제공하세요.',
});

const recordAttendanceSchema = z.object({
  shopId: z.coerce.number().int().positive(),
  type: z.enum(['IN', 'OUT']),
});

/* ───────── 컨트롤러들 ───────── */

/** 내 출퇴근 기록(커서) */
export const getMyAttendance = async (req: AuthRequiredRequest, res: Response) => {
  const parsed = myAttendanceQuerySchema.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid query' }); return; }
  const { start, end, cursor, limit } = parsed.data;

  const employeeId = req.user.userId;
  const where: Prisma.AttendanceRecordWhereInput = { employeeId, paired: true };
  if (start || end) {
    where.clockInAt = {};
    if (start) where.clockInAt.gte = new Date(start);
    if (end)   where.clockInAt.lte = toEndOfDay(new Date(end));
  }
  if (cursor) where.id = { lt: cursor };

  const logs = await prisma.attendanceRecord.findMany({
    where, orderBy: [{ clockInAt: 'desc' }, { id: 'desc' }], take: limit,
  });

  const nextCursor = logs.length === limit ? logs[logs.length - 1].id : null;
  const totalWorked = logs.reduce((s,l)=>s+(l.workedMinutes ?? 0),0);

  // 응답 필드: workedMinutes는 "지급 인정 분"임(스케줄 교집합)
  res.json({
    employeeId,
    totalWorkedMinutes: totalWorked,
    records: logs.map(l => ({
      id: l.id,
      date: l.clockInAt ? l.clockInAt.toISOString().slice(0,10) : null,
      clockInAt:  l.clockInAt,
      clockOutAt: l.clockOutAt,
      workedMinutes: l.workedMinutes,     // = payable
      extraMinutes:  l.extraMinutes ?? 0, // 현재 미사용
    })),
    nextCursor,
  });
};

/** 관리자: 가게 출퇴근 기록 조회(커서) */
export const getAttendanceRecords = async (req: AuthRequiredRequest, res: Response) => {
  const shopId = Number(req.params.shopId);
  if (req.user.shopId !== shopId) { res.status(403).json({ error: '다른 가게는 조회할 수 없습니다.' }); return; }

  const parsed = adminListQuerySchema.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid query' }); return; }
  const { start, end, employeeId, cursor, limit } = parsed.data;

  const where: Prisma.AttendanceRecordWhereInput = { shopId };
  if (employeeId) where.employeeId = employeeId;
  if (start || end) {
    where.clockInAt = {};
    if (start) where.clockInAt.gte = new Date(start);
    if (end)   where.clockInAt.lte = toEndOfDay(new Date(end));
  }
  if (cursor) where.id = { lt: cursor };

  const records = await prisma.attendanceRecord.findMany({
    where,
    orderBy: [{ clockInAt: 'desc' }, { id: 'desc' }],
    take: limit,
    include: { employee: { select: { name: true, position: true, section: true, schedule: true } } },
  });

  // 참고: 이 목록 API는 저장된 workedMinutes(=지급 인정 분)를 그대로 반환
  res.json({
    records: records.map(r => ({
      ...r,
      // r.workedMinutes 는 지급 인정 분
    })),
    nextCursor: records.length === limit ? records[records.length - 1].id : null,
  });
};

/** 관리자: 임의 출근/퇴근 생성 혹은 열린 IN 닫기 */
export const adminCreateOrCloseAttendance = async (req: AuthRequiredRequest, res: Response) => {
  const shopId = Number(req.params.shopId);
  const employeeId = Number(req.params.employeeId);
  if (req.user.shopId !== shopId) { res.status(403).json({ error: '다른 가게는 관리할 수 없습니다.' }); return; }

  const parsed = adminCreateOrCloseAttendanceSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Invalid payload' }); return; }
  const { clockInAt, clockOutAt } = parsed.data;

  const emp = await prisma.employee.findFirst({ where: { id: employeeId, shopId }, select: { schedule: true } });
  if (!emp) { res.status(404).json({ error: '직원이 존재하지 않거나 다른 가게 소속입니다.' }); return; }

  const inAt = clockInAt ? new Date(clockInAt) : undefined;
  const outAt = clockOutAt ? new Date(clockOutAt) : undefined;
  if (inAt && outAt && outAt <= inAt) { res.status(400).json({ error: 'clockOutAt은 clockInAt보다 이후여야 합니다.' }); return; }

  // 1) IN & OUT 모두 제공 → 하루 기록 생성(지급 인정 분으로 저장)
  if (inAt && outAt) {
    const planned = getPlannedShiftFor(inAt, emp.schedule);
    const { actual, payable } = calcActualAndPayable(inAt, outAt, planned);
    const rec = await prisma.attendanceRecord.create({
      data: {
        shopId, employeeId,
        type: 'OUT',
        clockInAt: inAt, clockOutAt: outAt,
        workedMinutes: payable,         // ✅ 스케줄 교집합(지급 인정)
        extraMinutes: 0,                // 야근 로직 미사용
        paired: true,
      },
    });
    res.status(201).json({ ...rec, actualMinutes: actual, payableMinutes: payable, planned });
    return;
  }

  // 2) IN만 제공 → 열린 IN 생성
  if (inAt && !outAt) {
    const open = await prisma.attendanceRecord.findFirst({ where: { employeeId, paired: false } });
    if (open) { res.status(400).json({ error: '이미 열린 출근 기록이 있습니다.' }); return; }
    const rec = await prisma.attendanceRecord.create({
      data: { shopId, employeeId, type: 'IN', clockInAt: inAt, paired: false },
    });
    res.status(201).json(rec);
    return;
  }

  // 3) OUT만 제공 → 가장 최근 열린 IN 닫기(지급 인정 분으로 업데이트)
  if (!inAt && outAt) {
    const open = await prisma.attendanceRecord.findFirst({
      where: { employeeId, paired: false }, orderBy: { clockInAt: 'desc' }
    });
    if (!open || !open.clockInAt) { res.status(400).json({ error: '열린 출근 기록이 없습니다.' }); return; }
    if (outAt <= open.clockInAt) { res.status(400).json({ error: '퇴근 시각이 출근 시각보다 빠릅니다.' }); return; }

    const emp2 = await prisma.employee.findFirst({ where: { id: employeeId }, select: { schedule: true } });
    const planned = getPlannedShiftFor(open.clockInAt, emp2?.schedule);
    const { actual, payable } = calcActualAndPayable(open.clockInAt, outAt, planned);

    const rec = await prisma.attendanceRecord.update({
      where: { id: open.id },
      data: {
        type: 'OUT',
        clockOutAt: outAt,
        workedMinutes: payable,   // ✅ 지급 인정 분
        extraMinutes: 0,
        paired: true,
      },
    });
    res.json({ ...rec, actualMinutes: actual, payableMinutes: payable, planned });
    return;
  }
};

/** 관리자: 기존 기록 수정(지급 인정 재계산) */
export const adminUpdateAttendance = async (req: AuthRequiredRequest, res: Response) => {
  const shopId = Number(req.params.shopId);
  const id = Number(req.params.id);
  if (req.user.shopId !== shopId) { res.status(403).json({ error: '다른 가게는 관리할 수 없습니다.' }); return; }

  const parsed = adminUpdateAttendanceSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Invalid payload' }); return; }
  const { clockInAt, clockOutAt } = parsed.data;

  const rec = await prisma.attendanceRecord.findUnique({ where: { id } });
  if (!rec || rec.shopId !== shopId) { res.status(404).json({ error: '기록을 찾을 수 없습니다.' }); return; }

  const nextIn  = clockInAt  ? new Date(clockInAt)  : rec.clockInAt ?? undefined;
  const nextOut = clockOutAt ? new Date(clockOutAt) : rec.clockOutAt ?? undefined;
  if (nextIn && nextOut && nextOut <= nextIn) { res.status(400).json({ error: 'clockOutAt은 clockInAt보다 이후여야 합니다.' }); return; }

  // 스케줄 재계산
  let workedMinutes: number | null = rec.workedMinutes ?? null;
  let paired = rec.paired;
  let type = rec.type;

  if (nextIn && nextOut) {
    const emp = await prisma.employee.findFirst({ where: { id: rec.employeeId }, select: { schedule: true } });
    const planned = getPlannedShiftFor(nextIn, emp?.schedule);
    const { payable } = calcActualAndPayable(nextIn, nextOut, planned);
    workedMinutes = payable;
    paired = true;
    type = 'OUT';
  } else if (nextIn && !nextOut) {
    workedMinutes = null;
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
      workedMinutes: workedMinutes ?? undefined, // 지급 인정 분
      extraMinutes: 0,
      paired,
      type,
    },
  });

  res.json(updated);
};

/** 직원: QR로 출근/퇴근 (WorkShift 연동 + 지급 인정 기준 반영) */
export const recordAttendance = async (req: AuthRequiredRequest, res: Response) => {
  const parsed = recordAttendanceSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Invalid payload' }); return; }
  const { shopId, type } = parsed.data;

  if (shopId !== req.user.shopId) { res.status(403).json({ error: '다른 가게 QR입니다.' }); return; }

  const employeeId = req.user.userId;
  const now = new Date();

  // ── 오늘(KST) 범위 계산
  const kst = toKst(now);
  const y = kst.getUTCFullYear(), m = kst.getUTCMonth() + 1, d = kst.getUTCDate();
  const dayStartUtc = fromKstParts(y, m - 1, d, 0, 0, 0, 0);
  const dayEndUtc   = fromKstParts(y, m - 1, d, 23, 59, 59, 999);

  // 상태 문자열 혼용 대비 (스키마는 PLANNED/IN_PROGRESS/COMPLETED, 기존 컨트롤러는 SCHEDULED 사용)
  const SHIFT_STATUSES_PLANNED = ['PLANNED', 'SCHEDULED'] as const;

  // 오늘 사용할 “해당 시프트” 찾기:
  //  - 동일 직원/매장
  //  - 오늘(KST) 시작~끝 사이에 시작하는 시프트
  //  - 아직 끝나지 않은(endAt >= now) 시프트를 우선
  const findTodaysShift = async () => {
    const s1 = await prisma.workShift.findFirst({
      where: {
        shopId, employeeId,
        startAt: { gte: dayStartUtc, lte: dayEndUtc },
        endAt:   { gte: now },
        status:  { in: [...SHIFT_STATUSES_PLANNED, 'IN_PROGRESS'] }
      },
      orderBy: { startAt: 'asc' }
    });
    if (s1) return s1;
    // 그래도 못 찾으면 “오늘 시작한 시프트” 중 아무거나 (이미 끝난 경우)
    return prisma.workShift.findFirst({
      where: {
        shopId, employeeId,
        startAt: { gte: dayStartUtc, lte: dayEndUtc },
        status:  { in: [...SHIFT_STATUSES_PLANNED, 'IN_PROGRESS'] }
      },
      orderBy: { startAt: 'asc' }
    });
  };

  if (type === 'IN') {
    // 이미 열린 IN이 있으면 방지
    const openIn = await prisma.attendanceRecord.findFirst({ where: { employeeId, paired: false } });
    if (openIn) { res.status(400).json({ error: '이미 출근 상태입니다.' }); return; }

    // 오늘 시프트 필수
    const shift = await findTodaysShift();
    if (!shift) {
      res.status(409).json({
        error: '오늘 근무일정이 없습니다. 먼저 근무일정을 생성하세요.',
        code: 'NO_SHIFT_TODAY',
        hint: 'POST /api/my/workshifts (date, start, end)로 생성 후 다시 시도하세요.'
      });
      return;
    }

    // 시프트의 지각 유예(graceInMin) 반영해 지각 여부 판단(정보용)
    const graceMs = (shift.graceInMin ?? 0) * 60000;
    const isLate  = now.getTime() > (shift.startAt.getTime() + graceMs);

    await prisma.$transaction(async (tx) => {
      // 출근 레코드 생성(시프트 연결)
      await tx.attendanceRecord.create({
        data: {
          shopId, employeeId,
          type: 'IN',
          clockInAt: now,
          paired: false,
          shiftId: shift.id
        }
      });
      // 시프트 상태/실측 갱신
      await tx.workShift.update({
        where: { id: shift.id },
        data: {
          status: 'IN_PROGRESS',
          actualInAt: now,
          late: isLate
        }
      });
    });

    res.json({
      ok: true,
      message: '출근 완료',
      clockInAt: now,
      shift: {
        id: shift.id,
        plannedStart: shift.startAt,
        plannedEnd: shift.endAt,
        graceInMin: shift.graceInMin ?? 0,
        late: isLate
      }
    });
    return;
  }

  if (type === 'OUT') {
    const inRecord = await prisma.attendanceRecord.findFirst({
      where: { employeeId, paired: false },
      orderBy: { clockInAt: 'desc' },
      include: { shift: true }
    });
    if (!inRecord || !inRecord.clockInAt) {
      res.status(400).json({ error: '출근 기록이 없습니다.' });
      return;
    }
    if (now <= inRecord.clockInAt) {
      res.status(400).json({ error: '퇴근 시각이 출근 시각보다 빠릅니다.' });
      return;
    }

    // 시프트 연결이 없다면 오늘 시프트 탐색해 연결
    let shift = inRecord.shift ?? null;
    if (!shift) {
      shift = await findTodaysShift();
      // OUT 시에도 시프트가 없을 수 있음(무스케줄 근무) → payable은 actual과 동일
    }

    const planned = shift ? { startAt: shift.startAt, endAt: shift.endAt } : undefined;
    const { actual, payable } = calcActualAndPayable(inRecord.clockInAt, now, planned);

    await prisma.$transaction(async (tx) => {
      // 출퇴근 레코드 마감(지급 인정 분 저장 + 시프트 연결)
      await tx.attendanceRecord.update({
        where: { id: inRecord.id },
        data: {
          type: 'OUT',
          clockOutAt: now,
          workedMinutes: payable, // ✅ 지급 인정(시프트 교집합)만
          extraMinutes: 0,
          paired: true,
          ...(shift ? { shiftId: shift.id } : {})
        }
      });

      // 시프트가 있으면 상태/실측/조퇴 여부 갱신
      if (shift) {
        await tx.workShift.update({
          where: { id: shift.id },
          data: {
            status: 'COMPLETED',
            actualOutAt: now,
            leftEarly: now < shift.endAt
          }
        });
      }
    });

    res.json({
      ok: true,
      message: shift && now < shift.endAt ? '퇴근(예정보다 이른 퇴근)' : '퇴근 완료',
      clockOutAt: now,
      workedMinutes: payable,      // 지급 인정
      actualMinutes: actual,       // 실제 체류
      planned: shift ? { startAt: shift.startAt, endAt: shift.endAt } : null
    });
    return;
  }

  res.status(400).json({ error: 'type은 IN 또는 OUT 이어야 합니다.' });
};

/** 내 현재 출근 상태 */
export const getMyCurrentStatus = async (req: AuthRequiredRequest, res: Response) => {
  const employeeId = req.user.userId;
  const now = new Date();

  const inRecord = await prisma.attendanceRecord.findFirst({
    where: { employeeId, paired: false }, orderBy: { clockInAt: 'desc' }
  });
  if (!inRecord || !inRecord.clockInAt) { res.json({ onDuty: false }); return; }

  const emp = await prisma.employee.findFirst({ where: { id: employeeId }, select: { schedule: true } });
  const planned = getPlannedShiftFor(inRecord.clockInAt, emp?.schedule);
  const { actual, payable } = calcActualAndPayable(inRecord.clockInAt, now, planned);

  res.json({
    onDuty: true,
    clockInAt: inRecord.clockInAt,
    minutesSinceClockInActual: actual,
    minutesSinceClockInPayable: payable,
    planned: planned ? { startAt: planned.startAt, endAt: planned.endAt } : null
  });
};
