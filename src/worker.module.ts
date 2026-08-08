import { Module } from '@nestjs/common';
import { WorkerEventPublisher } from './common/events/worker-event-publisher.service';
import { CoreInfraModule } from './core-infra.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { WorkersModule } from './workers/workers.module';

/**
 * The Workers process (worker.ts): consumes the BullMQ queues. Ingest and outbound have
 * processors (Seq 7, 16); notifications/analytics queues still have no consumer (analytics
 * background job is Seq 36, still open). NotificationsModule is imported here (not just in
 * AppModule) so message.received notifications — triggered by ingest, which only runs here —
 * actually fire; WorkerEventPublisher then relays that (and other) domain events to the API
 * process over Redis so its WebSocket gateway can broadcast them.
 */
@Module({
  imports: [CoreInfraModule, WorkersModule, NotificationsModule],
  providers: [WorkerEventPublisher],
})
export class WorkerModule {}
