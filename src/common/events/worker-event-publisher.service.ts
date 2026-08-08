import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import Redis from 'ioredis';
import {
  AgentTypingEvent,
  CommentCreatedEvent,
  DOMAIN_EVENTS,
  MessageReceivedEvent,
  MessageSentEvent,
  NotificationCreatedEvent,
  TicketAssignedEvent,
  TicketCreatedEvent,
  TicketUpdatedEvent,
} from '../../modules/tickets/events/domain-events';
import { DOMAIN_EVENTS_CHANNEL } from './redis-bridge.constants';

/**
 * EventEmitter2 is per-process. The Workers process is where ingest (new customer messages,
 * new tickets) actually happens, but the WebSocket server agents are connected to lives in the
 * API process — so without this bridge, "ticket:new"/"message:new" would silently never reach
 * connected browsers for anything originating from ingest. This republishes Workers' domain
 * events to Redis pub/sub; ApiEventSubscriber (API process) re-emits them locally so
 * TicketsGateway's existing @OnEvent handlers fire unchanged.
 *
 * One-directional by design: the API process handles its own REST-originated events directly
 * (same process as the gateway), so only Workers needs to publish.
 */
@Injectable()
export class WorkerEventPublisher implements OnModuleDestroy {
  private readonly logger = new Logger(WorkerEventPublisher.name);
  private readonly publisher: Redis;

  constructor(config: ConfigService) {
    this.publisher = new Redis(config.get<string>('redis.url')!);
  }

  private publish(event: string, data: unknown) {
    this.publisher.publish(DOMAIN_EVENTS_CHANNEL, JSON.stringify({ event, data })).catch((err) => {
      this.logger.warn(`Failed to publish ${event} to Redis: ${err}`);
    });
  }

  @OnEvent(DOMAIN_EVENTS.TICKET_CREATED)
  onTicketCreated(payload: TicketCreatedEvent) {
    this.publish(DOMAIN_EVENTS.TICKET_CREATED, payload);
  }

  @OnEvent(DOMAIN_EVENTS.TICKET_UPDATED)
  onTicketUpdated(payload: TicketUpdatedEvent) {
    this.publish(DOMAIN_EVENTS.TICKET_UPDATED, payload);
  }

  @OnEvent(DOMAIN_EVENTS.TICKET_ASSIGNED)
  onTicketAssigned(payload: TicketAssignedEvent) {
    this.publish(DOMAIN_EVENTS.TICKET_ASSIGNED, payload);
  }

  @OnEvent(DOMAIN_EVENTS.MESSAGE_RECEIVED)
  onMessageReceived(payload: MessageReceivedEvent) {
    this.publish(DOMAIN_EVENTS.MESSAGE_RECEIVED, payload);
  }

  @OnEvent(DOMAIN_EVENTS.MESSAGE_SENT)
  onMessageSent(payload: MessageSentEvent) {
    this.publish(DOMAIN_EVENTS.MESSAGE_SENT, payload);
  }

  @OnEvent(DOMAIN_EVENTS.COMMENT_CREATED)
  onCommentCreated(payload: CommentCreatedEvent) {
    this.publish(DOMAIN_EVENTS.COMMENT_CREATED, payload);
  }

  @OnEvent(DOMAIN_EVENTS.AGENT_TYPING)
  onAgentTyping(payload: AgentTypingEvent) {
    this.publish(DOMAIN_EVENTS.AGENT_TYPING, payload);
  }

  @OnEvent(DOMAIN_EVENTS.NOTIFICATION_CREATED)
  onNotificationCreated(payload: NotificationCreatedEvent) {
    this.publish(DOMAIN_EVENTS.NOTIFICATION_CREATED, payload);
  }

  onModuleDestroy() {
    this.publisher.disconnect();
  }
}
