import { Response } from 'express';
import { prisma } from '../db/prisma';
import { AuthRequest } from '../middlewares/jwtMiddleware';

/* ── 월 범위 (KST) ── */
const getMonthRange = (y: number, m: number) => {
  const start = new Date(Date.UTC(y, m - 1, 1, -9, 0, 0, 0));
  const end   = new Date(Date.UTC(y, m,     1, -9, 0, 0, -1));
  return { start, end };
};
/* ── 주(요일) to index ── */
const weekday = ['sun','mon','tue','wed','thu','fri','sat'] as const;

/**
 * GET /api/admin/shops/:shopId/payroll/employees/:employeeId/summary
 *   ?year=2025&month=6
 */
export const employeePayrollSummary = async (req: AuthRequest, res: Response) :Promise<void>=> {
  const shopId     = Number(req.params.shopId);
  const employeeId = Number(req.params.employeeId);

  /* ── 파라미터(년·월) ── */
  const today  = new Date();
  const yy     = Number(req.query.year  ?? today.getFullYear());
  const mm     = Number(req.query.month ?? today.getMonth() + 1);
  const { start, end } = getMonthRange(yy, mm);

  /* ── 직원 정보 ── */
  const emp = await prisma.employee.findFirst({
    where: { id: employeeId, shopId },
    select: {
      name:true, position:true, section:true,
      pay:true, payUnit:true, schedule:true
    }
  });
  if (!emp) {res.status(404).json({ error: 'Employee not found' }); return;}

  /* ── 근무 레코드 (pair 완료) ── */
  const logs = await prisma.attendanceRecord.findMany({
    where: {
      shopId, employeeId, paired:true,
      clockInAt:{ gte:start, lte:end }
    },
    orderBy:{ clockInAt:'asc' }
  });

  /* ── 근무·연장·지각 집계 ── */
  const perDay = new Map<string, {late:boolean}>();
  let totalMin = 0, extraMin = 0, lateCnt = 0;

  logs.forEach(l => {
    const dStr = l.clockInAt!.toISOString().slice(0,10);  // YYYY-MM-DD
    totalMin += l.workedMinutes  ?? 0;
    extraMin += l.extraMinutes   ?? 0;

    /* 지각 판정 */
    const daySched = (emp.schedule as any)?.[weekday[new Date(l.clockInAt!).getDay()]];
    if (daySched && !perDay.has(dStr)) {
      const [sh, sm] = daySched.start.split(':').map(Number);
      const schedT   = new Date(l.clockInAt!); schedT.setHours(sh,sm,0,0);
      const isLate   = l.clockInAt! > schedT;
      perDay.set(dStr, { late:isLate });
      if (isLate) lateCnt++;
    }
  });

  const daysWorked  = perDay.size;

  /* ── 결근 계산 ── */
  let totalScheduled = 0;
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate()+1)) {
    const wk = weekday[d.getUTCDay()];
    if ((emp.schedule as any)?.[wk]) totalScheduled++;
  }
  const absentCnt = Math.max(totalScheduled - daysWorked, 0);

  /* ── 급여 계산 ── */
  const basic = emp.payUnit === 'HOURLY'
    ? (emp.pay / 60) * totalMin
    : emp.pay;

  const absenceDeduct = emp.payUnit === 'MONTHLY' && totalScheduled
    ? (emp.pay / totalScheduled) * absentCnt
    : 0;

  const taxDeduct = Math.round(basic * 0.033);      // 3.3% 원천세 예시
  const netSalary = basic - absenceDeduct - taxDeduct;

  res.json({
    year:yy, month:mm,
    employee:{
      id: employeeId,
      name: emp.name,
      section: emp.section,
      position: emp.position,
      hourlyPay:  emp.payUnit==='HOURLY'?emp.pay:null,
      monthlyPay: emp.payUnit==='MONTHLY'?emp.pay:null
    },
    workStats:{
      daysWorked,
      totalWorkedMinutes: totalMin,
      totalExtraMinutes:  extraMin,
      lateCount:  lateCnt,
      absentCount: absentCnt
    },
    payroll:{
      basicSalary:      basic,
      absenceDeduction: absenceDeduct,
      taxDeduction:     taxDeduct,
      netSalary
    }
  });
  return;
};
