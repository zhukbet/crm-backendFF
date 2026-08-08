import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { BullRootModule } from './common/queues/bull-root.module';
import { PrismaModule } from './common/prisma/prisma.module';
import configuration from './config/configuration';
import { validateEnv } from './config/env.validation';

/** Infra shared by both entry points (main.ts / worker.ts): config, event bus, DB, queues. */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration], validate: validateEnv }),
    EventEmitterModule.forRoot(),
    PrismaModule,
    BullRootModule,
  ],
})
export class CoreInfraModule {}
