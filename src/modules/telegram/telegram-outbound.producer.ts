import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { JOB_OUTBOUND_SEND, QUEUE_OUTBOUND } from '../../common/queues/queue.constants';

export interface OutboundReplyJob {
  ticketId: string;
  /** DB id of the already-created Message row this job must fill in tg_message_id for. */
  messageId: string;
  telegramChatId: string;
  text: string;
  replyToTgMessageId?: string;
  attachments?: Array<{ fileId: string; url: string }>;
}

@Injectable()
export class TelegramOutboundProducer {
  constructor(@InjectQueue(QUEUE_OUTBOUND) private readonly queue: Queue) {}

  async enqueueReply(job: OutboundReplyJob): Promise<void> {
    await this.queue.add(JOB_OUTBOUND_SEND, job, {
      attempts: 5,
      backoff: { type: 'exponential', delay: 1000 },
      // Global rate limit (~30 msg/s) is enforced by the BullMQ Worker's `limiter` option in
      // outbound.processor.ts. Per-chat (~1 msg/s) is NOT enforced — that needs either a
      // custom Redis token-bucket keyed by chat, or BullMQ Pro's per-group rate limiting,
      // neither of which is implemented yet.
      removeOnComplete: 1000,
      removeOnFail: 5000,
    });
  }
}
