import { Response } from 'express';
import { prisma } from '../db/prisma';
import { AuthRequest } from '../middlewares/jwtMiddleware';

/* ───────── 유틸: KST 기준 월 시작·끝 반환 ───────── */
const getMonthRange = (year: number, month: number) => {
  // month: 1~12
  const start = new Date(Date.UTC(year, month - 1, 1, -9, 0, 0, 0));  // KST 00:00
  const end   = new Date(Date.UTC(year, month, 1, -9, 0, 0, -1));     // 말일 23:59:59
  return { start, end };
};

/* ────────────────────────────────────────────────
 *  1) 급여 대시보드
 *     GET /api/admin/shops/:shopId/payroll/dashboard
 *     ?year=2025&month=6   (없으면 이번 달)
 * ────────────────────────────────────────────────*/
export const payrollDashboard = async (req: AuthRequest, res: Response) => {
  const shopId = Number(req.params.shopId);

  /* 오늘 날짜 */
  const today   = new Date();
  const yy      = Number(req.query.year  ?? today.getFullYear());
  const mm      = Number(req.query.month ?? today.getMonth() + 1);

  const { start, end }          = getMonthRange(yy, mm);
  const { start: lmStart, end: lmEnd } = getMonthRange(
    mm === 1 ? yy - 1 : yy,
    mm === 1 ? 12     : mm - 1
  );

  /* 1-1. 이번 달 근무 집계 */
  const curMonth = await prisma.attendanceRecord.groupBy({
    by: ['employeeId'],
    where: { shopId, clockInAt: { gte: start, lte: end }, paired: true },
    _sum: { workedMinutes: true }
  });

  /* 1-2. 지난 달 근무 집계 */
  const prevMonth = await prisma.attendanceRecord.groupBy({
    by: ['employeeId'],
    where: { shopId, clockInAt: { gte: lmStart, lte: lmEnd }, paired: true },
    _sum: { workedMinutes: true }
  });

  /* 1-3. 직원 급여 정보 */
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
    expectedExpense: calcTotal(curMonth), // 이번달 (현재까지) 지출 예측
    lastMonthExpense: calcTotal(prevMonth),
    employeeCount: employees.length,
    totalWorkedMinutes: curMonth.reduce((s,r)=>s+(r._sum.workedMinutes??0),0)
  });
};

/* ────────────────────────────────────────────────
 *  2) 직원별 급여 목록
 *     GET /api/admin/shops/:shopId/payroll/employees
 *     ?year=2025&month=6
 * ────────────────────────────────────────────────*/
export const payrollByEmployee = async (req: AuthRequest, res: Response) => {
  const shopId = Number(req.params.shopId);
  const today  = new Date();
  const yy     = Number(req.query.year  ?? today.getFullYear());
  const mm     = Number(req.query.month ?? today.getMonth() + 1);
  const { start, end } = getMonthRange(yy, mm);

  /* 근무시간 집계 */
  const grouped = await prisma.attendanceRecord.groupBy({
    by: ['employeeId'],
    where: { shopId, clockInAt:{ gte:start, lte:end }, paired:true },
    _sum: { workedMinutes:true, extraMinutes:true }
  });

  /* 직원 프로필 */
  const employees = await prisma.employee.findMany({
    where: { shopId },
    select: { id:true, name:true, position:true, pay:true, payUnit:true }
  });
  const byId = Object.fromEntries(employees.map(e=>[e.id,e]));

  const rows = grouped.map(g => {
    const emp = byId[g.employeeId];
    const minutes = g._sum.workedMinutes ?? 0;
    const extras  = g._sum.extraMinutes  ?? 0;
    const salary  = emp.payUnit === 'HOURLY'
      ? (emp.pay / 60) * minutes
      : emp.pay;
    return {
      employeeId: emp.id,
      name:       emp.name,
      position:   emp.position,
      hourlyPay:  emp.payUnit === 'HOURLY' ? emp.pay : null,
      monthlyPay: emp.payUnit === 'MONTHLY' ? emp.pay : null,
      workedMinutes: minutes,
      extraMinutes:  extras,
      salary
    };
  });

  res.json({ year:yy, month:mm, employees: rows });
};

/* ────────────────────────────────────────────────
 *  3) 직원 월별 급여 상세
 *     GET /api/admin/shops/:shopId/payroll/employees/:employeeId
 *     ?year=2025&month=6
 * ────────────────────────────────────────────────*/
export const payrollEmployeeDetail = async (req: AuthRequest, res: Response) => {
  const shopId     = Number(req.params.shopId);
  const employeeId = Number(req.params.employeeId);
  const today      = new Date();
  const yy         = Number(req.query.year  ?? today.getFullYear());
  const mm         = Number(req.query.month ?? today.getMonth() + 1);
  const { start, end } = getMonthRange(yy, mm);

  /* 직원 */
  const emp = await prisma.employee.findFirst({
    where: { id: employeeId, shopId },
    select: { name:true, position:true, pay:true, payUnit:true }
  });
  if (!emp) {
    res.status(404).json({ error: 'Employee not found' });
    return;
  }

  /* 근무 레코드 */
  const logs = await prisma.attendanceRecord.findMany({
    where: { employeeId, shopId, clockInAt:{ gte:start, lte:end }, paired:true },
    orderBy: { clockInAt:'asc' }
  });

  const worked = logs.reduce((s,l)=>s+(l.workedMinutes??0),0);
  const extras = logs.reduce((s,l)=>s+(l.extraMinutes ??0),0);
  const salary = emp.payUnit === 'HOURLY'
    ? (emp.pay / 60) * worked
    : emp.pay;

  res.json({
    year:yy, month:mm,
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
    salary,
    logs: logs.map(l=>({
      date: l.clockInAt ? l.clockInAt.toISOString().slice(0, 10) : null,
      clockInAt:  l.clockInAt,
      clockOutAt: l.clockOutAt,
      workedMinutes: l.workedMinutes,
      extraMinutes:  l.extraMinutes
    }))
  });
};
