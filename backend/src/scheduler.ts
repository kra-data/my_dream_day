// src/schedulers.ts
import cron, { ScheduledTask } from 'node-cron';
import { autoReviewPastEndShifts } from './jobs/autoReviewPastEndShifts';
import { autoReviewNoInNoOut } from './jobs/autoCheckout'; // ← 경로 확인!

export function registerSchedulers(): ScheduledTask[] {
  if (process.env.CRON_ENABLED === '0') {
    console.log('⏸️  Schedulers disabled (CRON_ENABLED=0)');
    return [];
  }

  const tasks: ScheduledTask[] = [];

  // 10분마다 (KST 기준으로 돌리고 싶으면 timezone 옵션 추가)
  const job = cron.schedule(
    '*/10 * * * *',
    async () => {
      try {
        const a = await autoReviewPastEndShifts();
        const b = await autoReviewNoInNoOut();
        console.log(`[cron] review jobs - pastEnd=${a.processedCount}, noInOut=${b.processedCount}`);
      } catch (e) {
        console.error('[cron] review jobs error', e);
      }
    },
    { timezone: process.env.CRON_TZ || 'Asia/Seoul' }
  );

  tasks.push(job);
  console.log('⏰ Schedulers registered (*/10 * * * *)');
  return tasks;
}