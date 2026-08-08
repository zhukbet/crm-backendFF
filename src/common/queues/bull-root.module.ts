import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/** Shared BullMQ connection setup, imported by both the API and the Workers process. */
export const BullRootModule = BullModule.forRootAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    // BullMQ requires this on the underlying ioredis connection for its blocking commands.
    connection: new Redis(config.get<string>('redis.url')!, { maxRetriesPerRequest: null }),
  }),
});
