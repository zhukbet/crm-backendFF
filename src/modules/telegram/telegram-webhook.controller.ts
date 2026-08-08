import { Body, Controller, ForbiddenException, Headers, HttpCode, Post } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Update } from 'grammy/types';
import { TelegramIngestProducer } from './telegram-ingest.producer';
import { TelegramService } from './telegram.service';
import { TelegramUpdateNormalizer } from './telegram-update.normalizer';

const SECRET_HEADER = 'x-telegram-bot-api-secret-token';

@ApiExcludeController()
@Controller('telegram')
export class TelegramWebhookController {
  constructor(
    private readonly telegram: TelegramService,
    private readonly normalizer: TelegramUpdateNormalizer,
    private readonly ingestProducer: TelegramIngestProducer,
  ) {}

  @Post('webhook')
  @HttpCode(200)
  async handleWebhook(
    @Body() update: Update,
    @Headers(SECRET_HEADER) secretHeader: string | undefined,
  ): Promise<{ ok: true }> {
    if (!this.telegram.isWebhookSecretValid(secretHeader)) {
      throw new ForbiddenException('Invalid webhook secret token');
    }

    const normalized = this.normalizer.normalize(update);
    if (normalized) {
      await this.ingestProducer.enqueue(normalized);
    }

    // Always ack fast with 200 so Telegram doesn't retry updates we intentionally skip
    // (private chats, service messages, etc.) — actual dedup/processing happens in the worker.
    return { ok: true };
  }
}
