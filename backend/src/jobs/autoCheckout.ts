// src/jobs/autoReviewNoInNoOut.ts
import { prisma } from '../db/prisma';
import { Prisma } from '@prisma/client';

// tolerances & batch (ENV로 조절 가능)
const NO_ATTENDANCE_TOLERANCE_MIN =
  Number(process.env.NO_ATTENDANCE_TOLERANCE_MIN ?? '120');
const REVIEW_JOB_BATCH_SIZE = Number(process.env.REVIEW_JOB_BATCH_SIZE ?? '500');
const REVIEW_MEMO_NO_IN_OUT =
  process.env.REVIEW_MEMO_NO_IN_OUT ?? '퇴근처리가 되지 않아 관리자 승인이 필요합니다.';

type IdOnly = Prisma.WorkShiftGetPayload<{ select: { id: true } }>;

/**
 * 출근/퇴근 기록이 모두 없고(endAt + tolerance 경과),
 * 상태가 SCHEDULED 또는 IN_PROGRESS인 시프트를 REVIEW로 전환
 * - reviewReason: 'NO_ATTENDANCE'
 * - memo: REVIEW_MEMO_NO_IN_OUT
 */
export async function autoReviewNoInNoOut(now: Date = new Date()): Promise<{ processedCount: number }> {
  // endAt + tolerance < now  <=>  endAt < now - tolerance
  const threshold = new Date(now.getTime() - NO_ATTENDANCE_TOLERANCE_MIN * 60_000);

  let processedCount = 0;
  let cursorId: bigint | null = null; // ← BigInt PK

  for (;;) {
    const rows: IdOnly[] = await prisma.workShift.findMany({
      where: {
        endAt: { lt: threshold },           // 퇴근 예정시간 + tolerance 경과
        actualInAt: null,
        actualOutAt: null,                  // 실제 기록 전혀 없음
        status: { in: ['SCHEDULED', 'IN_PROGRESS'] }, // 예정/진행만 대상
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
        status: 'REVIEW',
        reviewReason: 'NO_ATTENDANCE',
        reviewResolvedAt: null,
        memo: REVIEW_MEMO_NO_IN_OUT,
        updatedByUserId: null,
        updatedByEmployeeId: null,
      },
    });

    processedCount += res.count;
    cursorId = rows[rows.length - 1].id;
  }

  return { processedCount };
}

export default autoReviewNoInNoOut;
