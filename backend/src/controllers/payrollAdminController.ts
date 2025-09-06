import { RequestHandler } from 'express';
import { prisma } from '../db/prisma';
import { AuthRequest } from '../middlewares/jwtMiddleware';
import { z } from 'zod';

/* ───────── KST & 사이클 유틸 ───────── */
const toKst = (d: Date) => new Date(d.getTime() + 9 * 60 * 60 * 1000);
const fromKstParts = (y: number, m1: number, d: number, hh=0, mm=0, ss=0, ms=0) =>
  new Date(Date.UTC(y, m1, d, hh - 9, mm, ss, ms));

const kstCycleRange = (anchor: Date, startDay: number) => {
  const kst = toKst(anchor);
  let y = kst.getUTCFullYear();
  let m = kst.getUTCMonth() + 1;
  const day = kst.getUTCDate();
  if (day < startDay) { if (m === 1) { y -= 1; m = 12; } else { m -= 1; } }
  const start = fromKstParts(y, m - 1, startDay);
  let ny = y, nm = m + 1; if (nm === 13) { nm = 1; ny += 1; }
  const nextStart = fromKstParts(ny, nm - 1, startDay);
  const end = new Date(nextStart.getTime() - 1);
  return { start, end };
};

const ymQuerySchema = z.object({
  year: z.coerce.number().int().min(1970).max(2100).optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
});

const resolveCycleStartDay = async (shopId: number) => {
  const shop = await prisma.shop.findUnique({ where: { id: shopId }, select: { payday: true } });
  const DEFAULT_CYCLE_START_DAY = Number(process.env.SETTLEMENT_CYCLE_START_DAY ?? 7);
  return shop?.payday ?? DEFAULT_CYCLE_START_DAY;
};

/* ───────── 유틸: KST 기준 월 시작·끝 반환 ───────── */
const getMonthRange = (year: number, month: number) => {
  // month: 1~12
  const start = new Date(Date.UTC(year, month - 1, 1, -9, 0, 0, 0));  // KST 00:00
  const end   = new Date(Date.UTC(year, month, 1, -9, 0, 0, -1));     // 말일 23:59:59
  return { start, end };
};

/* ───────── 인정 분 계산 ───────── */
const diffMinutes = (a: Date, b: Date) => Math.max(0, Math.floor((+b - +a) / 60000));
const intersectMinutes = (a0: Date, a1: Date, b0: Date, b1: Date) => {
  const st = a0 > b0 ? a0 : b0;
  const en = a1 < b1 ? a1 : b1;
  return en > st ? diffMinutes(st, en) : 0;
};

/* ─────────────────────────────────────────
 * 1) 급여 대시보드  GET /api/admin/shops/:shopId/payroll/dashboard
 *    - 이번 달/지난 달 인정 분 합산 → 예상 비용 계산
 * ─────────────────────────────────────────*/
export const payrollDashboard: RequestHandler = async (req, res) => {
  const shopId = Number(req.params.shopId);
  const today  = new Date();

  const parsed = ymQuerySchema.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: 'Invalid year/month' }); return; }

  const yy = Number(parsed.data.year  ?? today.getFullYear());
  const mm = Number(parsed.data.month ?? today.getMonth() + 1);

  const { start, end } = getMonthRange(yy, mm);
  const { start: lmStart, end: lmEnd } = getMonthRange(mm === 1 ? yy - 1 : yy, mm === 1 ? 12 : mm - 1);

  // 해당 월/지난 달의 "완결된" 시프트 전부 조회
  const [curShifts, prevShifts, employees] = await Promise.all([
    prisma.workShift.findMany({
      where: {
        shopId,
        // 월 집계는 IN 시각을 월 범위로 필터 (기존 attendanceRecord.clockInAt과 동작 유사)
        actualInAt:  { gte: start, lte: end },
        actualOutAt: { not: null }
      },
      select: { employeeId: true, startAt: true, endAt: true, actualInAt: true, actualOutAt: true }
    }),
    prisma.workShift.findMany({
      where: {
        shopId,
        actualInAt:  { gte: lmStart, lte: lmEnd },
        actualOutAt: { not: null }
      },
      select: { employeeId: true, startAt: true, endAt: true, actualInAt: true, actualOutAt: true }
    }),
    prisma.employee.findMany({
      where: { shopId },
      select: { id: true, pay: true, payUnit: true }
    })
  ]);

  const empMap = new Map(employees.map(e => [e.id, e]));

  const sumByEmp = (rows: typeof curShifts) => {
    const map = new Map<number, number>(); // empId -> minutes
    for (const s of rows) {
      if (!s.actualInAt || !s.actualOutAt) continue;
      const mins = intersectMinutes(s.actualInAt, s.actualOutAt, s.startAt, s.endAt);
      map.set(s.employeeId, (map.get(s.employeeId) ?? 0) + mins);
    }
    return map;
  };

  const curMap = sumByEmp(curShifts);
  const prevMap = sumByEmp(prevShifts);

  const calcTotal = (m: Map<number, number>) => {
    let total = 0;
    for (const [empId, minutes] of m) {
      const emp = empMap.get(empId);
      if (!emp) continue;
      if (emp.payUnit === 'HOURLY') total += (emp.pay / 60) * minutes;
      else total += emp.pay; // 월급제: 그 달에 근무 내역이 있으면 1회 반영 (기존 로직과 동일한 성격)
    }
    return Math.round(total);
  };

  const totalWorkedMinutes = Array.from(curMap.values()).reduce((a,b)=>a+b,0);

  res.json({
    year: yy,
    month: mm,
    expectedExpense: calcTotal(curMap),
    lastMonthExpense: calcTotal(prevMap),
    employeeCount: employees.length,
    totalWorkedMinutes
  });
};

/* ─────────────────────────────────────────
 * 2) 직원별 급여 목록  GET /api/admin/shops/:shopId/payroll/employees
 *    - 월 범위 인정 분 합산 + 사이클 정산 여부 표시
 * ─────────────────────────────────────────*/
export const payrollByEmployee: RequestHandler = async (req, res) => {
  const shopId = Number(req.params.shopId);
  const today  = new Date();

  const parsed = ymQuerySchema.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: 'Invalid year/month' }); return; }

  const yy = Number(parsed.data.year  ?? today.getFullYear());
  const mm = Number(parsed.data.month ?? today.getMonth() + 1);

  // 달력 범위 (근무시간 합산용)
  const { start, end } = getMonthRange(yy, mm);

  // 정산 사이클(매장 payday 기준) — 그 달의 15일을 앵커로
  const startDay = await resolveCycleStartDay(shopId);
  const anchor   = fromKstParts(yy, mm - 1, 15);
  const cycle    = kstCycleRange(anchor, startDay);

  // 월 내 완결된 시프트 조회 → 직원별 인정 분 합산
  const shifts = await prisma.workShift.findMany({
    where: {
      shopId,
      actualInAt:  { gte: start, lte: end },
      actualOutAt: { not: null }
    },
    select: { employeeId: true, startAt: true, endAt: true, actualInAt: true, actualOutAt: true }
  });

  const minutesByEmp = new Map<number, number>();
  for (const s of shifts) {
    if (!s.actualInAt || !s.actualOutAt) continue;
    const mins = intersectMinutes(s.actualInAt, s.actualOutAt, s.startAt, s.endAt);
    minutesByEmp.set(s.employeeId, (minutesByEmp.get(s.employeeId) ?? 0) + mins);
  }

  // 직원 프로필
  const employees = await prisma.employee.findMany({
    where: { shopId },
    select: { id:true, name:true, position:true, pay:true, payUnit:true }
  });
  const byId = new Map(employees.map(e=>[e.id,e]));

  // 해당 사이클 정산 스냅샷
  const settlements = await prisma.payrollSettlement.findMany({
    where: { shopId, cycleStart: cycle.start, cycleEnd: cycle.end },
    select: { id:true, employeeId:true, totalPay:true, settledAt:true }
  });
  const settleByEmp = new Map(settlements.map(s => [s.employeeId, s]));

  // 응답 rows 구성
  const rows = employees
    .filter(emp => minutesByEmp.has(emp.id)) // 기존 로직과 유사하게, 월에 기록 없는 인원은 제외
    .map(emp => {
      const minutes = minutesByEmp.get(emp.id) ?? 0;
      const expectedSalary = emp.payUnit === 'HOURLY'
        ? Math.round((emp.pay / 60) * minutes)
        : emp.pay;

      const st = settleByEmp.get(emp.id);
      return {
        employeeId: emp.id,
        name:       emp.name,
        position:   emp.position,
        hourlyPay:  emp.payUnit === 'HOURLY' ? emp.pay : null,
        monthlyPay: emp.payUnit === 'MONTHLY' ? emp.pay : null,
        workedMinutes: minutes,
        extraMinutes:  0,
        expectedSalary,
        settlementStatus: st ? 'PAID' : 'PENDING',
        settlementTotalPay: st?.totalPay ?? null,
        settledAt: st?.settledAt ?? null
      };
    });

  res.json({
    year: yy,
    month: mm,
    cycle: { start: cycle.start, end: cycle.end, startDay },
    employees: rows
  });
};

/* ─────────────────────────────────────────
 * 3) 직원 월별 급여 상세
 *    GET /api/admin/shops/:shopId/payroll/employees/:employeeId
 * ─────────────────────────────────────────*/
export const payrollEmployeeDetail: RequestHandler = async (req, res) => {
  const shopId     = Number(req.params.shopId);
  const employeeId = Number(req.params.employeeId);
  const today      = new Date();

  const parsed = ymQuerySchema.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: 'Invalid year/month' }); return; }

  const yy = Number(parsed.data.year  ?? today.getFullYear());
  const mm = Number(parsed.data.month ?? today.getMonth() + 1);

  // 달력 범위
  const { start, end } = getMonthRange(yy, mm);

  // 정산 사이클
  const startDay = await resolveCycleStartDay(shopId);
  const anchor   = fromKstParts(yy, mm - 1, 15);
  const cycle    = kstCycleRange(anchor, startDay);

  // 직원
  const emp = await prisma.employee.findFirst({
    where: { id: employeeId, shopId },
    select: { name:true, position:true, pay:true, payUnit:true }
  });
  if (!emp) { res.status(404).json({ error: 'Employee not found' }); return; }

  // 월 내 해당 직원의 시프트(완결/미완 모두) 가져오고, 로그/합계 산출
  const shifts = await prisma.workShift.findMany({
    where: {
      shopId, employeeId,
      // 월에 걸친 시프트 전부 보여주되, 계산은 actual이 있을 때만
      startAt: { lt: new Date(Date.UTC(yy, mm, 1, -9, 0, 0, 0)) }, // 다음달 1일(KST 00:00) 이전 시작
      endAt:   { gt: new Date(Date.UTC(yy, mm - 1, 1, -9, 0, 0, 0)) } // 이번달 1일(KST 00:00) 이후 종료
    },
    orderBy: { startAt: 'asc' },
    select: { id:true, startAt:true, endAt:true, actualInAt:true, actualOutAt:true }
  });

  // 인정 분/상세 로그
  let worked = 0;
  const logs = shifts
    .filter(s => s.actualInAt && s.actualOutAt) // 완결된 시프트만 급여 집계
    .map(s => {
      const w = intersectMinutes(s.actualInAt!, s.actualOutAt!, s.startAt, s.endAt);
      worked += w;
      return {
        id: s.id,
        date: s.actualInAt ? s.actualInAt.toISOString().slice(0,10) : null,
        clockInAt:  s.actualInAt,
        clockOutAt: s.actualOutAt,
        workedMinutes: w,
        extraMinutes: 0
      };
    });

  const expectedSalary = emp.payUnit === 'HOURLY'
    ? Math.round((emp.pay / 60) * worked)
    : emp.pay;

  // 해당 사이클 정산 스냅샷(있으면 확정, 없으면 미정산)
  const settlement = await prisma.payrollSettlement.findUnique({
    where: {
      employeeId_cycleStart_cycleEnd: {
        employeeId,
        cycleStart: cycle.start,
        cycleEnd:   cycle.end
      }
    },
    select: {
      id:true, shopId:true, employeeId:true,
      cycleStart:true, cycleEnd:true,
      workedMinutes:true, basePay:true, totalPay:true,
      settledAt:true, processedBy:true
    }
  });

  res.json({
    year: yy,
    month: mm,
    cycle: { start: cycle.start, end: cycle.end, startDay },
    employee: {
      id: employeeId,
      name: emp.name,
      position: emp.position,
      hourlyPay:  emp.payUnit==='HOURLY'?emp.pay:null,
      monthlyPay: emp.payUnit==='MONTHLY'?emp.pay:null
    },
    daysWorked: logs.length,
    workedMinutes: worked,
    extraMinutes: 0,
    expectedSalary,
    settlementStatus: settlement ? 'PAID' : 'PENDING',
    settlement: settlement ? {
      id: settlement.id,
      totalPay: settlement.totalPay,
      basePay:  settlement.basePay,
      workedMinutes: settlement.workedMinutes,
      settledAt: settlement.settledAt,
      processedBy: settlement.processedBy
    } : null,
    logs
  });
};
