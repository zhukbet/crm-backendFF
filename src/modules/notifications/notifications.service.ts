import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NotificationChannel } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { DOMAIN_EVENTS } from '../tickets/events/domain-events';
import { TelegramService } from '../telegram/telegram.service';

const DEDUP_WINDOW_MINUTES = 5;

const MESSAGE_BY_TYPE: Record<string, (payload: Record<string, unknown>) => string> = {
  'message.received': () => 'Нове повідомлення в заасайненому на вас треді.',
  'ticket.assigned': () => 'Вам призначили тікет.',
  'comment.mention': () => 'Вас згадали у внутрішньому коментарі.',
};

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
    private readonly telegram: TelegramService,
  ) {}

  /**
   * Section 10: creates (or, per Seq 32, refreshes) a notification and dispatches it over the
   * agent's enabled channels. Called from NotificationEventsListener in reaction to domain
   * events — never directly from REST controllers.
   */
  async notify(params: {
    agentId: string;
    type: string;
    ticketId?: string;
    payload?: Record<string, unknown>;
  }) {
    // Seq 32 dedup: several events of the same type on the same ticket within a short window
    // refresh one notification (bump timestamp, mark unread again) instead of spamming.
    const existing = await this.prisma.notification.findFirst({
      where: {
        agentId: params.agentId,
        ticketId: params.ticketId,
        type: params.type,
        createdAt: { gte: new Date(Date.now() - DEDUP_WINDOW_MINUTES * 60_000) },
      },
      orderBy: { createdAt: 'desc' },
    });

    const notification = existing
      ? await this.prisma.notification.update({
          where: { id: existing.id },
          data: { payload: (params.payload ?? {}) as any, isRead: false, createdAt: new Date() },
        })
      : await this.prisma.notification.create({
          data: {
            agentId: params.agentId,
            type: params.type,
            ticketId: params.ticketId,
            payload: (params.payload ?? {}) as any,
          },
        });

    this.events.emit(DOMAIN_EVENTS.NOTIFICATION_CREATED, {
      notificationId: notification.id,
      agentId: params.agentId,
      type: params.type,
      ticketId: params.ticketId,
    });

    if (!existing) {
      // Only dispatch to external channels (Telegram DM) on first creation — a refreshed
      // dedup window shouldn't re-send a DM the agent already saw.
      await this.dispatchExternalChannels(notification.agentId, params.type, params.payload ?? {});
    }

    return notification;
  }

  private async dispatchExternalChannels(
    agentId: string,
    type: string,
    payload: Record<string, unknown>,
  ) {
    const agent = await this.prisma.agent.findUnique({ where: { id: agentId } });
    if (!agent) return;

    const pref = await this.prisma.notificationPref.findUnique({
      where: {
        agentId_channel_eventType: { agentId, channel: 'telegram', eventType: type },
      },
    });
    // Default to enabled if the agent hasn't explicitly configured this event/channel pair.
    const telegramEnabled = pref?.enabled ?? true;
    if (!telegramEnabled) return;

    const formatter = MESSAGE_BY_TYPE[type] ?? (() => `Нова подія: ${type}`);
    try {
      await this.telegram.sendDirectMessage(agent.telegramUserId, formatter(payload));
    } catch (err) {
      this.logger.warn(`Failed to deliver Telegram DM notification to agent ${agentId}: ${err}`);
    }
  }

  list(agentId: string, unreadOnly?: boolean) {
    return this.prisma.notification.findMany({
      where: { agentId, isRead: unreadOnly ? false : undefined },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async markRead(id: string, agentId: string) {
    await this.prisma.notification.updateMany({ where: { id, agentId }, data: { isRead: true } });
  }

  async markAllRead(agentId: string) {
    await this.prisma.notification.updateMany({
      where: { agentId, isRead: false },
      data: { isRead: true },
    });
  }

  getPrefs(agentId: string) {
    return this.prisma.notificationPref.findMany({ where: { agentId } });
  }

  async updatePref(
    agentId: string,
    channel: NotificationChannel,
    eventType: string,
    enabled: boolean,
  ) {
    return this.prisma.notificationPref.upsert({
      where: { agentId_channel_eventType: { agentId, channel, eventType } },
      create: { agentId, channel, eventType, enabled },
      update: { enabled },
    });
  }
}
