export const DOMAIN_EVENTS = {
  TICKET_CREATED: 'ticket.created',
  TICKET_UPDATED: 'ticket.updated',
  TICKET_ASSIGNED: 'ticket.assigned',
  TICKET_CLOSED: 'ticket.closed',
  MESSAGE_RECEIVED: 'message.received',
  MESSAGE_SENT: 'message.sent',
  COMMENT_CREATED: 'comment.created',
  AGENT_TYPING: 'agent.typing',
} as const;

export interface TicketCreatedEvent {
  ticketId: string;
}
export interface TicketUpdatedEvent {
  ticketId: string;
  changes: Record<string, unknown>;
}
export interface TicketAssignedEvent {
  ticketId: string;
  assigneeId: string | null;
  previousAssigneeId: string | null;
  byAgentId: string;
}
export interface TicketClosedEvent {
  ticketId: string;
  byAgentId: string;
}
export interface MessageReceivedEvent {
  ticketId: string;
  messageId: string;
  isNewTicket: boolean;
}
export interface MessageSentEvent {
  ticketId: string;
  messageId: string;
  agentId: string;
}
export interface CommentCreatedEvent {
  ticketId: string;
  commentId: string;
  mentions: string[];
}
export interface AgentTypingEvent {
  ticketId: string;
  agentId: string;
}
