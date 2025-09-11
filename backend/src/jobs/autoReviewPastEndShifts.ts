// src/jobs/autoReviewPastEndShifts.ts
import { prisma } from '../db/prisma';
import { Prisma, WorkShiftStatus } from '@prisma/client';

export type AutoReviewPastEndResult = {
  processedCount: number;
};

// tolerances & batch 설정 (ENV로 조정 가능)
const PAST_END_TOLERANCE_MIN = Number(process.env.PAST_END_TOLERANCE_MIN ?? '120'); // 2h
const REVIEW_JOB_BATCH_SIZE  = Number(process.env.REVIEW_JOB_BATCH_SIZE ?? '500');
const REVIEW_MEMO_PAST_END   = process.env.REVIEW_MEMO_PAST_END ?? '퇴근처리가 되지 않아 관리자 승인이 필요합니다.';

/**
 * 퇴근 예정시간(endAt) + tolerance 경과했는데 OUT 기록이 없고
 * 상태가 SCHEDULED/IN_PROGRESS인 시프트를 REVIEW로 전환한다.
 *
 * - 대상: endAt < now - tol, actualOutAt IS NULL, status IN (SCHEDULED, IN_PROGRESS), actualInAt IS NOT NULL
 *   (IN/OUT 모두 없는 케이스는 별도 autoReviewNoInNoOut 잡이 처리)
 * - reviewReason: 'LATE_OUT' (스키마가 string이면 as any)
 * - memo: REVIEW_MEMO_PAST_END
 */
export async function autoReviewPastEndShifts(now: Date = new Date()): Promise<AutoReviewPastEndResult> {
  const threshold = new Date(now.getTime() - PAST_END_TOLERANCE_MIN * 60_000);

  let processedCount = 0;
  let cursorId: number | null = null;

  // 선택 타입(암시적 any 방지)
  type IdOnly = Prisma.WorkShiftGetPayload<{ select: { id: true } }>;

  for (;;) {
    const rows: IdOnly[] = await prisma.workShift.findMany({
      where: {
        endAt: { lt: threshold },
        actualOutAt: null,
        actualInAt: { not: null }, // IN만 찍힌 케이스만 처리 (둘 다 없음은 다른 잡에서)
        status: { in: ['SCHEDULED', 'IN_PROGRESS'] as WorkShiftStatus[] },
      },
      select: { id: true },
      orderBy: { id: 'asc' },
      ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
      take: REVIEW_JOB_BATCH_SIZE,
    });

    if (rows.length === 0) break;

    const ids = rows.map(r => r.id);

    const res = await prisma.workShift.updateMany({
      where: { id: { in: ids } },
      data: {
        status: 'REVIEW' as WorkShiftStatus,
        reviewReason: 'LATE_OUT' as any,
        reviewResolvedAt: null,
        memo: REVIEW_MEMO_PAST_END,
        updatedBy: null,
      },
    });

    processedCount += res.count;
    cursorId = rows[rows.length - 1].id;
  }

  return { processedCount };
}

export default autoReviewPastEndShifts;
