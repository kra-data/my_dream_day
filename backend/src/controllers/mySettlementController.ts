// controllers/mySettlementController.ts
import { Response } from 'express';
import { prisma } from '../db/prisma';
import { AuthRequiredRequest } from '../middlewares/requireUser';
import { z } from 'zod';

/** ───────── 설정값 (필요 시 .env로 분리) ───────── */
const DEFAULT_CYCLE_START_DAY = Number(process.env.SETTLEMENT_CYCLE_START_DAY ?? 7); // 매월 7일 시작 ~ 다음달 6일 종료
const DEFAULT_LATE_GRACE_MIN = Number(process.env.LATE_GRACE_MIN ?? '5'); // 지각 유예

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

/** Shop.payday(1~28)를 우선 사용 */
const resolveCycleStartDay = async (shopId: number) => {
  const shop = await prisma.shop.findUnique({ where: { id: shopId }, select: { payday: true } });
  return shop?.payday ?? DEFAULT_CYCLE_START_DAY;
};


type PaidInfo = { status: 'PAID' | 'PENDING'; settledAt: Date | null };

const findPaidInfoForCycle = async (shopId: number, employeeId: number, start: Date, end: Date): Promise<PaidInfo> => {
  if ((prisma as any).payrollSettlement?.findFirst) {
    const row = await (prisma as any).payrollSettlement.findFirst({
      where: { shopId, employeeId, cycleStart: start, cycleEnd: end },
      select: { settledAt: true }
    });
    return row ? { status: 'PAID', settledAt: row.settledAt } : { status: 'PENDING', settledAt: null };
  }
  // 모델 없을 때는 기존 $queryRaw 방식 유지 (당신 코드 그대로 두셔도 됩니다)
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


/** 스케줄 파서 */
type DaySpec = { startMin: number; endMin: number; graceMin: number } | null;
const WKEYS: Array<'sun'|'mon'|'tue'|'wed'|'thu'|'fri'|'sat'> = ['sun','mon','tue','wed','thu','fri','sat'];
const toMin = (hhmm: string) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm); if (!m) return null;
  const hh = +m[1], mm = +m[2];
  if (hh<0 || hh>23 || mm<0 || mm>59) return null;
  return hh*60 + mm;
};
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
    const grace = Number.isFinite(pick?.graceMin) ? Number(pick.graceMin) : DEFAULT_LATE_GRACE_MIN;
    out[i] = { startMin, endMin, graceMin: grace };
  }
  return out;
};

const kstDow = (d: Date) => toKst(d).getUTCDay();
const minutesOfDayKst = (d: Date) => { const t = toKst(d); return t.getUTCHours()*60 + t.getUTCMinutes(); };

const schema = z.object({
  anchor: z.string().datetime().optional(),
  cycleStartDay: z.coerce.number().int().min(1).max(28).optional(),
});

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
  const currentCycle = kstCycleRange(anchor, cycleStartDay);
  const prevAnchor   = new Date(currentCycle.start.getTime() - 24*60*60*1000);
  const previousCycle= kstCycleRange(prevAnchor, cycleStartDay);

  // ── 달력 기준 월 범위
  const kstAnchor = toKst(anchor);
  const monthY = kstAnchor.getUTCFullYear();
  const monthM = kstAnchor.getUTCMonth() + 1;
  const monthRange = kstRangeForMonth(monthY, monthM);

  // ── 직원 정보
  const emp = await prisma.employee.findFirst({
    where: { id: employeeId, shopId },
    select: {
      name: true, section: true, position: true,
      pay: true, payUnit: true,
      phone: true, bank: true, accountNumber: true,
      schedule: true
    }
  });
  if (!emp) {
    res.status(404).json({ ok: false, code: 'NOT_FOUND', message: 'Employee not found' });
    return;
  }

  const perMinute = emp.payUnit === 'HOURLY' ? (emp.pay / 60) : 0;

  // ── Prisma 조회(모두 paired = true만 집계) — overtime 관련 컬럼/로직 제거
  const [curLogs, prevLogs, monthLogs] = await Promise.all([
    prisma.attendanceRecord.findMany({
      where: { shopId, employeeId, paired: true, clockInAt: { gte: currentCycle.start,  lte: currentCycle.end } },
      select: { workedMinutes: true }
    }),
    prisma.attendanceRecord.findMany({
      where: { shopId, employeeId, paired: true, clockInAt: { gte: previousCycle.start, lte: previousCycle.end } },
      select: { workedMinutes: true }
    }),
    prisma.attendanceRecord.findMany({
      where: { shopId, employeeId, /*paired: true,*/ clockInAt: { gte: monthRange.start, lte: monthRange.end } },
      select: { workedMinutes: true, clockInAt: true }
    })
  ]);

  const sumMinutes = (arr: { workedMinutes: number | null }[]) =>
    arr.reduce((s, r) => s + (r.workedMinutes ?? 0), 0);

  const curMinutes = sumMinutes(curLogs);
  const prvMinutes = sumMinutes(prevLogs);
  const monMinutes = sumMinutes(monthLogs);

  // ── 급여 계산 (연장/야근 제거 → 순수 근무시간만)
  const calcPay = (workedMinutes: number) => {
    if (emp.payUnit === 'MONTHLY') {
      return { basePay: emp.pay, totalPay: emp.pay };
    }
    const basePay = Math.round(perMinute * workedMinutes);
    const totalPay = basePay;
    return { basePay, totalPay };
  };

  const curPay = calcPay(curMinutes);
  const prvPay = calcPay(prvMinutes);
  const monPay = calcPay(monMinutes);

  // ── 월 통계(출근일만; 야근 제거)
  const presentDays = new Set<string>();
  for (const l of monthLogs) {
    if (!l.clockInAt) continue;
    const kst = toKst(l.clockInAt);
    const key = `${kst.getUTCFullYear()}-${String(kst.getUTCMonth() + 1).padStart(2, '0')}-${String(kst.getUTCDate()).padStart(2, '0')}`;
    presentDays.add(key);
  }

  // ── 지각/결근 계산(스케줄 기반)
  const weekly = parseSchedule(emp.schedule as any);

  // 날짜별 최조 출근시각(분)
  const earliestInByDate = new Map<string, number>(); // 'YYYY-MM-DD' -> minutesOfDayKst
  for (const l of monthLogs) {
    if (!l.clockInAt) continue;
    const kst = toKst(l.clockInAt);
    const y = kst.getUTCFullYear(), m = kst.getUTCMonth()+1, d = kst.getUTCDate();
    const key = `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const minOfDay = minutesOfDayKst(l.clockInAt);
    const curMin = earliestInByDate.get(key);
    if (curMin == null || minOfDay < curMin) earliestInByDate.set(key, minOfDay);
  }

  let lateCount = 0;
  let absentCount = 0;

  // 월 범위 KST day-by-day 스캔
  for (let t = monthRange.start.getTime(); t <= monthRange.end.getTime(); ) {
    const d = new Date(t);
    const dK = toKst(d);
    const y = dK.getUTCFullYear(), m = dK.getUTCMonth()+1, day = dK.getUTCDate();
    const key = `${y}-${String(m).padStart(2,'0')}-${String(day).padStart(2,'0')}`;

    const dow = kstDow(d);
    const spec = weekly[dow];
    if (spec) {
      const plannedStart = spec.startMin;
      const plannedGrace = spec.graceMin ?? DEFAULT_LATE_GRACE_MIN;
      const cutoff = plannedStart + plannedGrace;
      const firstIn = earliestInByDate.get(key);
      if (firstIn == null) {
        absentCount += 1;
      } else if (firstIn > cutoff) {
        lateCount += 1;
      }
    }
    // 다음 날짜 (KST 자정)
    const next = fromKstParts(y, m-1, day+1).getTime();
    t = next;
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

    /** 💰 이번 달 급여 정보(달력 기준, 연장 제거) */
    month: {
      year: monthY, month: monthM,
      workedMinutes: monMinutes,
      workedHours: Math.round((monMinutes / 60) * 10) / 10,
      basePay: monPay.basePay,
      totalPay: monPay.totalPay
    },

    /** 📈 출근 통계(달력 기준, 야근 제거) */
    stats: {
      presentDays: presentDays.size,
      lateCount,
      absentCount
    }
  });
};
