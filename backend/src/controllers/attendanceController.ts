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

/* ───────── 라운딩 유틸 ───────── */
/** 올림: 다음 30분 경계(:00 / :30)로 올림 (경계면 그대로) */
const ceilToNextHalfHour = (d: Date) => {
  const t = new Date(d.getTime());
  const mins = t.getUTCMinutes();
  t.setUTCSeconds(0, 0);
  const r = mins % 30;
  if (r === 0) return t;
  t.setUTCMinutes(mins + (30 - r));
  return t;
};

/** 반내림: 직전 30분 경계(:00 / :30)로 내림 */
const floorToPrevHalfHour = (d: Date) => {
  const t = new Date(d.getTime());
  const mins = t.getUTCMinutes();
  t.setUTCSeconds(0, 0);
  t.setUTCMinutes(mins - (mins % 30));
  return t;
};

/** 'HH:MM' -> 분 */
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

/* ───────── 오늘/근처 WorkShift 탐색 ───────── */
const findNearestShiftForNow = async (shopId: number, employeeId: number, now: Date) => {
  const from = startOfKstDay(now);
  const to = endOfKstDay(now);
  const shifts = await prisma.workShift.findMany({
    where: {
      shopId, employeeId,
      startAt: { lt: to },
      endAt: { gt: from },
    },
    orderBy: [{ startAt: 'asc' }],
  });
  if (shifts.length === 0) return null;

  // 1) 지금 포함하는 시프트 최우선
  const hit = shifts.find(s => s.startAt <= now && now < s.endAt);
  if (hit) return hit;
  // 2) 아직 시작 전 중, 시작이 가장 가까운
  const upcoming = shifts.filter(s => now < s.startAt).sort((a, b) => +a.startAt - +b.startAt)[0];
  if (upcoming) return upcoming;
  // 3) 이미 지난 시프트 중, 끝이 가장 최근인 것
  const past = shifts.filter(s => s.endAt <= now).sort((a, b) => +b.endAt - +a.endAt)[0];
  return past ?? null;
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

/** 직원: 출퇴근 기록(미리보기/확정) */
const recordAttendanceSchema = z.object({
  shopId: z.coerce.number().int().positive(),
  type: z.enum(['IN', 'OUT']),
  // ✅ preview 제거: selectedAt 유무로 미리보기/확정 분기
  selectedAt: z.string().datetime().optional(),         // 확정 시 사용(없으면 제안 응답)
  // IN 전용: 시프트 시작도 변경할지
  updateShiftStart: z.coerce.boolean().optional().default(false),
});

/* ───────── 컨트롤러들 ───────── */

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
    return res.json(rec);
  }

  // 2) 열린 IN이 있으면 닫기(OUT 만들기)
  const openIn = await prisma.attendanceRecord.findFirst({
    where: { shopId, employeeId, paired: false },
    orderBy: { clockInAt: 'desc' },
  });

  if (!openIn && !inAt) {
    // 열린 IN 없음 + inAt 없음 → 에러
    if (outAt) { res.status(400).json({ error: 'open IN이 없어서 clockOutAt만으로 생성할 수 없습니다.' }); return; }
    // 열린 IN 없음 + inAt 제공 → 신규 IN 생성
    const rec = await prisma.attendanceRecord.create({
      data: { shopId, employeeId, type: 'IN', clockInAt: inAt!, workedMinutes: null, extraMinutes: 0, paired: false },
    });
    return res.json(rec);
  }

  if (openIn && outAt) {
    const planned = getPlannedShiftFor(openIn.clockInAt!, emp.schedule);
    const { payable } = calcActualAndPayable(openIn.clockInAt!, outAt, planned);
    const rec = await prisma.attendanceRecord.update({
      where: { id: openIn.id },
      data: {
        type: 'OUT',
        clockOutAt: outAt,
        workedMinutes: payable,
        extraMinutes: 0,
        paired: true,
      },
    });
    return res.json(rec);
  }

  // 열린 IN 없음 + inAt만 → IN 생성
  if (!openIn && inAt) {
    const rec = await prisma.attendanceRecord.create({
      data: { shopId, employeeId, type: 'IN', clockInAt: inAt, workedMinutes: null, extraMinutes: 0, paired: false },
    });
    return res.json(rec);
  }

  // 열린 IN 있음 + outAt 없음 → 아무 것도 안함(상태 보고)
  return res.json(openIn);
};

/** 관리자: 기존 기록 수정 */
export const adminUpdateAttendance = async (req: AuthRequiredRequest, res: Response) => {
  const shopId = Number(req.params.shopId);
  const id = Number(req.params.id);
  if (req.user.shopId !== shopId) { res.status(403).json({ error: '다른 가게는 관리할 수 없습니다.' }); return; }

  const parsed = adminUpdateAttendanceSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Invalid payload' }); return; }
  const { clockInAt, clockOutAt } = parsed.data;

  const rec = await prisma.attendanceRecord.findUnique({ where: { id } });
  if (!rec || rec.shopId !== shopId) { res.status(404).json({ error: '기록을 찾을 수 없습니다.' }); return; }

  let nextIn = clockInAt ? new Date(clockInAt) : rec.clockInAt ?? undefined;
  let nextOut = clockOutAt ? new Date(clockOutAt) : rec.clockOutAt ?? undefined;
  if (nextIn && nextOut && nextOut <= nextIn) { res.status(400).json({ error: 'clockOutAt은 clockInAt보다 이후여야 합니다.' }); return; }

  const emp = await prisma.employee.findFirst({ where: { id: rec.employeeId }, select: { schedule: true } });
  const planned = nextIn ? getPlannedShiftFor(nextIn, emp?.schedule) : null;
  let workedMinutes: number | null | undefined = rec.workedMinutes;
  let paired = rec.paired;
  let type: 'IN' | 'OUT' = rec.type as any;

  if (nextIn && nextOut) {
    const { payable } = calcActualAndPayable(nextIn, nextOut, planned ?? undefined);
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
      workedMinutes: workedMinutes ?? undefined,
      extraMinutes: 0,
      paired,
      type,
    },
  });

  res.json(updated);
};

/** 직원: QR로 출퇴근 (IN=올림·시프트맞춤, OUT=반내림·시프트맞춤) — selectedAt 유무로 미리보기/확정 */
export const recordAttendance = async (req: AuthRequiredRequest, res: Response) => {
  const parsed = recordAttendanceSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Invalid payload' }); return; }
  const { shopId, type, selectedAt, updateShiftStart } = parsed.data;

  if (req.user.shopId !== shopId) { res.status(403).json({ error: '다른 가게 QR입니다.' }); return; }
  const employeeId = req.user.userId;

  const now = new Date();
  const emp = await prisma.employee.findFirst({ where: { id: employeeId, shopId }, select: { schedule: true } });
  if (!emp) { res.status(404).json({ error: '직원을 찾을 수 없습니다.' }); return; }

  if (type === 'IN') {
    const openIn = await prisma.attendanceRecord.findFirst({
      where: { shopId, employeeId, paired: false },
    });
    if (openIn) { res.status(400).json({ error: '이미 출근 상태입니다.' }); return; }

    // 오늘/가까운 WorkShift(있으면 우선)
    const workShift = await findNearestShiftForNow(shopId, employeeId, now);

    // ① 제안 계산: 기본은 30분 단위 올림, 시프트 맞춤
    let suggested: Date;
    let suggestionReason: 'ceil_next_half_hour' | 'align_to_shift_start' | 'clamp_into_shift';

    let candidate = ceilToNextHalfHour(now); // ✅ 올림

    if (workShift) {
      if (candidate < workShift.startAt) {
        suggested = new Date(workShift.startAt);
        suggestionReason = 'align_to_shift_start';
      } else if (candidate >= workShift.endAt) {
        suggested = new Date(workShift.startAt); // 시프트 밖이면 시작으로 클램프
        suggestionReason = 'clamp_into_shift';
      } else {
        suggested = candidate;
        suggestionReason = 'ceil_next_half_hour';
      }
    } else {
      const planned = getPlannedShiftFor(now, emp.schedule);
      if (planned) {
        if (candidate < planned.startAt) {
          suggested = new Date(planned.startAt);
          suggestionReason = 'align_to_shift_start';
        } else if (candidate >= planned.endAt) {
          suggested = new Date(planned.startAt);
          suggestionReason = 'clamp_into_shift';
        } else {
          suggested = candidate;
          suggestionReason = 'ceil_next_half_hour';
        }
      } else {
        suggested = candidate;
        suggestionReason = 'ceil_next_half_hour';
      }
    }

    // ② selectedAt 미제공 → 미리보기 응답
    if (!selectedAt) {
      res.json({
        ok: true,
        requiresConfirmation: true,
        type: 'IN',
        now,
        suggestedClockInAt: suggested,
        suggestionReason,
        allowAdjust: true,
        shift: workShift ? {
          id: workShift.id,
          plannedStart: workShift.startAt,
          plannedEnd: workShift.endAt,
          graceInMin: (workShift as any).graceInMin ?? 0,
        } : null
      });
      return;
    }

    // ③ 확정 저장
    const chosenAt = new Date(selectedAt);

    await prisma.$transaction(async (tx) => {
      let linkedShift = workShift;

      // 옵션: 시프트 시작을 chosenAt으로 조정(겹침 없고, chosenAt < endAt 조건)
      if (linkedShift && updateShiftStart && chosenAt.getTime() !== linkedShift.startAt.getTime() && chosenAt < linkedShift.endAt) {
        const overlap = await tx.workShift.findFirst({
          where: {
            employeeId, shopId,
            startAt: { lt: linkedShift.endAt },
            endAt: { gt: chosenAt },
            NOT: { id: linkedShift.id }
          }
        });
        if (!overlap) {
          linkedShift = await tx.workShift.update({
            where: { id: linkedShift.id },
            data: { startAt: chosenAt, updatedBy: employeeId }
          });
        }
      }

      // 출근 기록 생성
      await tx.attendanceRecord.create({
        data: {
          shopId, employeeId,
          type: 'IN',
          clockInAt: chosenAt,
          workedMinutes: null, // OUT 시 계산
          extraMinutes: 0,
          paired: false,
          ...(linkedShift ? { shiftId: linkedShift.id } : {}),
        }
      });

      // 시프트 상태 업데이트
      if (linkedShift) {
        const graceMs = ((linkedShift as any).graceInMin ?? 0) * 60_000;
        const late = chosenAt.getTime() > (linkedShift.startAt.getTime() + graceMs);
        await tx.workShift.update({
          where: { id: linkedShift.id },
          data: { status: 'IN_PROGRESS', actualInAt: chosenAt, late }
        });
      }
    });

    res.json({
      ok: true,
      message: '출근 완료',
      clockInAt: new Date(selectedAt),
      shift: workShift ? { id: workShift.id, plannedStart: workShift.startAt, plannedEnd: workShift.endAt } : null,
    });
    return;
  }

  // ───────── OUT ─────────
  if (type === 'OUT') {
    const inRecord = await prisma.attendanceRecord.findFirst({
      where: { shopId, employeeId, paired: false },
      orderBy: { clockInAt: 'desc' },
      include: { shift: true },
    });
    if (!inRecord || !inRecord.clockInAt) { res.status(400).json({ error: '출근 기록이 없습니다.' }); return; }

    const workShift = inRecord.shift ?? await findNearestShiftForNow(shopId, employeeId, now);

    // ① 제안 계산: 기본은 30분 단위 반내림, 시프트 맞춤 + 출근 이전 방지
    let candidate = floorToPrevHalfHour(now);
    if (candidate < inRecord.clockInAt) candidate = new Date(inRecord.clockInAt);

    let suggested: Date;
    let suggestionReason: 'floor_prev_half_hour' | 'clamp_into_shift';
    if (workShift) {
      const endClamp = candidate > workShift.endAt ? workShift.endAt : candidate;
      suggested = endClamp < inRecord.clockInAt ? inRecord.clockInAt : endClamp;
      suggestionReason = endClamp !== candidate ? 'clamp_into_shift' : 'floor_prev_half_hour';
    } else {
      const planned = getPlannedShiftFor(now, emp.schedule);
      if (planned) {
        const endClamp = candidate > planned.endAt ? planned.endAt : candidate;
        suggested = endClamp < inRecord.clockInAt ? inRecord.clockInAt : endClamp;
        suggestionReason = endClamp !== candidate ? 'clamp_into_shift' : 'floor_prev_half_hour';
      } else {
        suggested = candidate;
        suggestionReason = 'floor_prev_half_hour';
      }
    }

    // ② selectedAt 미제공 → 미리보기 응답
    if (!selectedAt) {
      res.json({
        ok: true,
        requiresConfirmation: true,
        type: 'OUT',
        now,
        suggestedClockOutAt: suggested,
        suggestionReason,
        allowAdjust: true,
        shift: workShift ? {
          id: workShift.id,
          plannedStart: workShift.startAt,
          plannedEnd: workShift.endAt,
          graceInMin: (workShift as any).graceInMin ?? 0,
        } : null
      });
      return;
    }

    // ③ 확정 저장
    const chosenAt = new Date(selectedAt);
    if (!(chosenAt > inRecord.clockInAt && chosenAt <= now)) {
      res.status(400).json({ error: '퇴근 시각은 출근 이후이면서 현재 이전이어야 합니다.' });
      return;
    }

    const planned = workShift ? { startAt: workShift.startAt, endAt: workShift.endAt } : getPlannedShiftFor(inRecord.clockInAt, emp.schedule) ?? undefined;
    const { actual, payable } = calcActualAndPayable(inRecord.clockInAt, chosenAt, planned ?? undefined);

    await prisma.$transaction(async (tx) => {
      await tx.attendanceRecord.update({
        where: { id: inRecord.id },
        data: {
          type: 'OUT',
          clockOutAt: chosenAt,
          workedMinutes: payable, // ✅ 지급 인정(시프트 교집합)
          extraMinutes: 0,
          paired: true,
          ...(workShift ? { shiftId: workShift.id } : {}),
        }
      });

      if (workShift) {
        await tx.workShift.update({
          where: { id: workShift.id },
          data: { status: 'COMPLETED', actualOutAt: chosenAt, leftEarly: chosenAt < workShift.endAt }
        });
      }
    });

    res.json({
      ok: true,
      message: workShift && (chosenAt < workShift.endAt) ? '퇴근(예정보다 이른 퇴근)' : '퇴근 완료',
      clockOutAt: chosenAt,
      workedMinutes: payable,
      actualMinutes: actual,
      planned: planned ?? null,
    });
    return;
  }

  res.status(400).json({ error: 'Unknown type' });
};

/** (직원) 내 실시간 상태 */
export const getMyCurrentStatus = async (req: AuthRequiredRequest, res: Response) => {
  const employeeId = req.user.userId;
  const now = new Date();

  const inRecord = await prisma.attendanceRecord.findFirst({
    where: { employeeId, paired: false },
    orderBy: { clockInAt: 'desc' }
  });
  if (!inRecord || !inRecord.clockInAt) { res.json({ onDuty: false }); return; }

  const emp = await prisma.employee.findFirst({ where: { id: employeeId }, select: { schedule: true } });
  const planned = getPlannedShiftFor(inRecord.clockInAt, emp?.schedule);
  const { actual, payable } = calcActualAndPayable(inRecord.clockInAt, now, planned ?? undefined);

  res.json({
    onDuty: true,
    clockInAt: inRecord.clockInAt,
    minutesSinceClockInActual: actual,
    minutesSinceClockInPayable: payable,
    planned: planned ? { startAt: planned.startAt, endAt: planned.endAt } : null
  });
};

/** (직원) 내 출퇴근 목록 */
export const getMyAttendance = async (req: AuthRequiredRequest, res: Response) => {
  const employeeId = req.user.userId;
  const list = await prisma.attendanceRecord.findMany({
    where: { employeeId },
    orderBy: [{ clockInAt: 'desc' }],
    take: 100
  });
  res.json(list);
};

/** (관리자/점주) 가게 출퇴근 목록 */
export const getAttendanceRecords = async (req: AuthRequiredRequest, res: Response) => {
  const shopId = req.user.shopId;
  const { start, end, employeeId, cursor, limit } = adminListQuerySchema.parse(req.query);

  const where: Prisma.AttendanceRecordWhereInput = {
    shopId,
    ...(employeeId ? { employeeId } : {}),
    ...(start || end ? {
      clockInAt: {
        ...(start ? { gte: new Date(start) } : {}),
      },
      clockOutAt: end ? { lte: new Date(end) } : undefined,
    } : {})
  };

  const rows = await prisma.attendanceRecord.findMany({
    where,
    orderBy: [{ id: 'desc' }],
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    take: limit ?? 10
  });

  res.json({
    items: rows,
    nextCursor: rows.length === (limit ?? 10) ? rows[rows.length - 1].id : null
  });
};
