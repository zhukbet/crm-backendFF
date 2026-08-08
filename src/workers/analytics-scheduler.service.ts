import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Queue } from 'bullmq';
import { JOB_ANALYTICS_AGGREGATE_DAILY, QUEUE_ANALYTICS } from '../common/queues/queue.constants';

/** Registers the Seq 36 daily aggregation as a BullMQ repeatable job, once, on worker boot.
 * BullMQ dedupes repeatable jobs by their repeat key, so re-registering on every restart is
 * safe and idempotent — it won't pile up duplicate schedules. */
@Injectable()
export class AnalyticsSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(AnalyticsSchedulerService.name);

  constructor(@InjectQueue(QUEUE_ANALYTICS) private readonly queue: Queue) {}

  async onModuleInit() {
    await this.queue.add(
      JOB_ANALYTICS_AGGREGATE_DAILY,
      {},
      { repeat: { pattern: '0 1 * * *' } }, // daily at 01:00 UTC
    );
    this.logger.log('Scheduled daily chat_stats_daily aggregation (01:00 UTC)');
  }
}
