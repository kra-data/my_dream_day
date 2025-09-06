import { prisma } from '../db/prisma';

export type AutoCheckoutResult = {
  processedCount: number;
};

/* ───── KST 자정 계산 유틸 ───── */
const toKst = (d: Date) => new Date(d.getTime() + 9 * 60 * 60 * 1000);
const fromKstParts = (y: number, m1: number, d: number, hh=0, mm=0, ss=0, ms=0) =>
  new Date(Date.UTC(y, m1, d, hh - 9, mm, ss, ms));
const startOfKstDay = (anchor: Date) => {
  const k = toKst(anchor);
  return fromKstParts(k.getUTCFullYear(), k.getUTCMonth(), k.getUTCDate(), 0, 0, 0, 0);
};

/**
 * 전날(또는 그 이전)에 출근했지만 아직 퇴근이 없는 시프트를 OVERDUE로 마킹.
 * 강제 OUT/시간 계산은 하지 않는다.
 * (보정은 관리자 화면/보정 API에서 수행)
 */
export async function autoCheckoutOpenAttendances(now: Date = new Date()): Promise<AutoCheckoutResult> {
  const startOfTodayKst = startOfKstDay(now);

  // actualInAt < 오늘 00:00(KST) && actualOutAt IS NULL && 상태가 이미 OVERDUE가 아닌 것
  const result = await prisma.workShift.updateMany({
    where: {
      actualInAt: { lt: startOfTodayKst },
      actualOutAt: null,
      status: { not: 'OVERDUE' }
    },
    data: {
      status: 'OVERDUE'
    }
  });

  return { processedCount: result.count };
}
