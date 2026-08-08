import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { QUEUE_INGEST, QUEUE_OUTBOUND } from '../common/queues/queue.constants';
import { TicketsModule } from '../modules/tickets/tickets.module';
import { TelegramModule } from '../modules/telegram/telegram.module';
import { IngestProcessor } from './processors/ingest.processor';
import { OutboundProcessor } from './processors/outbound.processor';

@Module({
  imports: [
    BullModule.registerQueue({ name: QUEUE_INGEST }, { name: QUEUE_OUTBOUND }),
    TicketsModule,
    TelegramModule,
  ],
  providers: [IngestProcessor, OutboundProcessor],
})
export class WorkersModule {}
