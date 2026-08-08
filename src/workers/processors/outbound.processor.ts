import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_OUTBOUND } from '../../common/queues/queue.constants';
import { MessagesService } from '../../modules/tickets/messages.service';
import { OutboundReplyJob } from '../../modules/telegram/telegram-outbound.producer';
import { TelegramService } from '../../modules/telegram/telegram.service';

/**
 * Seq 16: sends agent replies to Telegram. `limiter` caps this worker at ~25 jobs/sec, under
 * Telegram's ~30 msg/s global limit. Per-chat (~1 msg/s) is NOT enforced here — see the
 * producer's comment for why (needs a custom Redis token-bucket or BullMQ Pro).
 */
@Processor(QUEUE_OUTBOUND, { limiter: { max: 25, duration: 1000 } })
export class OutboundProcessor extends WorkerHost {
  private readonly logger = new Logger(OutboundProcessor.name);

  constructor(
    private readonly telegram: TelegramService,
    private readonly messages: MessagesService,
  ) {
    super();
  }

  async process(job: Job<OutboundReplyJob>): Promise<void> {
    const { messageId, telegramChatId, text, replyToTgMessageId } = job.data;

    const sent = await this.telegram.sendReply({
      chatId: BigInt(telegramChatId),
      text,
      replyToMessageId: replyToTgMessageId ? BigInt(replyToTgMessageId) : undefined,
    });

    await this.messages.confirmOutgoingSent(messageId, sent.tgMessageId);
    this.logger.debug(`Outbound job ${job.id} sent as tg_message_id ${sent.tgMessageId}`);
  }
}
