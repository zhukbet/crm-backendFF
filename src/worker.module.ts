import { Module } from '@nestjs/common';
import { CoreInfraModule } from './core-infra.module';
import { WorkersModule } from './workers/workers.module';

/**
 * The Workers process (worker.ts): consumes the BullMQ queues. Currently only ingest and
 * outbound have processors (Seq 7, 16) — notifications/analytics queues still have no
 * consumer, matching the notifications/analytics modules not being built yet either.
 */
@Module({
  imports: [CoreInfraModule, WorkersModule],
})
export class WorkerModule {}
