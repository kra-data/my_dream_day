// src/controllers/attendanceController.ts
import { Request, Response } from 'express';
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
const maxDate = (a: Date, b: Date) => (a > b ? a : b);
// 시간 반올림 유틸 (KST 기준)
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const toKST = (d: Date) => new Date(d.getTime() + KST_OFFSET_MS);
const fromKST = (d: Date) => new Date(d.getTime() - KST_OFFSET_MS);
const roundNearestHourKST = (utc: Date) => {
  const k = toKST(utc);
  const h = k.getHours();
  const m = k.getMinutes();
  const r = new Date(k);
  r.setMinutes(0, 0, 0);
  r.setHours(m >= 30 ? h + 1 : h);
  return fromKST(r);
};
const floorHourKST = (utc: Date) => {
  const k = toKST(utc);
  const r = new Date(k);
  r.setMinutes(0, 0, 0);
  return fromKST(r);
};

/* ───────── 정책 상수 ───────── */
const REVIEW_TOLERANCE_MIN = Number(process.env.REVIEW_TOLERANCE_MIN ?? '10'); // ±10 정책
const LATE_GRACE_MIN_FOR_PAYABLE = Number(process.env.LATE_GRACE_MIN_FOR_PAYABLE ?? '10'); // ≤10 지각 인정(정산 삭감 없음)
const AttendancePreviewRounding = z.enum(['NEAREST_HOUR', 'FLOOR_HOUR']);
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
}



export const previewAttendanceRequestSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('IN'),
    shopId:  z.coerce.number().int().positive(),
    // IN은 시프트가 없어도 동작 → 선택
    shiftId: z.coerce.number().int().positive().optional(),
    // 클라이언트가 보낸 스캔 시각(ISO). 없으면 서버 now 사용.
    scannedAt: z.string().datetime().optional()
  }),
  z.object({
    type: z.literal('OUT'),
    shopId:  z.coerce.number().int().positive(),
    // OUT은 반드시 기존 시프트 종료
    shiftId: z.coerce.number().int().positive(),
    scannedAt: z.string().datetime().optional()
  })
]);
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
const recordAttendanceSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('IN'),
    shopId: z.coerce.number().int().positive(),
    shiftId: z.coerce.number().int().positive().optional(),
    memo: z.string().max(500).optional(),
    at: z.coerce.date().optional(),
  }),
  z.object({
    type: z.literal('OUT'),
    shopId: z.coerce.number().int().positive(),
    shiftId: z.coerce.number().int().positive(),
    memo: z.string().max(500).optional(),
    at: z.coerce.date().optional(),
  })
]);

// ───── [추가] OVERDUE 목록용 공통 쿼리 ─────
const overdueListQuery = z.object({
  from: z.string().datetime().optional(),
  to:   z.string().datetime().optional(),
  employeeId: z.coerce.number().int().positive().optional(), // admin용
  cursor: z.coerce.number().int().positive().optional(),
  limit:  z.coerce.number().int().min(1).max(50).optional().default(20),
});
type ShiftWithEmployee = Prisma.WorkShiftGetPayload<{
  include: { employee: { select: { pay: true; payUnit: true } } };
}>;

/** 직원: QR/버튼으로 출퇴근 (shift 1:1) */
export const recordAttendance = async (req: AuthRequiredRequest, res: Response) => {
  const parsed = recordAttendanceSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Invalid payload' }); return; }
  const { shopId, shiftId, type, memo, at } = parsed.data;

  if (req.user.shopId !== shopId) { res.status(403).json({ error: '다른 가게 QR입니다.' }); return; }
  const employeeId = req.user.userId;
  const now = new Date();
  const effectiveAt = at ?? new Date();
  // 요청한 shift가 본인/해당 매장 소속인지 검증(shiftId가 있는 경우만)
  let shift: ShiftWithEmployee | null = null;
  if (shiftId) {
    shift = await prisma.workShift.findFirst({
      where: { id: shiftId, shopId, employeeId },
      include: { employee: { select: { pay: true, payUnit: true } } } // ← 단가/단위 필요
    });
    if (!shift && type === 'OUT') {
      res.status(404).json({ error: '근무일정을 찾을 수 없습니다.' });
      return;
    }
  }

  if (type === 'IN') {
    // 시프트 없으면 → 자동 생성(endAt=null)
    if (!shift) {
      const created = await prisma.workShift.create({
        data: {
          shopId,
          employeeId,
          startAt: effectiveAt,
          endAt: null,               // 종료시각 미정
          status: 'IN_PROGRESS',
          actualInAt: effectiveAt,
          late: false,
          memo: memo ?? undefined,
        }
      });
      return res.json({
        ok: true,
        message: '출근 완료',
        clockInAt: effectiveAt,
        memo,
        shiftId: created.id
      });
    }

    const nowMs = effectiveAt.getTime();
    const startMs = shift.startAt.getTime();
    const deltaMin = Math.round((nowMs - startMs) / 60000); // +: 늦음, -: 이름

    if (deltaMin > REVIEW_TOLERANCE_MIN) {
      // ✅ 10분 초과 지각 → REVIEW 전환 + 메모 저장
      const updated = await prisma.workShift.update({
        where: { id: shiftId },
        data: {
          status: 'REVIEW',
          reviewReason: 'LATE_IN' as any,
          memo: memo ?? undefined,
          actualInAt: effectiveAt,
          late: true
        },
      });
      res.json({
        ok: true,
        message: '출근(관리자 확인 필요)',
        clockInAt: effectiveAt,
        review: { reason: 'LATE_IN', deltaMin },
        memo : memo,
        shiftId: updated.id
      });
      return;
    }

    // 이른 출근 또는 10분 이내 지각: 정상 진행(IN_PROGRESS)
    const late = nowMs > startMs; // 표시용(지각 배지)
    await prisma.workShift.update({
      where: { id: shift!.id },
      data: { status: 'IN_PROGRESS', actualInAt: effectiveAt, late, memo: memo ?? undefined },
    });
    res.json({
      ok: true,
      message: late ? '출근(지각)' : '출근 완료',
clockInAt: effectiveAt,
      memo,
      shiftId
    });
    return;
  }

  if (type === 'OUT') {
    const s = shift!;
    // IN이 없거나 이미 OUT 처리된 경우 방지
    if (!s.actualInAt) { res.status(400).json({ error: '해당 시프트에 출근 기록이 없습니다.' }); return; }
    if (s.actualOutAt) { res.status(400).json({ error: '이미 퇴근 처리된 시프트입니다.' }); return; }
    if (!(effectiveAt > s.actualInAt)) { res.status(400).json({ error: '퇴근 시각은 출근 이후이어야 합니다.' }); return; }

    const nowMs = effectiveAt.getTime();
    const endMs = s.endAt ? s.endAt.getTime() : Number.POSITIVE_INFINITY;
    const inMs = s.actualInAt.getTime();
    const leftEarly = !!s.endAt && nowMs < endMs;

    // ✅ 정산: 10분 이내 지각은 삭감 없음 → payable 계산 시 inAt을 startAt으로 보정
    const lateInMs = Math.max(0, inMs - s.startAt.getTime());
    const inForPayable =
      lateInMs <= LATE_GRACE_MIN_FOR_PAYABLE * 60_000
        ? s.startAt  // 10분 내 지각은 계획 시작부터 인정
        : s.actualInAt;

    const actual = diffMinutes(s.actualInAt, effectiveAt);
    const payable = s.endAt
      ? intersectMinutes(inForPayable, effectiveAt, s.startAt, s.endAt)
      : diffMinutes(inForPayable, effectiveAt);

    // ✅ 종료 10분 이내 조퇴 → REVIEW 전환
    if (leftEarly && (endMs - nowMs) >= REVIEW_TOLERANCE_MIN * 60_000) {
      const updated = await prisma.workShift.update({
        where: { id: shiftId },
        data: {
          status: 'REVIEW',
          reviewReason: 'EARLY_OUT' as any,
          actualOutAt: effectiveAt,
          leftEarly: true,
          memo: memo ?? undefined,
          actualMinutes: actual,
          workedMinutes: payable
        },
      });
      res.json({
        ok: true,
        message: '퇴근(조퇴, 관리자 확인 필요)',
        clockOutAt: effectiveAt,
        workedMinutes: payable,
        actualMinutes: actual,
        planned: { startAt: s.startAt, endAt: s.endAt },
        review: { reason: 'EARLY_OUT' },
        shiftId: updated.id,
      });
      return;
    }
const hourlyAmount =
  s.employee.payUnit === 'HOURLY'
    ? Math.round((payable / 60) * (s.employee.pay ?? 0))
    : null;
await prisma.workShift.update({
  where: { id: shiftId },
  data: {
    status: 'COMPLETED',
    actualOutAt: effectiveAt,
    leftEarly,
    memo: memo ?? undefined,
    actualMinutes: actual,
    workedMinutes: payable,
    finalPayAmount: hourlyAmount,
  },
});
res.json({
  ok: true,
  message: leftEarly ? '퇴근(예정보다 이른 퇴근)' : '퇴근 완료',
  clockOutAt: effectiveAt,
  workedMinutes: payable,
  actualMinutes: actual,
  finalPayAmount: hourlyAmount,
  planned: { startAt: s.startAt, endAt: s.endAt },
  shiftId,
});
    return;
  }

  res.status(400).json({ error: 'Unknown type' });
};
export const previewAttendanceTime = async (req: Request, res: Response) => {

  const parsed = previewAttendanceRequestSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Invalid payload' }); return; }
  const { shopId, shiftId, type, scannedAt } = parsed.data;

  // 스캔 시각(클라이언트가 보낸 값) 또는 서버 now
  const base = scannedAt ? new Date(scannedAt) : new Date();
  if (Number.isNaN(base.getTime())) {
    return res.status(400).json({ error: 'Invalid scannedAt datetime' });
  }
  const suggestedAt =
    type === 'IN' ? roundNearestHourKST(base) : floorHourKST(base);

  // 선택적: 서버 측에서 현재 사용자가 해당 shift에 대해 IN/OUT 가능한지 가벼운 검증
  // (비즈니스 정책에 맞춰 필요 시 추가)
  // await ensureShiftIsScannable({ shopId, shiftId, type, userId: req.user.id });

  // UX에 쓰기 좋은 간단 문구 생성 (KST 기준 HH:mm)
  const k = toKST(suggestedAt);
  const hh = String(k.getHours()).padStart(2, '0');
  const mm = String(k.getMinutes()).padStart(2, '0');
  const label = type === 'IN'
    ? `${hh}:${mm} 출근으로 제안`
    : `${hh}:${mm} 퇴근으로 제안`;
  const message = type === 'IN'
    ? `${hh}시 ${mm}분 출근 맞습니까?`
    : `${hh}시 ${mm}분 퇴근 맞습니까?`;

  return res.json({
    ok: true,
    type,
    shopId,
    shiftId,
    scannedAt: base.toISOString(),
    suggestedAt: suggestedAt.toISOString(),
    rounding: type === 'IN' ? 'NEAREST_HOUR' : 'FLOOR_HOUR',
    label,
    message
  });
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
    const p = cur.endAt
      ? intersectMinutes(cur.actualInAt!, now, cur.startAt, cur.endAt)
      : diffMinutes(cur.actualInAt!, now);
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
      ? (s.endAt ? intersectMinutes(inAt, outAt, s.startAt, s.endAt) : diffMinutes(inAt, outAt))
      : (inAt ? (s.endAt ? intersectMinutes(inAt, now, s.startAt, s.endAt) : diffMinutes(inAt, now)) : 0);

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
export const getAttendanceRecords = async (req: AuthRequiredRequest, res: Response) => {
  const shopId = req.user.shopId;
  const { start, end, employeeId, cursor, limit } = adminListQuerySchema.parse(req.query);

  const where: Prisma.WorkShiftWhereInput = {
    shopId,
    ...(employeeId ? { employeeId } : {}),
    ...(start ? { actualInAt:  { gte: new Date(start) } } : {}),
    ...(end   ? { actualOutAt: { lte: new Date(end)   } } : {}),
  };

  const rows = await prisma.workShift.findMany({
    where,
    orderBy: [{ id: 'desc' }],
    ...(cursor ? { cursor: { id: Number(cursor) }, skip: 1 } : {}),
    take: limit ?? 10,
  });

  const items = rows.map(s => {
    const inAt  = s.actualInAt ?? null;
    const outAt = s.actualOutAt ?? null;

    // 저장값 우선, 없을 때만 보조 계산(레거시 대비)
    const fallbackWorked =
      (inAt && outAt)
        ? (s.endAt ? intersectMinutes(inAt, outAt, s.startAt, s.endAt) : diffMinutes(inAt, outAt))
        : null;
    const fallbackActual =
      (inAt && outAt) ? diffMinutes(inAt, outAt) : null;

    const workedMinutes  = s.workedMinutes  ?? fallbackWorked;
    const actualMinutes  = s.actualMinutes  ?? fallbackActual;
    const finalPayAmount = s.finalPayAmount ?? null;

    return {
      id: s.id,
      shopId: s.shopId,
      employeeId: s.employeeId,

      type: outAt ? 'OUT' : 'IN',
      clockInAt: inAt,
      clockOutAt: outAt,

      // 저장 스냅샷 기준으로 응답
      workedMinutes,
      actualMinutes,
      finalPayAmount,

      // 기존 호환 필드
      extraMinutes: 0,
      paired: !!outAt,
      shiftId: s.id,
      status: s.status,

      // ✅ 새 스키마: 메모 노출
      memo: s.memo ?? null,
    };
  });

  res.json({
    items,
    nextCursor: rows.length === (limit ?? 10) ? rows[rows.length - 1].id : null
  });
};
