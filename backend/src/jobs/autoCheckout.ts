import { prisma } from '../db/prisma';
import { Prisma, WorkShiftStatus } from '@prisma/client';

// 2시간(120분) 기본, 필요하면 ENV로 조정
const NO_ATTENDANCE_TOLERANCE_MIN =
  Number(process.env.NO_ATTENDANCE_TOLERANCE_MIN ?? '120');

type NoAttendanceRow = Prisma.WorkShiftGetPayload<{
  select: { id: true; actualInAt: true; actualOutAt: true }
}>;

/**
 * 출근/퇴근 기록이 모두 없고(endAt+2h 경과), 상태가 SCHEDULED 또는 IN_PROGRESS인 시프트를 REVIEW로 전환
 * - reviewReason: 'NO_ATTENDANCE'
 * - memo: 'AUTO_REVIEW_NO_IN_OUT'
 */
export async function autoReviewNoInNoOut(now: Date = new Date()): Promise<{ processedCount: number }> {
  const threshold = new Date(now.getTime() - NO_ATTENDANCE_TOLERANCE_MIN * 60_000);

  let processedCount = 0;
  let cursorId: number | null = null;
  const pageSize = 500;

  for (;;) {
    const rows: NoAttendanceRow[] = await prisma.workShift.findMany({
      where: {
        // 퇴근 예정시간 + tolerance 경과
        endAt: { lt: threshold },
        // 실제 기록이 전혀 없음
        actualInAt: null,
        actualOutAt: null,
        // 아직 완료/취소가 아닌 예정/진행 상태만
        status: { in: ['SCHEDULED', 'IN_PROGRESS'] as WorkShiftStatus[] },
      },
      select: { id: true, actualInAt: true, actualOutAt: true },
      orderBy: { id: 'asc' },
      ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
      take: pageSize,
    });

    if (rows.length === 0) break;

    const ids = rows.map(r => r.id);

    const res = await prisma.workShift.updateMany({
      where: { id: { in: ids } },
      data: {
        status: 'REVIEW' as WorkShiftStatus,
        reviewReason: 'NO_ATTENDANCE' as any, // reviewReason이 enum이 아니면 any 캐스팅
        reviewResolvedAt: null,
        memo: 'AUTO_REVIEW_NO_IN_OUT',
        updatedBy: null,
      },
    });

    processedCount += res.count;
    cursorId = rows[rows.length - 1].id;
  }

  return { processedCount };
}
