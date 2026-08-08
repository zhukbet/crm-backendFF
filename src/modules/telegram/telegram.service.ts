import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, createHmac, timingSafeEqual } from 'crypto';
import { Bot } from 'grammy';

export interface TelegramLoginPayload {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

const LOGIN_WIDGET_MAX_AGE_SECONDS = 24 * 60 * 60;

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);
  readonly bot: Bot;

  constructor(private readonly config: ConfigService) {
    const token = this.config.get<string>('telegram.botToken');
    if (!token) {
      throw new Error('BOT_TOKEN is not configured');
    }
    this.bot = new Bot(token);
  }

  /**
   * Verifies the Telegram Login Widget payload per
   * https://core.telegram.org/widgets/login#checking-authorization
   */
  verifyLoginWidget(payload: TelegramLoginPayload): boolean {
    const { hash, ...rest } = payload;
    if (!hash) return false;

    const dataCheckString = Object.keys(rest)
      .sort()
      .map((key) => `${key}=${(rest as Record<string, unknown>)[key]}`)
      .join('\n');

    const botToken = this.config.get<string>('telegram.botToken')!;
    const secretKey = createHash('sha256').update(botToken).digest();
    const computedHash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

    const isAgeValid =
      Math.floor(Date.now() / 1000) - payload.auth_date <= LOGIN_WIDGET_MAX_AGE_SECONDS;

    const a = Buffer.from(computedHash, 'hex');
    const b = Buffer.from(hash, 'hex');
    const isHashValid = a.length === b.length && timingSafeEqual(a, b);

    return isHashValid && isAgeValid;
  }

  isWebhookSecretValid(headerSecret: string | undefined): boolean {
    const expected = this.config.get<string>('telegram.webhookSecret');
    if (!expected) return true;
    return headerSecret === expected;
  }

  async sendReply(params: {
    chatId: bigint;
    text: string;
    replyToMessageId?: bigint;
  }): Promise<{ tgMessageId: bigint }> {
    const message = await this.bot.api.sendMessage(Number(params.chatId), params.text, {
      reply_parameters: params.replyToMessageId
        ? { message_id: Number(params.replyToMessageId) }
        : undefined,
    });
    return { tgMessageId: BigInt(message.message_id) };
  }

  async sendDirectMessage(telegramUserId: bigint, text: string): Promise<void> {
    try {
      await this.bot.api.sendMessage(Number(telegramUserId), text);
    } catch (err) {
      this.logger.warn(
        `Failed to DM agent ${telegramUserId} (they may not have started the bot yet): ${err}`,
      );
    }
  }
}
