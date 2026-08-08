import { Module } from '@nestjs/common';
import { ApiEventSubscriber } from './common/events/api-event-subscriber.service';
import { CoreInfraModule } from './core-infra.module';
import { AnalyticsHttpModule } from './modules/analytics/analytics-http.module';
import { AuthModule } from './modules/auth/auth.module';
import { CannedResponsesModule } from './modules/canned-responses/canned-responses.module';
import { ChatsHttpModule } from './modules/chats/chats-http.module';
import { ExcludedSendersModule } from './modules/excluded-senders/excluded-senders.module';
import { HealthModule } from './modules/health/health.module';
import { NotificationsHttpModule } from './modules/notifications/notifications-http.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { SavedViewsModule } from './modules/saved-views/saved-views.module';
import { TeamsModule } from './modules/teams/teams.module';
import { TelegramWebhookModule } from './modules/telegram/telegram-webhook.module';
import { TicketsModule } from './modules/tickets/tickets.module';

/**
 * The API process (main.ts): HTTP + WS. Does not include queue processors — those live in
 * WorkerModule (worker.ts) so api/workers scale independently (section 3.3 of the spec).
 * ApiEventSubscriber re-emits Workers-originated domain events locally so TicketsGateway can
 * broadcast them — see WorkerEventPublisher for why that bridge is needed.
 */
@Module({
  imports: [
    CoreInfraModule,
    TelegramWebhookModule,
    AuthModule,
    ExcludedSendersModule,
    TicketsModule,
    NotificationsHttpModule,
    ChatsHttpModule,
    AnalyticsHttpModule,
    SavedViewsModule,
    CannedResponsesModule,
    OrganizationsModule,
    TeamsModule,
    HealthModule,
  ],
  providers: [ApiEventSubscriber],
})
export class AppModule {}
