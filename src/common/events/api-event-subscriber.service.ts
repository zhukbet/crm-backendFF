import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import Redis from 'ioredis';
import { BridgedEventEnvelope, DOMAIN_EVENTS_CHANNEL } from './redis-bridge.constants';

/** API-side half of the bridge — see WorkerEventPublisher for why this exists. */
@Injectable()
export class ApiEventSubscriber implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ApiEventSubscriber.name);
  private readonly subscriber: Redis;

  constructor(
    config: ConfigService,
    private readonly emitter: EventEmitter2,
  ) {
    this.subscriber = new Redis(config.get<string>('redis.url')!);
  }

  async onModuleInit() {
    await this.subscriber.subscribe(DOMAIN_EVENTS_CHANNEL);
    this.subscriber.on('message', (_channel: string, message: string) => {
      let envelope: BridgedEventEnvelope;
      try {
        envelope = JSON.parse(message);
      } catch {
        this.logger.warn(`Ignoring malformed message on ${DOMAIN_EVENTS_CHANNEL}`);
        return;
      }
      this.emitter.emit(envelope.event, envelope.data);
    });
  }

  onModuleDestroy() {
    this.subscriber.disconnect();
  }
}
