import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { JOB_OUTBOUND_SEND, QUEUE_OUTBOUND } from '../../common/queues/queue.constants';

export interface OutboundReplyJob {
  ticketId: string;
  telegramChatId: string;
  text: string;
  replyToTgMessageId?: string;
}

@Injectable()
export class TelegramOutboundProducer {
  constructor(@InjectQueue(QUEUE_OUTBOUND) private readonly queue: Queue) {}

  async enqueueReply(job: OutboundReplyJob): Promise<void> {
    await this.queue.add(JOB_OUTBOUND_SEND, job, {
      attempts: 5,
      backoff: { type: 'exponential', delay: 1000 },
      // Telegram outbound rate limits (~30 msg/s global, ~1 msg/s per chat) are enforced by
      // BullMQ's per-queue/per-group rate limiter configured on the worker side (outbound.processor).
      removeOnComplete: 1000,
      removeOnFail: 5000,
    });
  }
}
