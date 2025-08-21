import cron from 'node-cron';
import { autoCheckoutOpenAttendances } from './jobs/autoCheckout';

/**
 * Register cron jobs. Call from app startup (but avoid during tests).
 */
export function registerSchedulers(): void {
  // Run every day at 00:05 local time to avoid DST edge at 00:00
  const schedule = process.env.AUTO_CHECKOUT_CRON ?? '5 0 * * *';

  cron.schedule(schedule, async () => {
    try {
      const result = await autoCheckoutOpenAttendances();
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[autoCheckout] processed: ${result.processedCount}`);
      }
    } catch (err) {
      console.error('[autoCheckout] error', err);
    }
  });
}


