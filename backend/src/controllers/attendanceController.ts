// src/controllers/attendanceController.ts
import { Response } from 'express';
import { prisma } from '../db/prisma';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { AuthRequiredRequest } from '../middlewares/requireUser';

/* ───────── KST 유틸 ───────── */
const toKst = (d: Date) => new Date(d.getTime() + 9 * 60 * 60 * 1000);
const fromKstParts = (y: number, m1: number, d: number, hh = 0, mm = 0, ss = 0, ms = 0) =>
  new Date(Date.UTC(y, m1, d, hh - 9, mm, ss, ms));
const kstDow = (d: Date) => toKst(d).getUTCDay(); // 0~6 (일~토)
const startOfKstDay = (d: Date) => fromKstParts(toKst(d).getUTCFullYear(), toKst(d).getUTCMonth(), toKst(d).getUTCDate(), 0, 0, 0, 0);
const endOfKstDay = (d: Date) => fromKstParts(toKst(d).getUTCFullYear(), toKst(d).getUTCMonth(), toKst(d).getUTCDate(), 23, 59, 59, 999);

/* ───────── 'HH:MM' -> 분 ───────── */
const toMin = (hhmm: string) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!m) return null;
  const hh = +m[1], mm = +m[2];
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return hh * 60 + mm;
};

/* ───────── 직원 schedule(JSON) → 요일별 시프트 파싱 ───────── */
const parseSchedule = (schedule: any) => {
  // 기대 포맷 예: { mon:{start:'09:00',end:'18:00'}, tue:{...}, ... }
  const map: (null | { startMin: number; endMin: number })[] = new Array(7).fill(null);
  if (!schedule || typeof schedule !== 'object') return map;

  const keyByDow: Record<number, string[]> = {
    0: ['sun', '일'],
    1: ['mon', '월'],
    2: ['tue', '화'],
    3: ['wed', '수'],
    4: ['thu', '목'],
    5: ['fri', '금'],
    6: ['sat', '토'],
  };

  for (let dow = 0; dow < 7; dow++) {
    const keys = keyByDow[dow];
    let pick: any = null;
    for (const k of keys) {
      if (schedule && Object.prototype.hasOwnProperty.call(schedule, k)) {
        pick = (schedule as any)[k];
        break;
      }
    }
    if (!pick) continue;
    const s = typeof pick.start === 'string' ? toMin(pick.start) : null;
    const e = typeof pick.end === 'string' ? toMin(pick.end) : null;
    if (s == null || e == null) continue;
    map[dow] = { startMin: s, endMin: e };
  }
  return map;
};

/** 특정 날짜(KST)의 계획 근무 구간 생성 */
const getPlannedShiftFor = (anchor: Date, schedule: any): { startAt: Date; endAt: Date } | null => {
  const specByDow = parseSchedule(schedule);
  const k = toKst(anchor);
  const dow = k.getUTCDay();
  const spec = specByDow[dow];
  if (!spec) return null;
  const y = k.getUTCFullYear(), m = k.getUTCMonth() + 1, d = k.getUTCDate();
  const startAt = fromKstParts(y, m - 1, d, Math.floor(spec.startMin / 60), spec.startMin % 60);
  const endAt = fromKstParts(y, m - 1, d, Math.floor(spec.endMin / 60), spec.endMin % 60);
  return { startAt, endAt };
};

/* ───────── 근무 시간 계산 ───────── */
const diffMinutes = (a: Date, b: Date) => Math.max(0, Math.floor((b.getTime() - a.getTime()) / 60000));
const intersectMinutes = (a0: Date, a1: Date, b0: Date, b1: Date) => {
  const st = a0 > b0 ? a0 : b0;
  const en = a1 < b1 ? a1 : b1;
  if (en <= st) return 0;
  return diffMinutes(st, en);
};
/** 실제/지급인정(시프트 교집합) 분 계산 */
const calcActualAndPayable = (
  inAt: Date,
  outAt: Date,
  planned?: { startAt: Date; endAt: Date } | null
) => {
  const actual = diffMinutes(inAt, outAt);
  const payable = planned ? intersectMinutes(inAt, outAt, planned.startAt, planned.endAt) : actual;
  return { actual, payable };
};

/* ───────── 공통 zod ───────── */
const dateStr = z.string().datetime();
const adminListQuerySchema = z.object({
  start: dateStr.optional(),
  end: dateStr.optional(),
  employeeId: z.coerce.number().int().positive().optional(),
  cursor: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(50).optional().default(10),
});

/** 직원: 출퇴근 기록(shift 1:1 매칭, 단순 IN/OUT) */
const recordAttendanceSchema = z.object({
  shopId: z.coerce.number().int().positive(),
  shiftId: z.coerce.number().int().positive(),
  type: z.enum(['IN', 'OUT']),
});

const adminUpdateWorkShiftSchema = z.object({
  startAt: z.string().datetime().optional(),
  endAt: z.string().datetime().optional(),
  status: z.enum(['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELED']).optional(),
  actualInAt: z.string().datetime().nullable().optional(),   // null로 지우기 허용
  actualOutAt: z.string().datetime().nullable().optional(),  // null로 지우기 허용
  late: z.boolean().optional(),
  leftEarly: z.boolean().optional(),
}).refine(
  (v) => !!v.startAt || !!v.endAt || !!v.status || 'actualInAt' in v || 'actualOutAt' in v || 'late' in v || 'leftEarly' in v,
  { message: '수정할 필드를 최소 1개 이상 제공하세요.' }
);
export const adminUpdateWorkShift = async (req: AuthRequiredRequest, res: Response) => {
  const shopId = Number(req.params.shopId);
  const shiftId = Number(req.params.shiftId);

  // 매장 권한 체크(점주/관리자 권한 상세 체크가 있다면 여기서 추가)
  if (req.user.shopId !== shopId) {
    res.status(403).json({ error: '다른 가게는 관리할 수 없습니다.' });
    return;
  }

  const parsed = adminUpdateWorkShiftSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid payload', detail: parsed.error.flatten() });
    return;
  }
  const payload = parsed.data;

  // 대상 시프트 로드
  const shift = await prisma.workShift.findFirst({ where: { id: shiftId, shopId } });
  if (!shift) { res.status(404).json({ error: '시프트를 찾을 수 없습니다.' }); return; }

  // 1) next 값 산출(미전달 시 기존값 유지, null 명시 시 null 적용)
  const nextStartAt = payload.startAt ? new Date(payload.startAt) : shift.startAt;
  const nextEndAt   = payload.endAt   ? new Date(payload.endAt)   : shift.endAt;

  const nextActualInAt =
    payload.actualInAt === undefined ? shift.actualInAt
    : (payload.actualInAt === null ? null : new Date(payload.actualInAt));

  const nextActualOutAt =
    payload.actualOutAt === undefined ? shift.actualOutAt
    : (payload.actualOutAt === null ? null : new Date(payload.actualOutAt));

  // 2) 논리 검증
  if (nextStartAt && nextEndAt && !(nextStartAt < nextEndAt)) {
    res.status(400).json({ error: 'endAt은 startAt 이후여야 합니다.' });
    return;
  }
  if (nextActualInAt && nextActualOutAt && !(nextActualInAt < nextActualOutAt)) {
    res.status(400).json({ error: 'actualOutAt은 actualInAt 이후여야 합니다.' });
    return;
  }

  // 3) 겹침(Overlap) 방지 — 스케줄(예정) 시간이 바뀌는 경우에만 체크
  const scheduleChanged = !!payload.startAt || !!payload.endAt;
  if (scheduleChanged && nextStartAt && nextEndAt) {
    const overlap = await prisma.workShift.findFirst({
      where: {
        shopId,
        employeeId: shift.employeeId,
        id: { not: shiftId },
        // [start, end) 교집합 존재하면 겹침
        startAt: { lt: nextEndAt },
        endAt:   { gt: nextStartAt },
      },
      select: { id: true, startAt: true, endAt: true },
    });
    if (overlap) {
      res.status(409).json({ error: 'Overlap with another shift', overlap });
      return;
    }
  }

  // 4) status/late/leftEarly 자동 산출(입력값이 있으면 우선)
  let nextStatus = payload.status ?? shift.status;
  if (!payload.status) {
    // 상태 자동 유추
    if (nextActualInAt && nextActualOutAt) nextStatus = 'COMPLETED';
    else if (nextActualInAt && !nextActualOutAt) nextStatus = 'IN_PROGRESS';
    else nextStatus = 'SCHEDULED';
  }

  // late 자동 계산(지각 유예 적용). 명시값이 없고 in/out, start가 있으면 계산
  let nextLate = payload.late ?? shift.late ?? null;
  if (payload.late === undefined && nextActualInAt && nextStartAt) {
    const graceMs = 1* 60_000;
    nextLate = nextActualInAt.getTime() > (nextStartAt.getTime() + graceMs);
  }

  // leftEarly 자동 계산(예정 종료 대비). 명시값이 없고 out/end가 있으면 계산
  let nextLeftEarly = payload.leftEarly ?? shift.leftEarly ?? null;
  if (payload.leftEarly === undefined && nextActualOutAt && nextEndAt) {
    nextLeftEarly = nextActualOutAt < nextEndAt;
  }
  // 5) 산출값(있을 때만) 미리 계산
  const computedActualMinutes =
    (nextActualInAt && nextActualOutAt) ? diffMinutes(nextActualInAt, nextActualOutAt) : null;
  const computedWorkedMinutes =
    (nextActualInAt && nextActualOutAt) ? intersectMinutes(nextActualInAt, nextActualOutAt, nextStartAt, nextEndAt) : null;

  // 5) 업데이트
  const updated = await prisma.workShift.update({
    where: { id: shiftId },
    data: {
      startAt: nextStartAt,
      endAt: nextEndAt,
      actualInAt: nextActualInAt,
      actualOutAt: nextActualOutAt,
      status: nextStatus,
      late: nextLate as any,        // (boolean|null 허용 스키마면 그대로, boolean?면 boolean만)
      leftEarly: nextLeftEarly as any,
      updatedBy: req.user.userId,
      actualMinutes: computedActualMinutes,
      workedMinutes: computedWorkedMinutes,
    },
  });

  // 6) 부가 계산(응답 편의): 실제/지급 분
  let workedMinutes: number | null = null;
  let actualMinutes: number | null = null;
  if (updated.actualInAt && updated.actualOutAt) {
    actualMinutes = diffMinutes(updated.actualInAt, updated.actualOutAt);
    workedMinutes = (updated.startAt && updated.endAt)
      ? intersectMinutes(updated.actualInAt, updated.actualOutAt, updated.startAt, updated.endAt)
      : actualMinutes;
  }

  res.json({
    ok: true,
    shift: updated,
    summary: {
      actualMinutes,
      workedMinutes,
      late: updated.late ?? null,
      leftEarly: updated.leftEarly ?? null,
    }
  });
};
/** 직원: QR/버튼으로 출퇴근 (shift 1:1) */
export const recordAttendance = async (req: AuthRequiredRequest, res: Response) => {
  const parsed = recordAttendanceSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Invalid payload' }); return; }
  const { shopId, shiftId, type } = parsed.data;

  if (req.user.shopId !== shopId) { res.status(403).json({ error: '다른 가게 QR입니다.' }); return; }
  const employeeId = req.user.userId;
  const now = new Date();

  // 요청한 shift가 본인/해당 매장 소속인지 검증
  const shift = await prisma.workShift.findFirst({ where: { id: shiftId, shopId, employeeId } });
  if (!shift) { res.status(404).json({ error: '근무일정을 찾을 수 없습니다.' }); return; }

  if (type === 'IN') {
    // 이미 IN 처리된 시프트 방지
    if (shift.actualInAt) { res.status(400).json({ error: '이미 출근 처리된 시프트입니다.' }); return; }

    const late = now.getTime() > (shift.startAt.getTime());

    await prisma.workShift.update({
      where: { id: shiftId },
      data: { status: 'IN_PROGRESS', actualInAt: now, late },
    });

    res.json({ ok: true, message: '출근 완료', clockInAt: now, shiftId });
    return;
  }

  if (type === 'OUT') {
    // IN이 없거나 이미 OUT 처리된 경우 방지
    if (!shift.actualInAt) { res.status(400).json({ error: '해당 시프트에 출근 기록이 없습니다.' }); return; }
    if (shift.actualOutAt) { res.status(400).json({ error: '이미 퇴근 처리된 시프트입니다.' }); return; }
    if (!(now > shift.actualInAt)) { res.status(400).json({ error: '퇴근 시각은 출근 이후이어야 합니다.' }); return; }

    // 근무 시간 계산
    const actual = diffMinutes(shift.actualInAt, now);
    const payable = intersectMinutes(shift.actualInAt, now, shift.startAt, shift.endAt);

    await prisma.workShift.update({
      where: { id: shiftId },
      data: {
        status: 'COMPLETED',
        actualOutAt: now,
        leftEarly: now < shift.endAt,
        // ✅ OUT 시 산출값 저장
        actualMinutes: actual,
        workedMinutes: payable
      },
    });

    res.json({
      ok: true,
      message: now < shift.endAt ? '퇴근(예정보다 이른 퇴근)' : '퇴근 완료',
      clockOutAt: now,
      workedMinutes: payable,
      actualMinutes: actual,
      planned: { startAt: shift.startAt, endAt: shift.endAt },
      shiftId,
    });
    return;
  }

  res.status(400).json({ error: 'Unknown type' });
};


/** (직원) 내 실시간 상태 */
export const getMyCurrentStatus = async (req: AuthRequiredRequest, res: Response) => {
  const employeeId = req.user.userId;
  const now = new Date();

  // 진행 중인 시프트(또는 IN만 찍힌 시프트)
  const cur = await prisma.workShift.findFirst({
    where: { employeeId, actualInAt: { not: null }, actualOutAt: null },
    orderBy: { actualInAt: 'desc' },
  });

  if (!cur || !cur.actualInAt) { res.json({ onDuty: false }); return; }

  const { actual, payable } = (() => {
    const a = diffMinutes(cur.actualInAt!, now);
    const p = intersectMinutes(cur.actualInAt!, now, cur.startAt, cur.endAt);
    return { actual: a, payable: p };
  })();

  res.json({
    onDuty: true,
    clockInAt: cur.actualInAt,
    minutesSinceClockInActual: actual,
    minutesSinceClockInPayable: payable,
    planned: { startAt: cur.startAt, endAt: cur.endAt }
  });
};


/** (직원) 내 출퇴근 목록 */
export const getMyAttendance = async (req: AuthRequiredRequest, res: Response) => {
  const employeeId = req.user.userId;
  const now = new Date();
  const rows = await prisma.workShift.findMany({
    where: { employeeId, OR: [{ actualInAt: { not: null } }, { actualOutAt: { not: null } }] },
    orderBy: [{ startAt: 'desc' }],
    take: 100,
  });

  const items = rows.map(s => {
    const inAt = s.actualInAt ?? null;
    const outAt = s.actualOutAt ?? null;
    const actual = (inAt && outAt) ? diffMinutes(inAt, outAt)
                 : (inAt ? diffMinutes(inAt, now) : 0);
    const payable = (inAt && outAt)
      ? intersectMinutes(inAt, outAt, s.startAt, s.endAt)
      : (inAt ? intersectMinutes(inAt, now, s.startAt, s.endAt) : 0);

    return {
      // AttendanceRecord 호환 필드
      id: s.id,                 // ← shiftId로 사용
      shopId: s.shopId,
      employeeId: s.employeeId,
      type: outAt ? 'OUT' : 'IN',
      clockInAt: inAt,
      clockOutAt: outAt,
      workedMinutes: outAt ? payable : null,
      extraMinutes: 0,
      paired: !!outAt,
      shiftId: s.id,

      // 참고용(원한다면 응답에 추가)
      plannedStartAt: s.startAt,
      plannedEndAt: s.endAt,
      status: s.status,
    };
  });

  res.json(items);
};


/** (관리자/점주) 가게 출퇴근 목록 */
/** (관리자/점주) 가게 출퇴근 목록 */
export const getAttendanceRecords = async (req: AuthRequiredRequest, res: Response) => {
  const shopId = req.user.shopId;
  const { start, end, employeeId, cursor, limit } = adminListQuerySchema.parse(req.query);

  const where: Prisma.WorkShiftWhereInput = {
    shopId,
    ...(employeeId ? { employeeId } : {}),
    ...(start ? { actualInAt: { gte: new Date(start) } } : {}),
    ...(end   ? { actualOutAt: { lte: new Date(end) } } : {}),
  };

  const rows = await prisma.workShift.findMany({
    where,
    orderBy: [{ id: 'desc' }],
    ...(cursor ? { cursor: { id: Number(cursor) }, skip: 1 } : {}),
    take: limit ?? 10,
  });

  const items = rows.map(s => {
    const inAt = s.actualInAt ?? null;
    const outAt = s.actualOutAt ?? null;
    const payable = (inAt && outAt) ? intersectMinutes(inAt, outAt, s.startAt, s.endAt) : null;
    return {
      id: s.id,
      shopId: s.shopId,
      employeeId: s.employeeId,
      type: outAt ? 'OUT' : 'IN',
      clockInAt: inAt,
      clockOutAt: outAt,
      workedMinutes: payable,
      extraMinutes: 0,
      paired: !!outAt,
      shiftId: s.id,
      status: s.status,
    };
  });

  res.json({
    items,
    nextCursor: rows.length === (limit ?? 10) ? rows[rows.length - 1].id : null
  });
};

