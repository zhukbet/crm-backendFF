import { Module } from '@nestjs/common';
import { TelegramModule } from '../telegram/telegram.module';
import { NotificationEventsListener } from './notification-events.listener';
import { NotificationsService } from './notifications.service';

/**
 * Providers-only: imported by both AppModule (REST triggers events like ticket.assigned) and
 * WorkerModule (ingest triggers message.received) so the listener catches events in whichever
 * process actually emits them — EventEmitter2 is per-process, not shared.
 */
@Module({
  imports: [TelegramModule],
  providers: [NotificationsService, NotificationEventsListener],
  exports: [NotificationsService],
})
export class NotificationsModule {}
