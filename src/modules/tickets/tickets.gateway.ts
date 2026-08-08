import { Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../../common/prisma/prisma.service';
import { SessionService } from '../auth/session.service';
import {
  AgentTypingEvent,
  CommentCreatedEvent,
  DOMAIN_EVENTS,
  MessageReceivedEvent,
  MessageSentEvent,
  TicketAssignedEvent,
  TicketCreatedEvent,
  TicketUpdatedEvent,
} from './events/domain-events';

function extractCookie(cookieHeader: string | undefined, name: string): string | undefined {
  if (!cookieHeader) return undefined;
  const match = cookieHeader
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : undefined;
}

/**
 * Section 6/15: ticket:new, ticket:updated, ticket:assigned, message:new, comment:new,
 * agent:typing, notification:new. Domain events -> WS broadcast is one-directional (server
 * push); agent:typing is the one client -> server -> other clients event, scoped to a
 * per-ticket room clients join explicitly.
 *
 * Simplification: connections are gated by the same session cookie as REST (must be an active
 * agent), but there is no further per-ticket/per-team authorization — any connected agent
 * receives every ticket event. Fine for the current single-tenant MVP; revisit if that changes.
 */
@WebSocketGateway({
  namespace: '/ws',
  cors: { origin: process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173', credentials: true },
})
export class TicketsGateway implements OnGatewayConnection {
  @WebSocketServer() server!: Server;

  private readonly logger = new Logger(TicketsGateway.name);

  constructor(
    private readonly sessions: SessionService,
    private readonly prisma: PrismaService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    const token = extractCookie(client.handshake.headers.cookie, this.sessions.cookieName);
    const claims = token ? this.sessions.verify(token) : null;
    if (!claims) {
      client.disconnect(true);
      return;
    }

    const agent = await this.prisma.agent.findUnique({ where: { id: claims.sub } });
    if (!agent?.isActive) {
      client.disconnect(true);
      return;
    }

    client.data.agentId = agent.id;
  }

  @SubscribeMessage('ticket:join')
  handleJoinTicket(@ConnectedSocket() client: Socket, @MessageBody() data: { ticketId: string }) {
    client.join(`ticket:${data.ticketId}`);
  }

  @SubscribeMessage('ticket:leave')
  handleLeaveTicket(@ConnectedSocket() client: Socket, @MessageBody() data: { ticketId: string }) {
    client.leave(`ticket:${data.ticketId}`);
  }

  @SubscribeMessage('agent:typing')
  handleAgentTyping(@ConnectedSocket() client: Socket, @MessageBody() data: { ticketId: string }) {
    const agentId = client.data.agentId as string;
    client.to(`ticket:${data.ticketId}`).emit('agent:typing', { ticketId: data.ticketId, agentId });
  }

  @OnEvent(DOMAIN_EVENTS.TICKET_CREATED)
  onTicketCreated(payload: TicketCreatedEvent) {
    this.server?.emit('ticket:new', payload);
  }

  @OnEvent(DOMAIN_EVENTS.TICKET_UPDATED)
  onTicketUpdated(payload: TicketUpdatedEvent) {
    this.server?.emit('ticket:updated', payload);
  }

  @OnEvent(DOMAIN_EVENTS.TICKET_ASSIGNED)
  onTicketAssigned(payload: TicketAssignedEvent) {
    this.server?.emit('ticket:assigned', payload);
  }

  @OnEvent(DOMAIN_EVENTS.MESSAGE_RECEIVED)
  onMessageReceived(payload: MessageReceivedEvent) {
    this.server?.emit('message:new', payload);
  }

  @OnEvent(DOMAIN_EVENTS.MESSAGE_SENT)
  onMessageSent(payload: MessageSentEvent) {
    this.server?.emit('message:new', payload);
  }

  @OnEvent(DOMAIN_EVENTS.COMMENT_CREATED)
  onCommentCreated(payload: CommentCreatedEvent) {
    this.server?.emit('comment:new', payload);
  }

  @OnEvent(DOMAIN_EVENTS.AGENT_TYPING)
  onAgentTyping(payload: AgentTypingEvent) {
    this.server?.to(`ticket:${payload.ticketId}`).emit('agent:typing', payload);
  }
}
