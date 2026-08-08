import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  CommentCreatedEvent,
  DOMAIN_EVENTS,
  MessageReceivedEvent,
  TicketAssignedEvent,
} from '../tickets/events/domain-events';
import { NotificationsService } from './notifications.service';

/**
 * Section 10 event triggers, kept as a separate listener (not inside TicketsService/
 * MessagesService) so the notifications feature stays a pure subscriber — exactly the
 * "new feature subscribes to existing events" pattern section 3.3 asks for.
 */
@Injectable()
export class NotificationEventsListener {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  @OnEvent(DOMAIN_EVENTS.MESSAGE_RECEIVED)
  async onMessageReceived(payload: MessageReceivedEvent) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: payload.ticketId },
      select: { assigneeId: true },
    });
    if (!ticket?.assigneeId) return;

    await this.notifications.notify({
      agentId: ticket.assigneeId,
      type: 'message.received',
      ticketId: payload.ticketId,
      payload: { messageId: payload.messageId },
    });
  }

  @OnEvent(DOMAIN_EVENTS.TICKET_ASSIGNED)
  async onTicketAssigned(payload: TicketAssignedEvent) {
    if (!payload.assigneeId || payload.assigneeId === payload.byAgentId) return;

    await this.notifications.notify({
      agentId: payload.assigneeId,
      type: 'ticket.assigned',
      ticketId: payload.ticketId,
      payload: { byAgentId: payload.byAgentId },
    });
  }

  @OnEvent(DOMAIN_EVENTS.COMMENT_CREATED)
  async onCommentCreated(payload: CommentCreatedEvent) {
    await Promise.all(
      payload.mentions.map((agentId) =>
        this.notifications.notify({
          agentId,
          type: 'comment.mention',
          ticketId: payload.ticketId,
          payload: { commentId: payload.commentId },
        }),
      ),
    );
  }
}
