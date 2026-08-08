import { Module } from '@nestjs/common';
import { CoreInfraModule } from './core-infra.module';

/**
 * The Workers process (worker.ts): consumes the BullMQ queues (ingest, outbound,
 * notifications, analytics). No @Processor classes are registered yet — this boots the
 * process and its Redis/Postgres connections, but nothing is dequeued yet. See README.
 */
@Module({
  imports: [CoreInfraModule],
})
export class WorkerModule {}
