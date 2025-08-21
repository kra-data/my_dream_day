import { prisma } from '../db/prisma';

export type AutoCheckoutResult = {
  processedCount: number;
};

/**
 * Auto close any open (paired=false) attendance records whose clock-in day has ended.
 * Runs typically at local midnight. Sets clockOutAt to 23:59:59.999 of the clock-in date.
 */
export async function autoCheckoutOpenAttendances(now: Date = new Date()): Promise<AutoCheckoutResult> {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

  const openRecords = await prisma.attendanceRecord.findMany({
    where: {
      paired: false,
      clockInAt: { lt: startOfToday },
    },
    select: { id: true, clockInAt: true },
  });

  let processedCount = 0;

  for (const rec of openRecords) {
    if (!rec.clockInAt) continue;
    const inAt = rec.clockInAt;
    const endOfDay = new Date(inAt.getFullYear(), inAt.getMonth(), inAt.getDate(), 23, 59, 59, 999);

    const workedMinutes = Math.floor((endOfDay.getTime() - inAt.getTime()) / 60000);
    const extraMinutes = workedMinutes > 480 ? Math.floor((workedMinutes - 480) / 30) * 30 : 0;

    await prisma.attendanceRecord.update({
      where: { id: rec.id },
      data: {
        type: 'OUT',
        clockOutAt: endOfDay,
        workedMinutes,
        extraMinutes,
        paired: true,
      },
    });
    processedCount += 1;
  }

  return { processedCount };
}


