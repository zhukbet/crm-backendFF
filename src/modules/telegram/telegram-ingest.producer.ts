import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { JOB_INGEST_UPDATE, QUEUE_INGEST } from '../../common/queues/queue.constants';
import { NormalizedIncomingMessage } from './telegram.types';

@Injectable()
export class TelegramIngestProducer {
  constructor(@InjectQueue(QUEUE_INGEST) private readonly queue: Queue) {}

  async enqueue(message: NormalizedIncomingMessage): Promise<void> {
    await this.queue.add(JOB_INGEST_UPDATE, message, {
      // Dedup at the queue level too: jobId collisions are skipped by BullMQ. BullMQ rejects
      // ":" in custom job ids ("Custom Id cannot contain :"), hence "_" as the separator.
      jobId: `${message.telegramChatId}_${message.tgMessageId}`,
      attempts: 5,
      backoff: { type: 'exponential', delay: 1000 },
      removeOnComplete: 1000,
      removeOnFail: 5000,
    });
  }
}
