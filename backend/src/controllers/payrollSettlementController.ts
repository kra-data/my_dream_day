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

/* ───────── 분 계산 유틸 ───────── */
const diffMinutes = (a: Date, b: Date) =>
  Math.max(0, Math.floor((b.getTime() - a.getTime()) / 60000));

const intersectMinutes = (a0: Date, a1: Date, b0: Date, b1: Date) => {
  const st = a0 > b0 ? a0 : b0;
  const en = a1 < b1 ? a1 : b1;
  if (en <= st) return 0;
  return diffMinutes(st, en);
};

/** 지난 사이클 정산 확정 (WorkShift 기반) */
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

  // 직원 정보 (급여 단가)
  const emp = await prisma.employee.findFirst({
    where: { id: employeeId, shopId },
    select: { pay: true, payUnit: true }
  });
  if (!emp) return res.status(404).json({ ok:false, message:'Employee not found' });

  // 지난 사이클의 완료된 시프트 수집
  // 기준: actualInAt가 사이클에 들어오면 우선, 없으면 startAt로 포함
  const shifts = await prisma.workShift.findMany({
    where: {
      shopId,
      employeeId,
      status: 'COMPLETED',
      OR: [
        { actualInAt: { gte: prev.start, lte: prev.end } },
        { actualInAt: null, startAt: { gte: prev.start, lte: prev.end } }
      ]
    },
    select: {
      id: true, startAt: true, endAt: true,
      actualInAt: true, actualOutAt: true,
      workedMinutes: true, actualMinutes: true,
    }
  });

  // 비어있는 분 필드 보완 및 합계
  let workedMinutesTotal = 0;

  // 먼저 필요한 보정 업데이트 목록 준비
  const patchList: Array<{
    id: number;
    workedMinutes: number;
    actualMinutes: number;
  }> = [];

  for (const s of shifts) {
    let wm = s.workedMinutes ?? null;
    let am = s.actualMinutes ?? null;

    if ((wm == null || am == null) && s.actualInAt && s.actualOutAt) {
      am = diffMinutes(s.actualInAt, s.actualOutAt);
      wm = intersectMinutes(s.actualInAt, s.actualOutAt, s.startAt, s.endAt);
      patchList.push({ id: s.id, workedMinutes: wm, actualMinutes: am });
    }

    workedMinutesTotal += (wm ?? 0);
  }

  // 급여 계산 (연장/야근 없음)
  const perMinute = emp.payUnit === 'HOURLY' ? (emp.pay / 60) : 0;
  const basePay   = emp.payUnit === 'MONTHLY' ? emp.pay : Math.round(perMinute * workedMinutesTotal);
  const totalPay  = basePay;

  // 트랜잭션: (1) settlement upsert → (2) 시프트 채워넣기/연결
  const result = await prisma.$transaction(async (tx) => {
    // 1) 정산 스냅샷 upsert
    const settlement = await tx.payrollSettlement.upsert({
      where: {
        employeeId_cycleStart_cycleEnd: {
          employeeId,
          cycleStart: prev.start,
          cycleEnd: prev.end
        }
      },
      update: {
        workedMinutes: workedMinutesTotal,
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
        workedMinutes: workedMinutesTotal,
        basePay,
        totalPay,
        processedBy: adminId ?? undefined
      },
    });

    // 2-a) 미기록 분 보정 저장
    // (서로 다른 값이므로 개별 update 필요)
    if (patchList.length > 0) {
      await Promise.all(
        patchList.map(p =>
          tx.workShift.update({
            where: { id: p.id },
            data: { workedMinutes: p.workedMinutes, actualMinutes: p.actualMinutes }
          })
        )
      );
    }

    // 2-b) 해당 시프트들 settlementId 연결
    if (shifts.length > 0) {
      await tx.workShift.updateMany({
        where: { id: { in: shifts.map(s => s.id) } },
        data: { settlementId: settlement.id }
      });
    }

    return settlement;
  });

  return res.status(201).json({ ok: true, settlement: result, countedShifts: shifts.length, workedMinutes: workedMinutesTotal });
};
