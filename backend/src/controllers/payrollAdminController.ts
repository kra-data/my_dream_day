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
// 1) 급여 대시보드
export const payrollDashboard: RequestHandler = async (req, res) => {
  const shopId = Number(req.params.shopId);
  const today   = new Date();
  const parsed  = ymQuerySchema.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: 'Invalid year/month' }); return; }
  const yy      = Number(parsed.data.year  ?? today.getFullYear());
  const mm      = Number(parsed.data.month ?? today.getMonth() + 1);

  const { start, end } = getMonthRange(yy, mm);
  const { start: lmStart, end: lmEnd } = getMonthRange(mm === 1 ? yy - 1 : yy, mm === 1 ? 12 : mm - 1);

  const curMonth = await prisma.attendanceRecord.groupBy({
    by: ['employeeId'],
    where: { shopId, clockInAt: { gte: start, lte: end }, paired: true },
    _sum: { workedMinutes: true }
  });

  const prevMonth = await prisma.attendanceRecord.groupBy({
    by: ['employeeId'],
    where: { shopId, clockInAt: { gte: lmStart, lte: lmEnd }, paired: true },
    _sum: { workedMinutes: true }
  });

  const employees = await prisma.employee.findMany({
    where: { shopId },
    select: { id:true, pay:true, payUnit:true }
  });
  const byId = Object.fromEntries(employees.map(e => [e.id, e]));

  const calcTotal = (records: typeof curMonth) =>
    records.reduce((sum, r) => {
      const emp = byId[r.employeeId];
      if (!emp) return sum;
      const sal = emp.payUnit === 'HOURLY'
        ? (emp.pay / 60) * (r._sum.workedMinutes ?? 0)
        : emp.pay;
      return sum + sal;
    }, 0);

  res.json({
    year: yy, month: mm,
    expectedExpense: calcTotal(curMonth),
    lastMonthExpense: calcTotal(prevMonth),
    employeeCount: employees.length,
    totalWorkedMinutes: curMonth.reduce((s,r)=>s+(r._sum.workedMinutes??0),0)
  });
};

// 2) 직원별 급여 목록
export const payrollByEmployee: RequestHandler = async (req, res) => {
  const shopId = Number(req.params.shopId);
  const today  = new Date();
  const parsed = ymQuerySchema.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: 'Invalid year/month' }); return; }
  const yy     = Number(parsed.data.year  ?? today.getFullYear());
  const mm     = Number(parsed.data.month ?? today.getMonth() + 1);

  // 달력 범위 (근무시간 합산용)
  const { start, end } = getMonthRange(yy, mm);

  // 🔹 정산 사이클(매장 payday 기준) 계산: 그 달의 15일을 앵커로
  const startDay = await resolveCycleStartDay(shopId);
  const anchor   = fromKstParts(yy, mm - 1, 15); // KST 기준 그 달 중간
  const cycle    = kstCycleRange(anchor, startDay);

  // 근무시간 집계
  const grouped = await prisma.attendanceRecord.groupBy({
    by: ['employeeId'],
    where: { shopId, clockInAt:{ gte:start, lte:end }, paired:true },
    _sum: { workedMinutes:true, extraMinutes:true }
  });

  // 직원 프로필
  const employees = await prisma.employee.findMany({
    where: { shopId },
    select: { id:true, name:true, position:true, pay:true, payUnit:true }
  });
  const byId = Object.fromEntries(employees.map(e=>[e.id,e]));

  // 🔹 해당 사이클의 정산 스냅샷 전량 조회
  const settlements = await prisma.payrollSettlement.findMany({
    where: {
      shopId,
      cycleStart: cycle.start,
      cycleEnd:   cycle.end
    },
    select: { id:true, employeeId:true, totalPay:true, settledAt:true }
  });
  const settleByEmp = new Map(settlements.map(s => [s.employeeId, s]));

  const rows = grouped.map(g => {
    const emp = byId[g.employeeId];
    const minutes = g._sum.workedMinutes ?? 0;
    const extras  = g._sum.extraMinutes  ?? 0;
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
      extraMinutes:  extras,
      expectedSalary,                  // 계산상 예상 급여
      settlementStatus: st ? 'PAID' : 'PENDING',
      settlementTotalPay: st?.totalPay ?? null, // 정산 완료 시 확정 금액
      settledAt: st?.settledAt ?? null
    };
  });

  res.json({
    year:yy, month:mm,
    cycle: { start: cycle.start, end: cycle.end, startDay },
    employees: rows
  });
};
// 3) 직원 월별 급여 상세
export const payrollEmployeeDetail: RequestHandler = async (req, res) => {
  const shopId     = Number(req.params.shopId);
  const employeeId = Number(req.params.employeeId);
  const today      = new Date();
  const parsed     = ymQuerySchema.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: 'Invalid year/month' }); return; }
  const yy         = Number(parsed.data.year  ?? today.getFullYear());
  const mm         = Number(parsed.data.month ?? today.getMonth() + 1);

  // 달력 범위 (근무 상세/합산용)
  const { start, end } = getMonthRange(yy, mm);

  // 🔹 정산 사이클 계산
  const startDay = await resolveCycleStartDay(shopId);
  const anchor   = fromKstParts(yy, mm - 1, 15);
  const cycle    = kstCycleRange(anchor, startDay);

  // 직원
  const emp = await prisma.employee.findFirst({
    where: { id: employeeId, shopId },
    select: { name:true, position:true, pay:true, payUnit:true }
  });
  if (!emp) { res.status(404).json({ error: 'Employee not found' }); return; }

  // 근무 로그
  const logs = await prisma.attendanceRecord.findMany({
    where: { employeeId, shopId, clockInAt:{ gte:start, lte:end }, paired:true },
    orderBy: { clockInAt:'asc' }
  });

  const worked = logs.reduce((s,l)=>s+(l.workedMinutes??0),0);
  const extras = logs.reduce((s,l)=>s+(l.extraMinutes ??0),0);
  const expectedSalary = emp.payUnit === 'HOURLY'
    ? Math.round((emp.pay / 60) * worked)
    : emp.pay;

  // 🔹 해당 사이클 정산 스냅샷(있으면 확정, 없으면 미정산)
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
    year:yy, month:mm,
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
    extraMinutes: extras,
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
    logs: logs.map(l=>({
      date: l.clockInAt ? l.clockInAt.toISOString().slice(0, 10) : null,
      clockInAt:  l.clockInAt,
      clockOutAt: l.clockOutAt,
      workedMinutes: l.workedMinutes,
      extraMinutes:  l.extraMinutes
    }))
  });
};
