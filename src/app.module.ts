import { Module } from '@nestjs/common';
import { CoreInfraModule } from './core-infra.module';
import { AuthModule } from './modules/auth/auth.module';
import { ExcludedSendersModule } from './modules/excluded-senders/excluded-senders.module';
import { HealthModule } from './modules/health/health.module';
import { TelegramWebhookModule } from './modules/telegram/telegram-webhook.module';

/**
 * The API process (main.ts): HTTP + WS. Does not include queue processors — those live in
 * WorkerModule (worker.ts) so api/workers scale independently (section 3.3 of the spec).
 */
@Module({
  imports: [
    CoreInfraModule,
    TelegramWebhookModule,
    AuthModule,
    ExcludedSendersModule,
    HealthModule,
  ],
})
export class AppModule {}
