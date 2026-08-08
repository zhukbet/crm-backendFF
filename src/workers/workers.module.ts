import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { QUEUE_ANALYTICS, QUEUE_INGEST, QUEUE_OUTBOUND } from '../common/queues/queue.constants';
import { AnalyticsModule } from '../modules/analytics/analytics.module';
import { TelegramModule } from '../modules/telegram/telegram.module';
import { TicketsModule } from '../modules/tickets/tickets.module';
import { AnalyticsSchedulerService } from './analytics-scheduler.service';
import { AnalyticsAggregateProcessor } from './processors/analytics-aggregate.processor';
import { IngestProcessor } from './processors/ingest.processor';
import { OutboundProcessor } from './processors/outbound.processor';

@Module({
  imports: [
    BullModule.registerQueue(
      { name: QUEUE_INGEST },
      { name: QUEUE_OUTBOUND },
      { name: QUEUE_ANALYTICS },
    ),
    TicketsModule,
    TelegramModule,
    AnalyticsModule,
  ],
  providers: [
    IngestProcessor,
    OutboundProcessor,
    AnalyticsAggregateProcessor,
    AnalyticsSchedulerService,
  ],
})
export class WorkersModule {}
