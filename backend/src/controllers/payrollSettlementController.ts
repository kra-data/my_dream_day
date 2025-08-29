// controllers/payrollSettlementController.ts
import { Response } from 'express';
import { prisma } from '../db/prisma';
import { AuthRequiredRequest } from '../middlewares/requireUser';

/** ───────── KST 유틸 ───────── */
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

const resolveCycleStartDay = async (shopId: number) => {
  const shop = await prisma.shop.findUnique({ where: { id: shopId }, select: { payday: true } });
  const DEFAULT_CYCLE_START_DAY = Number(process.env.SETTLEMENT_CYCLE_START_DAY ?? 7);
  return shop?.payday ?? DEFAULT_CYCLE_START_DAY;
};

/** 지난 사이클 정산 확정 (Prisma 모델 사용) */
export const settlePreviousCycle = async (req: AuthRequiredRequest, res: Response) => {
  const shopId = Number(req.params.shopId);
  const employeeId = Number(req.params.employeeId);
  const adminId = req.user?.userId ?? null;

  if (!Number.isFinite(shopId) || !Number.isFinite(employeeId)) {
    return res.status(400).json({ ok:false, message:'Invalid params' });
  }

  const startDay = await resolveCycleStartDay(shopId);
  const now = new Date();
  const current = kstCycleRange(now, startDay);
  const prevAnchor = new Date(current.start.getTime() - 24*60*60*1000);
  const prev = kstCycleRange(prevAnchor, startDay);

  // 근무 합계 (paired=true만)
  const logs = await prisma.attendanceRecord.findMany({
    where: { shopId, employeeId, paired: true, clockInAt: { gte: prev.start, lte: prev.end } },
    select: { workedMinutes: true }
  });
  const workedMinutes = logs.reduce((s, r) => s + (r.workedMinutes ?? 0), 0);

  // 급여 계산 (연장/야근 없음)
  const emp = await prisma.employee.findFirst({
    where: { id: employeeId, shopId },
    select: { pay: true, payUnit: true }
  });
  if (!emp) return res.status(404).json({ ok:false, message:'Employee not found' });

  const perMinute = emp.payUnit === 'HOURLY' ? (emp.pay / 60) : 0;
  const basePay = emp.payUnit === 'MONTHLY' ? emp.pay : Math.round(perMinute * workedMinutes);
  const totalPay = basePay;

  // ✅ Prisma 모델 기반 upsert (복합 유니크는 "필드명_필드명_필드명")
  const settlement = await prisma.payrollSettlement.upsert({
    where: {
      employeeId_cycleStart_cycleEnd: {
        employeeId,
        cycleStart: prev.start,
        cycleEnd: prev.end
      }
    },
    update: {
      workedMinutes,
      basePay,
      totalPay,
      settledAt: new Date(),
      processedBy: adminId ?? undefined
    },
    create: {
      shopId,
      employeeId,
      cycleStart: prev.start,
      cycleEnd: prev.end,
      workedMinutes,
      basePay,
      totalPay,
      processedBy: adminId ?? undefined
    },
  });

  return res.status(201).json({ ok:true, settlement });
};
