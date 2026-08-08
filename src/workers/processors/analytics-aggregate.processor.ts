import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_ANALYTICS } from '../../common/queues/queue.constants';
import { AnalyticsService } from '../../modules/analytics/analytics.service';

/** Seq 36: aggregates chat_stats_daily for the day before this job runs (i.e. "yesterday" —
 * "today" is always computed live by the analytics endpoints, see AnalyticsService). */
@Processor(QUEUE_ANALYTICS)
export class AnalyticsAggregateProcessor extends WorkerHost {
  private readonly logger = new Logger(AnalyticsAggregateProcessor.name);

  constructor(private readonly analytics: AnalyticsService) {
    super();
  }

  async process(_job: Job): Promise<void> {
    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);

    const count = await this.analytics.aggregateAllChatsForDate(yesterday);
    this.logger.log(`Aggregated chat_stats_daily for ${count} chats (${yesterday.toDateString()})`);
  }
}
