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

/* ───────── 정책 상수 ───────── */
const REVIEW_TOLERANCE_MIN = Number(process.env.REVIEW_TOLERANCE_MIN ?? '10'); // ±10 정책
const LATE_GRACE_MIN_FOR_PAYABLE = Number(process.env.LATE_GRACE_MIN_FOR_PAYABLE ?? '10'); // ≤10 지각 인정(정산 삭감 없음)
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
  memo: z.string().max(500).optional(),
});

const adminUpdateWorkShiftSchema = z.object({
  startAt: z.string().datetime().optional(),
  endAt: z.string().datetime().optional(),
  status: z.enum(['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELED', 'OVERDUE']).optional(), // ← 추가
  actualInAt: z.string().datetime().nullable().optional(),
  actualOutAt: z.string().datetime().nullable().optional(),
  late: z.boolean().optional(),
  leftEarly: z.boolean().optional(),
}).refine(
  (v) => !!v.startAt || !!v.endAt || !!v.status || 'actualInAt' in v || 'actualOutAt' in v || 'late' in v || 'leftEarly' in v,
  { message: '수정할 필드를 최소 1개 이상 제공하세요.' }
);

// ───── [추가] OVERDUE 목록용 공통 쿼리 ─────
const overdueListQuery = z.object({
  from: z.string().datetime().optional(),
  to:   z.string().datetime().optional(),
  employeeId: z.coerce.number().int().positive().optional(), // admin용
  cursor: z.coerce.number().int().positive().optional(),
  limit:  z.coerce.number().int().min(1).max(50).optional().default(20),
});

// ───── [추가] 직원: OVERDUE 목록 ─────
// GET /api/attendance/me/overdue
export const getMyOverdueWorkShifts = async (req: AuthRequiredRequest, res: Response) => {
  const employeeId = req.user.userId;
  const { from, to, cursor, limit } = overdueListQuery.parse(req.query);

  const where: Prisma.WorkShiftWhereInput = {
    employeeId,
    status: 'OVERDUE' as any,
    ...(from || to
      ? { startAt: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) } }
      : {}
    ),
  };

  const rows = await prisma.workShift.findMany({
    where,
    orderBy: [{ id: 'desc' }],
    ...(cursor ? { cursor: { id: Number(cursor) }, skip: 1 } : {}),
    take: limit,
  });

  res.json({
    items: rows,
    nextCursor: rows.length === (limit ?? 20) ? rows[rows.length - 1].id : null,
  });
};

// ───── [추가] 관리자/점주: OVERDUE 목록 ─────
// GET /api/admin/shops/:shopId/workshifts/overdue
export const getShopOverdueWorkShifts = async (req: AuthRequiredRequest, res: Response) => {
  const shopId = Number(req.params.shopId);
  if (req.user.shopId !== shopId) { res.status(403).json({ error: '다른 가게는 조회할 수 없습니다.' }); return; }

  const { from, to, employeeId, cursor, limit } = overdueListQuery.parse(req.query);

  const where: Prisma.WorkShiftWhereInput = {
    shopId,
    status: 'OVERDUE' as any,
    ...(employeeId ? { employeeId } : {}),
    ...(from || to
      ? { startAt: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) } }
      : {}
    ),
  };

  const rows = await prisma.workShift.findMany({
    where,
    include: { employee: { select: { name: true, position: true, section: true, pay: true, payUnit: true } } },
    orderBy: [{ id: 'desc' }],
    ...(cursor ? { cursor: { id: Number(cursor) }, skip: 1 } : {}),
    take: limit,
  });

  // 기존 WorkShiftWithEmployee 형태로 맞춰서 응답(필요시 그대로 rows 반환해도 됨)
  const items = rows.map(r => ({
    id: r.id,
    shopId: r.shopId,
    employeeId: r.employeeId,
    startAt: r.startAt,
    endAt: r.endAt,
    status: r.status,
    actualInAt: r.actualInAt,
    actualOutAt: r.actualOutAt,
    late: r.late,
    leftEarly: r.leftEarly,
    workedMinutes: r.workedMinutes,
    actualMinutes: r.actualMinutes,
    settlementId: r.settlementId,
    createdBy: r.createdBy,
    updatedBy: r.updatedBy,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    employee: {
      name: r.employee.name,
      position: r.employee.position,
      section: r.employee.section,
      // 필요하면 지급단가/단위도 내려보내기
      pay: r.employee.pay,
      payUnit: r.employee.payUnit,
    }
  }));

  res.json({
    items,
    nextCursor: rows.length === (limit ?? 20) ? rows[rows.length - 1].id : null,
  });
};
export const adminUpdateWorkShift = async (req: AuthRequiredRequest, res: Response) => {
  const shopId = Number(req.params.shopId);
  const shiftId = Number(req.params.shiftId);
  if (req.user.shopId !== shopId) { res.status(403).json({ error: '다른 가게는 관리할 수 없습니다.' }); return; }

  const parsed = adminUpdateWorkShiftSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid payload', detail: parsed.error.flatten() }); return;
  }
  const payload = parsed.data;

const shift = await prisma.workShift.findFirst({
  where: { id: shiftId, shopId },
  include: { employee: { select: { pay: true, payUnit: true } } }   // ← 단가/단위 필요
});
if (!shift) { res.status(404).json({ error: '시프트를 찾을 수 없습니다.' }); return; }


  const nextStartAt = payload.startAt ? new Date(payload.startAt) : shift.startAt;
  const nextEndAt   = payload.endAt   ? new Date(payload.endAt)   : shift.endAt;

  const nextActualInAt =
    payload.actualInAt === undefined ? shift.actualInAt
    : (payload.actualInAt === null ? null : new Date(payload.actualInAt));

  const nextActualOutAt =
    payload.actualOutAt === undefined ? shift.actualOutAt
    : (payload.actualOutAt === null ? null : new Date(payload.actualOutAt));

  if (nextStartAt && nextEndAt && !(nextStartAt < nextEndAt)) {
    res.status(400).json({ error: 'endAt은 startAt 이후여야 합니다.' }); return;
  }
  if (nextActualInAt && nextActualOutAt && !(nextActualInAt < nextActualOutAt)) {
    res.status(400).json({ error: 'actualOutAt은 actualInAt 이후여야 합니다.' }); return;
  }

  const scheduleChanged = !!payload.startAt || !!payload.endAt;
  if (scheduleChanged && nextStartAt && nextEndAt) {
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
    if (overlap) { res.status(409).json({ error: 'Overlap with another shift', overlap }); return; }
  }

  // 상태 산출: 입력값 우선, 다만 in/out 모두 있으면 강제 COMPLETED
  let nextStatus = payload.status ?? shift.status;
  if (nextActualInAt && nextActualOutAt) {
    nextStatus = 'COMPLETED' as any; // ← OVERDUE 였어도 실제 보정되면 완료 처리
  } else if (!payload.status) {
    if (nextActualInAt && !nextActualOutAt) nextStatus = 'IN_PROGRESS' as any;
    else nextStatus = 'SCHEDULED' as any;
  }

  // 지각/조퇴, 분 계산
  let nextLate: boolean | null | undefined = payload.late ?? shift.late ?? null;
  if (payload.late === undefined && nextActualInAt && nextStartAt) {
    const graceMs = 1 * 60_000; // 필요시 환경변수/DB 유예분 반영
    nextLate = nextActualInAt.getTime() > (nextStartAt.getTime() + graceMs);
  }

  let nextLeftEarly: boolean | null | undefined = payload.leftEarly ?? shift.leftEarly ?? null;
  if (payload.leftEarly === undefined && nextActualOutAt && nextEndAt) {
    nextLeftEarly = nextActualOutAt < nextEndAt;
  }


// ...중략(검증/겹침/상태결정 로직 동일) ...

const computedActualMinutes =
  (nextActualInAt && nextActualOutAt) ? diffMinutes(nextActualInAt, nextActualOutAt) : null;

// ★ 지각 10분 유예 반영해서 payable 계산
let computedWorkedMinutes: number | null = null;
if (nextActualInAt && nextActualOutAt) {
  const lateMs = Math.max(0, nextActualInAt.getTime() - nextStartAt.getTime());
  const inForPayable =
    lateMs <= LATE_GRACE_MIN_FOR_PAYABLE * 60_000 ? nextStartAt : nextActualInAt;
  computedWorkedMinutes = intersectMinutes(inForPayable, nextActualOutAt, nextStartAt, nextEndAt);
}

// ★ 확정 급여 계산 (시급제 & COMPLETED & 근무분 유효)
let nextFinalPayAmount: number | null | undefined = undefined;
if (nextStatus === ('COMPLETED' as any) && computedWorkedMinutes != null) {
  if (shift.employee.payUnit === 'HOURLY') {
    nextFinalPayAmount = Math.round((computedWorkedMinutes / 60) * (shift.employee.pay ?? 0));
  } else {
    nextFinalPayAmount = null; // 월급제는 시프트별 확정 없음(요구사항)
  }
} else if (nextStatus !== ('COMPLETED' as any)) {
  // 완료가 아니라면 확정값 제거(미확정 상태)
  nextFinalPayAmount = null;
}

  // ✅ 관리자 수정 규칙
  // - admin이 수정하는 경우에는 REVIEW로 "새로" 전환하지 않음.
  // - 이미 REVIEW 상태였다면 이번 수정으로 "해결 처리"한다(승인 개념).
  // - 연장( endAt 증가 )도 admin이 하면 '해결 처리 + 사유 기록'으로 남긴다.
  const extendedByAdmin = scheduleChanged && nextEndAt.getTime() > shift.endAt.getTime();

  // 리뷰 관련 패치(관리자 수정 = resolve)
  const reviewPatch: Prisma.WorkShiftUpdateInput = {};
  if (shift.needsReview || shift.status === ('REVIEW' as any)) {
    // 기존 리뷰를 이번 수정으로 해소
    (reviewPatch as any).needsReview = false;
    (reviewPatch as any).reviewResolvedAt = new Date();
    (reviewPatch as any).reviewedBy = req.user.userId;
    // admin이 명시적으로 status를 REVIEW로 유지하길 원하지 않는 한,
    // REVIEW였다면 적절한 상태로 돌려준다.
    if (nextStatus === ('REVIEW' as any)) {
      nextStatus = (nextActualInAt && nextActualOutAt)
        ? ('COMPLETED' as any)
        : (nextActualInAt ? ('IN_PROGRESS' as any) : ('SCHEDULED' as any));
    }
  }
  if (extendedByAdmin) {
    // 연장 사유만 남기되, REVIEW로 전환하지는 않음
    (reviewPatch as any).reviewReason = 'EXTENDED';
  }
  const updated = await prisma.workShift.update({
    where: { id: shiftId },
    data: {
      startAt: nextStartAt,
      endAt: nextEndAt,
      actualInAt: nextActualInAt,
      actualOutAt: nextActualOutAt,
      status: nextStatus,
      ...reviewPatch,
      late: nextLate as any,
      leftEarly: nextLeftEarly as any,
      updatedBy: req.user.userId,
      actualMinutes: computedActualMinutes,
      workedMinutes: computedWorkedMinutes,
          finalPayAmount: nextFinalPayAmount,
    },
  });

  res.json({
    ok: true,
    shift: updated,
    summary: {
      actualMinutes: computedActualMinutes,
      workedMinutes: computedWorkedMinutes,
      late: updated.late ?? null,
      leftEarly: updated.leftEarly ?? null,
          finalPayAmount: nextFinalPayAmount,
    }
  });
};
/** 직원: QR/버튼으로 출퇴근 (shift 1:1) */
export const recordAttendance = async (req: AuthRequiredRequest, res: Response) => {
  const parsed = recordAttendanceSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Invalid payload' }); return; }
  const { shopId, shiftId, type, memo } = parsed.data;

  if (req.user.shopId !== shopId) { res.status(403).json({ error: '다른 가게 QR입니다.' }); return; }
  const employeeId = req.user.userId;
  const now = new Date();

  // 요청한 shift가 본인/해당 매장 소속인지 검증
const shift = await prisma.workShift.findFirst({
  where: { id: shiftId, shopId, employeeId },
  include: { employee: { select: { pay: true, payUnit: true } } }   // ← 단가/단위 필요
});
if (!shift) { res.status(404).json({ error: '근무일정을 찾을 수 없습니다.' }); return; }


  if (type === 'IN') {
    const nowMs = now.getTime();
    const startMs = shift.startAt.getTime();
    const deltaMin = Math.round((nowMs - startMs) / 60000); // +: 늦음, -: 이름

    if (deltaMin > REVIEW_TOLERANCE_MIN) {
      // ✅ 10분 초과 지각 → REVIEW 전환 + 메모 저장
      const updated = await prisma.workShift.update({
        where: { id: shiftId },
        data: {
          status: 'REVIEW',
          needsReview: true,
          reviewReason: 'LATE_IN' as any,
          reviewNote: memo ?? undefined,
          actualInAt: now,
          late: true
        },
      });
      res.json({
        ok: true,
        message: '출근(관리자 확인 필요)',
        clockInAt: now,
        review: { reason: 'LATE_IN', deltaMin },
        shiftId: updated.id
      });
      return;
    }

    // 이른 출근 또는 10분 이내 지각: 정상 진행(IN_PROGRESS)
    const late = nowMs > startMs; // 표시용(지각 배지)
    await prisma.workShift.update({
      where: { id: shiftId },
      data: { status: 'IN_PROGRESS', actualInAt: now, late },
    });
    res.json({
      ok: true,
      message: late ? '출근(지각)' : '출근 완료',
      clockInAt: now,
      shiftId
    });
    return;
  }

  if (type === 'OUT') {
    // IN이 없거나 이미 OUT 처리된 경우 방지
    if (!shift.actualInAt) { res.status(400).json({ error: '해당 시프트에 출근 기록이 없습니다.' }); return; }
    if (shift.actualOutAt) { res.status(400).json({ error: '이미 퇴근 처리된 시프트입니다.' }); return; }
    if (!(now > shift.actualInAt)) { res.status(400).json({ error: '퇴근 시각은 출근 이후이어야 합니다.' }); return; }

    const nowMs = now.getTime();
    const endMs = shift.endAt.getTime();
    const inMs = shift.actualInAt.getTime();
    const leftEarly = nowMs < endMs;

    // ✅ 정산: 10분 이내 지각은 삭감 없음 → payable 계산 시 inAt을 startAt으로 보정
    const lateInMs = Math.max(0, inMs - shift.startAt.getTime());
    const inForPayable =
      lateInMs <= LATE_GRACE_MIN_FOR_PAYABLE * 60_000
        ? shift.startAt  // 10분 내 지각은 계획 시작부터 인정
        : shift.actualInAt;

    const actual = diffMinutes(shift.actualInAt, now);
    const payable = intersectMinutes(inForPayable, now, shift.startAt, shift.endAt);

    // ✅ 종료 10분 이내 조퇴 → REVIEW 전환
    if (leftEarly && (endMs - nowMs) >= REVIEW_TOLERANCE_MIN * 60_000) {
      const updated = await prisma.workShift.update({
        where: { id: shiftId },
        data: {
          status: 'REVIEW',
          needsReview: true,
          reviewReason: 'EARLY_OUT' as any,
          actualOutAt: now,
          leftEarly: true,
          actualMinutes: actual,
          workedMinutes: payable
        },
      });
      res.json({
        ok: true,
        message: '퇴근(조퇴, 관리자 확인 필요)',
        clockOutAt: now,
        workedMinutes: payable,
        actualMinutes: actual,
        planned: { startAt: shift.startAt, endAt: shift.endAt },
        review: { reason: 'EARLY_OUT' },
        shiftId: updated.id,
      });
      return;
    }
const hourlyAmount =
  shift.employee.payUnit === 'HOURLY'
    ? Math.round((payable / 60) * (shift.employee.pay ?? 0))
    : null;
await prisma.workShift.update({
  where: { id: shiftId },
  data: {
    status: 'COMPLETED',
    actualOutAt: now,
    leftEarly,
    actualMinutes: actual,
    workedMinutes: payable,
    finalPayAmount: hourlyAmount,
  },
});
res.json({
  ok: true,
  message: leftEarly ? '퇴근(예정보다 이른 퇴근)' : '퇴근 완료',
  clockOutAt: now,
  workedMinutes: payable,
  actualMinutes: actual,
  finalPayAmount: hourlyAmount,
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

