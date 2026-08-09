import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule } from '@nestjs/config';
import { RedisConnectionService } from './redis-connection.service';

@Module({
  providers: [RedisConnectionService],
  exports: [RedisConnectionService],
})
class RedisConnectionModule {}

/** Shared BullMQ connection setup, imported by both the API and the Workers process. */
export const BullRootModule = BullModule.forRootAsync({
  imports: [ConfigModule, RedisConnectionModule],
  inject: [RedisConnectionService],
  useFactory: (redis: RedisConnectionService) => ({ connection: redis.client }),
});
