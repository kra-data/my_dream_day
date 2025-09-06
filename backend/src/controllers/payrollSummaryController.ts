import { Response } from 'express';
import { prisma } from '../db/prisma';
import { AuthRequest } from '../middlewares/jwtMiddleware';
import { z } from 'zod';

/* ── 월 범위 (KST) ── */
const getMonthRange = (y: number, m: number) => {
  const start = new Date(Date.UTC(y, m - 1, 1, -9, 0, 0, 0));
  const end   = new Date(Date.UTC(y, m,     1, -9, 0, 0, -1));
  return { start, end };
};
/* ── KST 유틸 ── */
const toKst = (d: Date) => new Date(d.getTime() + 9 * 60 * 60 * 1000);
const kstDateKey = (d: Date) => {
  const k = toKst(d);
  const y = k.getUTCFullYear();
  const m = String(k.getUTCMonth() + 1).padStart(2, '0');
  const day = String(k.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};
/* ── 요일 키 ── */
const weekday = ['sun','mon','tue','wed','thu','fri','sat'] as const;

/* ── 분 계산 ── */
const diffMinutes = (a: Date, b: Date) =>
  Math.max(0, Math.floor((b.getTime() - a.getTime()) / 60000));

const intersectMinutes = (a0: Date, a1: Date, b0: Date, b1: Date) => {
  const st = a0 > b0 ? a0 : b0;
  const en = a1 < b1 ? a1 : b1;
  if (en <= st) return 0;
  return diffMinutes(st, en);
};

/**
 * GET /api/admin/shops/:shopId/payroll/employees/:employeeId/summary
 *   ?year=2025&month=6
 */
const ymQuerySchema = z.object({
  year: z.coerce.number().int().min(1970).max(2100).optional(),
  month: z.coerce.number().int().min(1).max(12).optional()
});

export const employeePayrollSummary = async (req: AuthRequest, res: Response): Promise<void> => {
  const shopId     = Number(req.params.shopId);
  const employeeId = Number(req.params.employeeId);

  /* ── 파라미터(년·월) ── */
  const today  = new Date();
  const parsed = ymQuerySchema.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: 'Invalid year/month' }); return; }
  const yy     = Number(parsed.data.year  ?? today.getFullYear());
  const mm     = Number(parsed.data.month ?? today.getMonth() + 1);
  const { start, end } = getMonthRange(yy, mm);

  /* ── 직원 정보 ── */
  const emp = await prisma.employee.findFirst({
    where: { id: employeeId, shopId },
    select: {
      name:true, position:true, section:true,
      pay:true, payUnit:true, schedule:true
    }
  });
  if (!emp) { res.status(404).json({ error: 'Employee not found' }); return; }

  /* ── 월 범위 내 완료된 시프트(WorkShift) ──
     우선 actualInAt 기준, 없으면 startAt 기준으로 포함 */
  const shifts = await prisma.workShift.findMany({
    where: {
      shopId, employeeId,
      status: 'COMPLETED',
      OR: [
        { actualInAt: { gte: start, lte: end } },
        { actualInAt: null, startAt: { gte: start, lte: end } }
      ]
    },
    orderBy: { actualInAt: 'asc' },
    select: {
      id: true,
      startAt: true, endAt: true,
      actualInAt: true, actualOutAt: true,
      workedMinutes: true, actualMinutes: true,
      late: true
    }
  });

  /* ── 근무/연장/지각 집계 ── */
  const workedDates = new Set<string>(); // 예정일 중 실제 출근한 날짜(KST)
  let totalWorkedMin = 0;
  let totalActualMin = 0;
  let totalExtraMin  = 0;
  let lateCnt        = 0;

  for (const s of shifts) {
    const inAt  = s.actualInAt ?? s.startAt;
    const outAt = s.actualOutAt ?? s.endAt;

    // 일자 키 (KST)
    workedDates.add(kstDateKey(inAt));

    // 분 계산(필드 없으면 즉석계산)
    const am = s.actualMinutes ?? (s.actualInAt && s.actualOutAt ? diffMinutes(s.actualInAt, s.actualOutAt) : 0);
    const wm = s.workedMinutes ?? (s.actualInAt && s.actualOutAt ? intersectMinutes(s.actualInAt, s.actualOutAt, s.startAt, s.endAt) : 0);

    totalActualMin += am;
    totalWorkedMin += wm;
    totalExtraMin  += Math.max(0, am - wm);

    if (s.late) lateCnt += 1;
  }

  const daysWorked = workedDates.size;

  /* ── 결근 계산(스케줄 기반) ──
     스케줄은 요일별 {start,end}가 있다고 가정(없으면 off) */
  let totalScheduled = 0;
  let attendedOnScheduled = 0;

  // 빠른 조회를 위해 workedDates를 그대로 사용
  for (let d = new Date(start.getTime()); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const wk = weekday[d.getUTCDay()];
    const spec = (emp.schedule as any)?.[wk];
    const isScheduled =
      spec && typeof spec === 'object' &&
      typeof spec.start === 'string' && typeof spec.end === 'string';

    if (isScheduled) {
      totalScheduled += 1;
      const key = kstDateKey(d);
      if (workedDates.has(key)) attendedOnScheduled += 1;
    }
  }
  const absentCnt = Math.max(totalScheduled - attendedOnScheduled, 0);

  /* ── 급여 계산 ──
     - 시급제: payable(=worked) 기준
     - 월급제: 결근 공제(월 스케줄일 기준 일할) + 3.3% 예시 원천세 */
  const basicSalary =
    emp.payUnit === 'HOURLY'
      ? Math.round((emp.pay / 60) * totalWorkedMin)
      : emp.pay;

  const absenceDeduct =
    emp.payUnit === 'MONTHLY' && totalScheduled > 0
      ? Math.round(emp.pay * (absentCnt / totalScheduled))
      : 0;

  const taxDeduct = Math.round(basicSalary * 0.033); // 예시 3.3%
  const netSalary =
    emp.payUnit === 'MONTHLY'
      ? basicSalary - absenceDeduct - taxDeduct
      : basicSalary - taxDeduct;

  res.json({
    year: yy, month: mm,
    employee: {
      id: employeeId,
      name: emp.name,
      section: emp.section,
      position: emp.position,
      hourlyPay:  emp.payUnit === 'HOURLY'  ? emp.pay : null,
      monthlyPay: emp.payUnit === 'MONTHLY' ? emp.pay : null
    },
    workStats: {
      daysWorked,
      totalWorkedMinutes: totalWorkedMin,   // 지급 인정 분(시프트 교집합)
      totalActualMinutes: totalActualMin,   // 실제 근무 분
      totalExtraMinutes:  totalExtraMin,    // 참고: actual - worked (정산엔 미사용)
      lateCount:  lateCnt,
      absentCount: absentCnt
    },
    payroll: {
      basicSalary,
      absenceDeduction: emp.payUnit === 'MONTHLY' ? absenceDeduct : 0,
      taxDeduction:     taxDeduct,
      netSalary
    }
  });
};
