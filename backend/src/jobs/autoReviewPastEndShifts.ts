// src/jobs/autoReviewPastEndShifts.ts
import { prisma } from '../db/prisma';

export type AutoReviewPastEndResult = {
  processedCount: number;
};

// tolerances & batch 설정 (ENV로 조정 가능)
const NO_OUT_AFTER_IN_MIN    = Number(process.env.NO_OUT_AFTER_IN_MIN ?? '720');   // 12h
const REVIEW_JOB_BATCH_SIZE  = Number(process.env.REVIEW_JOB_BATCH_SIZE ?? '500');
const REVIEW_MEMO_PAST_END   = process.env.REVIEW_MEMO_PAST_END
  ?? '출근 후 12시간 이상 퇴근 미기록으로 관리자 검토가 필요합니다.';

/**
 * 출근시간(actualInAt) 기준 NO_OUT_AFTER_IN_MIN(기본 12시간) 이상 경과했고
 * 퇴근 기록(actualOutAt)이 없으며
 * 상태가 'IN_PROGRESS' 인 시프트를 'REVIEW' 로 전환한다.
 *
 * - endAt 이 null 로 생성될 수 있으므로 endAt 을 사용하지 않는다.
 * - actualInAt 이 없는(SCHEDULED) 건은 대상에서 제외한다.
 */
export async function autoReviewPastEndShifts(now: Date = new Date()): Promise<AutoReviewPastEndResult> {
  let processedCount = 0;
  let cursorId: bigint | null = null;

  const threshold = new Date(now.getTime() - NO_OUT_AFTER_IN_MIN * 60 * 1000);

  for (;;) {
    // 최소 셀렉트(커서 페이징)
    const rows: Array<{ id: bigint }> = await prisma.workShift.findMany({
      where: {
        actualInAt: { lte: threshold },  // null 제외 + 임계 이전
        actualOutAt: null,               // 미-퇴근
        status: 'IN_PROGRESS',           // 진행중
      },
      select: { id: true },
      orderBy: { id: 'asc' },
      ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
      take: REVIEW_JOB_BATCH_SIZE,
    });

    if (rows.length === 0) break;

    const ids: bigint[] = rows.map(r => r.id);

    const res = await prisma.workShift.updateMany({
      where: { id: { in: ids } },
      data: {
        status: 'REVIEW',
        reviewReason: 'LATE_OUT',
        reviewResolvedAt: null,
        memo: REVIEW_MEMO_PAST_END,
        // 스키마 변경 반영
        updatedByUserId: null,
        updatedByEmployeeId: null,
      },
    });

    processedCount += res.count;
    cursorId = rows[rows.length - 1].id; // 다음 배치 커서
  }

  return { processedCount };
}

export default autoReviewPastEndShifts;
