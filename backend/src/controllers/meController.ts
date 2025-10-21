import { Response } from 'express';
import { prisma } from '../db/prisma';
import { AuthRequiredRequest } from '../middlewares/requireUser';
import { toJSONSafe, asBigInt } from '../utils/serialize';
// ───────── KST 보조 유틸 ─────────
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const toKST = (d: Date) => new Date(d.getTime() + KST_OFFSET_MS);
const fromKstParts = (
  y: number, m1: number, d: number, hh = 0, mm = 0, ss = 0, ms = 0
) => new Date(Date.UTC(y, m1, d, hh - 9, mm, ss, ms));
const startOfKstMonth = (anchor: Date) => {
  const k = toKST(anchor);
  return fromKstParts(k.getUTCFullYear(), k.getUTCMonth(), 1, 0, 0, 0, 0);
};
const endOfKstMonth = (anchor: Date) => {
  const k = toKST(anchor);
  // 다음달 1일 00:00(KST) - 1ms
  const next0 = fromKstParts(k.getUTCFullYear(), k.getUTCMonth() + 1, 1, 0, 0, 0, 0);
  return new Date(next0.getTime() - 1);
};

const round2 = (n: number) => Math.round(n * 100) / 100;

/** 직원 본인 개요 조회 */
export const getMyProfileOverview = async (req: AuthRequiredRequest, res: Response) => {
  if (!req.user?.empId) { return res.status(403).json({ error: '직원 전용 엔드포인트입니다.' }); }
  const employeeIdBI = asBigInt(req.user.empId);
  const now = new Date();
  const thisMonthStart = startOfKstMonth(now);
  const thisMonthEnd   = endOfKstMonth(now);

  const prev = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 15));
  const prevMonthStart = startOfKstMonth(prev);
  const prevMonthEnd   = endOfKstMonth(prev);

  // 직원 기본 정보
  const me = await prisma.employeeMember.findUnique({
    where: { id: employeeIdBI },
    select: {
      id: true,
      name: true,
      section: true,
      position: true,
      pay: true,          // Decimal
      payUnit: true,      // 'HOURLY' | 'MONTHLY' (string)
      phone: true,
      bankAccount: true,  // ✅ 스키마 필드명
      bankName: true,     // ✅ 스키마 필드명
      shopId: true
    }
  });
  if (!me) { res.status(404).json({ error: 'Employee not found' }); return; }

  // Decimal -> number (null/undefined 방어)
  const payNumber = me.pay != null ? Number(me.pay) : 0;

  // 저번달(달력 기준) 정산 스냅샷(있으면)
  const lastSettlement = await prisma.payrollSettlement.findFirst({
    where: {
      employeeId: me.id,
      cycleStart: { gte: prevMonthStart },
      cycleEnd:   { lte: prevMonthEnd }
    },
    orderBy: { cycleEnd: 'desc' },
    select: {
      id: true,
      basePay: true,
      totalPay: true,
      netPay: true,
      incomeTax: true,
      localIncomeTax: true,
      otherTax: true
    }
  });

  // 이번달 확정 근무(달력 기준) 집계 (COMPLETED & 이번달에 종료된 것만)
  const monthShifts = await prisma.workShift.findMany({
    where: {
      employeeId: me.id,
      status: 'COMPLETED',
      endAt: { gte: thisMonthStart, lte: thisMonthEnd }
    },
    select: { workedMinutes: true, finalPayAmount: true }
  });

  const workedMinutesThisMonth = monthShifts.reduce(
    (acc, s) => acc + (s.workedMinutes ?? 0), 0
  );

  // 예상 총 급여:
  //  - HOURLY: finalPayAmount 합(없으면 workedMinutes*시급)
  //  - MONTHLY: 월급(pay)
  let expectedTotal = 0;
  if (me.payUnit === 'HOURLY') {
    const fallbackPerShift = (wm?: number | null) =>
      wm ? Math.round((wm / 60) * payNumber) : 0;
    expectedTotal = monthShifts.reduce(
      (acc, s) => acc + (s.finalPayAmount ?? fallbackPerShift(s.workedMinutes)),
      0
    );
  } else if (me.payUnit === 'MONTHLY') {
    expectedTotal = payNumber;
  } else {
    expectedTotal = 0;
  }

  // 공제(기본 3.3% = 소득세 3% + 지방소득세 0.3%)
  const WITHHOLDING_RATE = Number(process.env.PAYROLL_WITHHOLDING_RATE ?? '0.033');
  const deduction = Math.round(expectedTotal * WITHHOLDING_RATE);
  const expectedNet = expectedTotal - deduction;

  res.json(toJSONSafe({
    id: me.id,
    name: me.name,
    section: me.section,
    position: me.position,
    pay: payNumber,
    payUnit: me.payUnit,
    phone: me.phone,
    bankAccount: me.bankAccount ?? null,
    bank: me.bankName ?? null,

    lastMonthSettlementAmount: lastSettlement?.netPay ?? null,

    thisMonth: {
      workedMinutes: workedMinutesThisMonth,
      workedHours: round2(workedMinutesThisMonth / 60)
    },
    expectedTotalPay: expectedTotal,
    deductionAmount: deduction,
    expectedNetPay: expectedNet
  }));
};
