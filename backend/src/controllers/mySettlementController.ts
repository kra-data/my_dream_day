// controllers/mySettlementController.ts
import { Response } from 'express';
import { prisma } from '../db/prisma';
import { AuthRequiredRequest } from '../middlewares/requireUser';
import { z } from 'zod';

/** ───────── 설정값 ───────── */
const DEFAULT_CYCLE_START_DAY = Number(process.env.SETTLEMENT_CYCLE_START_DAY ?? 7); // 매월 7일 시작 ~ 다음달 6일 종료
const DEFAULT_LATE_GRACE_MIN  = Number(process.env.LATE_GRACE_MIN ?? '5');          // 지각 유예 (분)

/** 유틸: 휴대폰 마스킹 */
const maskPhone = (phone?: string | null) => {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11) return `${digits.slice(0,3)}****${digits.slice(7)}`;
  if (digits.length === 10) return `${digits.slice(0,3)}***${digits.slice(7)}`;
  return phone.replace(/(\d{2,3})\d{3,4}(\d{4})/, '$1****$2');
};

/** ───────── KST 시간대 유틸 ───────── */
const toKst = (d: Date) => new Date(d.getTime() + 9 * 60 * 60 * 1000);
const fromKstParts = (y: number, m1: number, d: number, hh=0, mm=0, ss=0, ms=0) =>
  new Date(Date.UTC(y, m1, d, hh - 9, mm, ss, ms));

const startOfKstDay = (anchor: Date) => {
  const k = toKst(anchor);
  return fromKstParts(k.getUTCFullYear(), k.getUTCMonth(), k.getUTCDate(), 0, 0, 0, 0);
};
const endOfKstDay = (anchor: Date) => {
  const k = toKst(anchor);
  return fromKstParts(k.getUTCFullYear(), k.getUTCMonth(), k.getUTCDate(), 23, 59, 59, 999);
};

const kstRangeForMonth = (year: number, month: number) => {
  const start = fromKstParts(year, month - 1, 1);
  const nextMonthFirst = fromKstParts(year, month, 1);
  const end = new Date(nextMonthFirst.getTime() - 1);
  return { start, end };
};

const kstCycleRange = (anchor: Date, startDay: number) => {
  const kst = toKst(anchor);
  let y = kst.getUTCFullYear();
  let m = kst.getUTCMonth() + 1; // 1~12
  const d = kst.getUTCDate();
  if (d < startDay) { if (m === 1) { y -= 1; m = 12; } else { m -= 1; } }
  const start = fromKstParts(y, m - 1, startDay);
  let ny = y, nm = m + 1; if (nm === 13) { nm = 1; ny += 1; }
  const nextStart = fromKstParts(ny, nm - 1, startDay);
  const end = new Date(nextStart.getTime() - 1);
  return { start, end };
};

const formatKstLabel = (d: Date) => {
  const dd = toKst(d);
  return `${dd.getUTCMonth() + 1}월 ${dd.getUTCDate()}일`;
};

/** ───────── 분 계산 유틸 ───────── */
const diffMinutes = (a: Date, b: Date) => Math.max(0, Math.floor((b.getTime() - a.getTime()) / 60000));
const intersectMinutes = (a0: Date, a1: Date, b0: Date, b1: Date) => {
  const st = a0 > b0 ? a0 : b0;
  const en = a1 < b1 ? a1 : b1;
  if (en <= st) return 0;
  return diffMinutes(st, en);
};

/** Shop.payday(1~28)를 우선 사용 */
const resolveCycleStartDay = async (shopId: number) => {
  const shop = await prisma.shop.findUnique({ where: { id: shopId }, select: { payday: true } });
  return shop?.payday ?? DEFAULT_CYCLE_START_DAY;
};

/** 지난 사이클 정산 여부 */
type PaidInfo = { status: 'PAID' | 'PENDING'; settledAt: Date | null };

const findPaidInfoForCycle = async (shopId: number, employeeId: number, start: Date, end: Date): Promise<PaidInfo> => {
  // Prisma 모델이 있으면 정식 사용
  if ((prisma as any).payrollSettlement?.findFirst) {
    const row = await (prisma as any).payrollSettlement.findFirst({
      where: { shopId, employeeId, cycleStart: start, cycleEnd: end },
      select: { settledAt: true }
    });
    return row ? { status: 'PAID', settledAt: row.settledAt } : { status: 'PENDING', settledAt: null };
  }
  // 없으면 존재 여부 확인 후 RAW
  const reg: Array<{ exists: boolean }> = await prisma.$queryRaw`
    SELECT to_regclass('public."PayrollSettlement"') IS NOT NULL AS exists
  `;
  if (!reg?.[0]?.exists) return { status: 'PENDING', settledAt: null };
  const rows: Array<{ settledAt: Date }> = await prisma.$queryRaw`
    SELECT "settledAt"
    FROM "PayrollSettlement"
    WHERE "shopId" = ${shopId}
      AND "employeeId" = ${employeeId}
      AND "cycleStart" = ${start}
      AND "cycleEnd"   = ${end}
    ORDER BY "settledAt" DESC
    LIMIT 1
  `;
  return rows.length ? { status: 'PAID', settledAt: rows[0].settledAt } : { status: 'PENDING', settledAt: null };
};

/** ───────── Zod ───────── */
const schema = z.object({
  anchor: z.string().datetime().optional(),
  cycleStartDay: z.coerce.number().int().min(1).max(28).optional(),
});

/** ───────── Controller: /api/my/settlement ───────── */
export const mySettlementSummary = async (req: AuthRequiredRequest, res: Response) => {
  const parsed = schema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ ok: false, code: 'INVALID_PARAM', message: 'Invalid query' });
    return;
  }
  const anchor = parsed.data.anchor ? new Date(parsed.data.anchor) : new Date();

  const employeeId = req.user.userId;
  const shopId     = req.user.shopId;

  const cycleStartDay = parsed.data.cycleStartDay ?? await resolveCycleStartDay(shopId);

  // ── 사이클 계산 (현재/직전)
  const currentCycle  = kstCycleRange(anchor, cycleStartDay);
  const prevAnchor    = new Date(currentCycle.start.getTime() - 24*60*60*1000);
  const previousCycle = kstCycleRange(prevAnchor, cycleStartDay);

  // ── 달력 기준 월 범위
  const kstAnchor   = toKst(anchor);
  const monthY      = kstAnchor.getUTCFullYear();
  const monthM      = kstAnchor.getUTCMonth() + 1;
  const monthRange  = kstRangeForMonth(monthY, monthM);

  // ── 직원 정보
  const emp = await prisma.employee.findFirst({
    where: { id: employeeId, shopId },
    select: {
      name: true, section: true, position: true,
      pay: true, payUnit: true,
      phone: true, bank: true, accountNumber: true
    }
  });
  if (!emp) {
    res.status(404).json({ ok: false, code: 'NOT_FOUND', message: 'Employee not found' });
    return;
  }

  const perMinute = emp.payUnit === 'HOURLY' ? (emp.pay / 60) : 0;

  // ── WorkShift 기반 집계
  // 기준: actualInAt & actualOutAt(완결된 시프트)만 금액·분 집계
  const [curShifts, prevShifts, monthShiftsCompleted, monthShiftsAll] = await Promise.all([
    prisma.workShift.findMany({
      where: {
        shopId, employeeId,
        actualInAt:  { gte: currentCycle.start,  lte: currentCycle.end },
        actualOutAt: { not: null }
      },
      select: { startAt: true, endAt: true, actualInAt: true, actualOutAt: true }
    }),
    prisma.workShift.findMany({
      where: {
        shopId, employeeId,
        actualInAt:  { gte: previousCycle.start, lte: previousCycle.end },
        actualOutAt: { not: null }
      },
      select: { startAt: true, endAt: true, actualInAt: true, actualOutAt: true }
    }),
    prisma.workShift.findMany({
      where: {
        shopId, employeeId,
        actualInAt:  { gte: monthRange.start, lte: monthRange.end },
        actualOutAt: { not: null }
      },
      select: { startAt: true, endAt: true, actualInAt: true, actualOutAt: true }
    }),
    // 지각/결근 판정을 위해 월 내 "모든" 시프트(취소 제외)
    prisma.workShift.findMany({
      where: {
        shopId, employeeId,
        startAt: { lt: endOfKstDay(monthRange.end) },
        endAt:   { gt: startOfKstDay(monthRange.start) },
        // 취소된 시프트는 제외(있다면)
        NOT: [{ status: 'CANCELED' as any }]
      },
      select: { startAt: true, endAt: true, actualInAt: true, status: true }
    })
  ]);

  const sumPayable = (rows: Array<{ startAt: Date; endAt: Date; actualInAt: Date | null; actualOutAt: Date | null }>) =>
    rows.reduce((acc, r) => {
      if (!r.actualInAt || !r.actualOutAt) return acc;
      return acc + intersectMinutes(r.actualInAt, r.actualOutAt, r.startAt, r.endAt);
    }, 0);

  const curMinutes  = sumPayable(curShifts);
  const prvMinutes  = sumPayable(prevShifts);
  const monMinutes  = sumPayable(monthShiftsCompleted);

  // ── 급여 계산 (연장/야근 가산 없음 — 순수 인정분)
  const calcPay = (workedMinutes: number) => {
    if (emp.payUnit === 'MONTHLY') {
      return { basePay: emp.pay, totalPay: emp.pay };
    }
    const basePay  = Math.round(perMinute * workedMinutes);
    const totalPay = basePay;
    return { basePay, totalPay };
  };

  const curPay = calcPay(curMinutes);
  const prvPay = calcPay(prvMinutes);
  const monPay = calcPay(monMinutes);

  // ── 월 통계: 출근일(실제 IN 있는 날)
  const presentDays = new Set<string>();
  for (const s of monthShiftsCompleted) {
    if (!s.actualInAt) continue;
    const kst = toKst(s.actualInAt);
    const key = `${kst.getUTCFullYear()}-${String(kst.getUTCMonth() + 1).padStart(2, '0')}-${String(kst.getUTCDate()).padStart(2, '0')}`;
    presentDays.add(key);
  }

  // ── 월 통계: 지각/결근 (시프트 기준)
  //   · 결근: 월 내 시프트인데 actualInAt 없음
  //   · 지각: actualInAt > (startAt + graceInMin(시프트별) or DEFAULT_LATE_GRACE_MIN)
  let lateCount = 0;
  let absentCount = 0;
  for (const s of monthShiftsAll) {
    if (!s.actualInAt) {
      absentCount += 1;
      continue;
    }
    const graceMs = (1) * 60_000;
    if (s.actualInAt.getTime() > s.startAt.getTime() + graceMs) {
      lateCount += 1;
    }
  }

  /** (선택) 지난 사이클 정산 여부 조회 */
  const paidPrev = await findPaidInfoForCycle(shopId, employeeId, previousCycle.start, previousCycle.end);

  // ── 응답
  res.json({
    ok: true,

    /** 👤 개인 정보(마이페이지 상단) */
    profile: {
      name: emp.name,
      section: emp.section,
      position: emp.position,
      pay: emp.pay,
      payUnit: emp.payUnit,     // 'MONTHLY' | 'HOURLY'
      phoneMasked: maskPhone(emp.phone),
      bank: emp.bank || null,
      bankRegistered: !!emp.bank && !!emp.accountNumber
    },

    /** 💳 정산 정보 카드(사이클 기준) */
    cycle: {
      start: currentCycle.start,
      end: currentCycle.end,
      label: `${formatKstLabel(currentCycle.start)} ~ ${formatKstLabel(currentCycle.end)}`,
      startDay: cycleStartDay
    },
    cards: {
      current: {
        amount: curPay.totalPay,   // 이번 사이클 예상 금액
        status: 'PENDING' as const,
        cycleStart: currentCycle.start,
        cycleEnd: currentCycle.end
      },
      previous: {
        amount: prvPay.totalPay,   // 지난 사이클 금액
        status: paidPrev.status,   // 'PAID' | 'PENDING'
        cycleStart: previousCycle.start,
        cycleEnd: previousCycle.end,
        settledAt: paidPrev.settledAt
      }
    },

    /** 💰 이번 달 급여 정보(달력 기준, 인정분 합산) */
    month: {
      year: monthY, month: monthM,
      workedMinutes: monMinutes,
      workedHours: Math.round((monMinutes / 60) * 10) / 10,
      basePay: monPay.basePay,
      totalPay: monPay.totalPay
    },

    /** 📈 출근 통계(달력 기준, 시프트 기준) */
    stats: {
      presentDays: presentDays.size,
      lateCount,
      absentCount
    }
  });
};
