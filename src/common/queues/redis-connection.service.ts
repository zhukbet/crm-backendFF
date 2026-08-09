import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * BullMQ requires a raw ioredis connection (not a NestJS-managed client) for its blocking
 * commands, and never closes a connection it didn't create itself — so this needs its own
 * OnModuleDestroy or the socket leaks on shutdown (mirrors ApiEventSubscriber's pub/sub side).
 */
@Injectable()
export class RedisConnectionService implements OnModuleDestroy {
  readonly client: Redis;

  constructor(config: ConfigService) {
    this.client = new Redis(config.get<string>('redis.url')!, { maxRetriesPerRequest: null });
  }

  onModuleDestroy() {
    this.client.disconnect();
  }
}
