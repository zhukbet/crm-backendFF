import { Module } from '@nestjs/common';
import { TelegramWebhookController } from './telegram-webhook.controller';
import { TelegramModule } from './telegram.module';

@Module({
  imports: [TelegramModule],
  controllers: [TelegramWebhookController],
})
export class TelegramWebhookModule {}
