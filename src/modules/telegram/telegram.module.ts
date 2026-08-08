import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { QUEUE_INGEST, QUEUE_OUTBOUND } from '../../common/queues/queue.constants';
import { ClientDetectionService } from './client-detection.service';
import { TelegramIngestProducer } from './telegram-ingest.producer';
import { TelegramOutboundProducer } from './telegram-outbound.producer';
import { TelegramUpdateNormalizer } from './telegram-update.normalizer';
import { TelegramService } from './telegram.service';

@Module({
  imports: [BullModule.registerQueue({ name: QUEUE_INGEST }, { name: QUEUE_OUTBOUND })],
  providers: [
    TelegramService,
    TelegramUpdateNormalizer,
    TelegramIngestProducer,
    TelegramOutboundProducer,
    ClientDetectionService,
  ],
  exports: [
    TelegramService,
    TelegramUpdateNormalizer,
    TelegramIngestProducer,
    TelegramOutboundProducer,
    ClientDetectionService,
  ],
})
export class TelegramModule {}
