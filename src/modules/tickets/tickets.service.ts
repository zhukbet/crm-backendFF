import { Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma, TicketPriority, TicketStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ListTicketsQueryDto } from './dto/list-tickets.dto';
import { PatchTicketDto } from './dto/patch-ticket.dto';
import { DOMAIN_EVENTS } from './events/domain-events';

const TICKET_INCLUDE = {
  chat: true,
  customer: true,
  assignee: true,
  team: true,
  labels: { include: { label: true } },
} satisfies Prisma.TicketInclude;

@Injectable()
export class TicketsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  async list(query: ListTicketsQueryDto) {
    const where: Prisma.TicketWhereInput = {};

    if (query.view) {
      const view = await this.prisma.savedView.findUnique({ where: { id: query.view } });
      if (view) {
        const filter = view.filter as Record<string, unknown>;
        if (Array.isArray(filter.status)) where.status = { in: filter.status as TicketStatus[] };
        if (filter.assigneeId === null) where.assigneeId = null;
        else if (typeof filter.assigneeId === 'string') where.assigneeId = filter.assigneeId;
      }
    }

    if (query.status) where.status = query.status as TicketStatus;
    if (query.assignee) where.assigneeId = query.assignee === 'unassigned' ? null : query.assignee;
    if (query.team) where.teamId = query.team;
    if (query.chat) where.chatId = query.chat;
    if (query.chat_group) where.chat = { chatGroupId: query.chat_group };
    if (query.label) where.labels = { some: { labelId: query.label } };
    if (query.q) {
      where.OR = [
        { customer: { displayName: { contains: query.q, mode: 'insensitive' } } },
        { customer: { username: { contains: query.q, mode: 'insensitive' } } },
        { messages: { some: { text: { contains: query.q, mode: 'insensitive' } } } },
      ];
    }

    const items = await this.prisma.ticket.findMany({
      where,
      include: TICKET_INCLUDE,
      orderBy: { updatedAt: 'desc' },
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });

    const hasMore = items.length > query.limit;
    const page = hasMore ? items.slice(0, query.limit) : items;

    return {
      data: page,
      next_cursor: hasMore ? page[page.length - 1].id : null,
    };
  }

  /** Rule 3 of section 4: a fresh customer message with nowhere to attach starts a new thread. */
  async createForNewThread(params: {
    chatId: string;
    customerId: string;
    anchorMessageTgId: bigint;
    priority?: TicketPriority;
    teamId?: string | null;
    assigneeId?: string | null;
  }) {
    const ticket = await this.prisma.ticket.create({
      data: {
        chatId: params.chatId,
        customerId: params.customerId,
        anchorMessageTgId: params.anchorMessageTgId,
        lastClientMessageTgId: params.anchorMessageTgId,
        priority: params.priority,
        teamId: params.teamId ?? undefined,
        assigneeId: params.assigneeId ?? undefined,
      },
      include: TICKET_INCLUDE,
    });
    this.events.emit(DOMAIN_EVENTS.TICKET_CREATED, { ticketId: ticket.id });
    return ticket;
  }

  async getById(id: string) {
    const ticket = await this.prisma.ticket.findUnique({ where: { id }, include: TICKET_INCLUDE });
    if (!ticket) throw new NotFoundException('Ticket not found');
    return ticket;
  }

  private async requireTicket(id: string) {
    const ticket = await this.prisma.ticket.findUnique({ where: { id } });
    if (!ticket) throw new NotFoundException('Ticket not found');
    return ticket;
  }

  async patch(id: string, dto: PatchTicketDto, byAgentId: string | null) {
    await this.requireTicket(id);

    const data: Prisma.TicketUpdateInput = {};
    if (dto.status) data.status = dto.status as TicketStatus;
    if (dto.priority) data.priority = dto.priority;
    if (dto.assignee_id !== undefined) {
      data.assignee = dto.assignee_id ? { connect: { id: dto.assignee_id } } : { disconnect: true };
    }
    if (dto.team_id !== undefined) {
      data.team = dto.team_id ? { connect: { id: dto.team_id } } : { disconnect: true };
    }
    if (dto.snooze_until !== undefined) {
      data.snoozeUntil = dto.snooze_until ? new Date(dto.snooze_until) : null;
    }
    if (dto.jira_key !== undefined) data.jiraKey = dto.jira_key;
    if (dto.status === 'closed') {
      data.closedAt = new Date();
      if (byAgentId) data.closedBy = { connect: { id: byAgentId } };
    }
    if (dto.status === 'solved' && !data.resolvedAt) {
      data.resolvedAt = new Date();
    }

    const ticket = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.ticket.update({ where: { id }, data, include: TICKET_INCLUDE });

      if (dto.labels) {
        await tx.ticketLabel.deleteMany({ where: { ticketId: id } });
        await tx.ticketLabel.createMany({
          data: dto.labels.map((labelId) => ({ ticketId: id, labelId })),
        });
      }

      await tx.ticketEvent.create({
        data: {
          ticketId: id,
          agentId: byAgentId ?? undefined,
          type: 'updated',
          payload: dto as any,
        },
      });

      return updated;
    });

    this.events.emit(DOMAIN_EVENTS.TICKET_UPDATED, { ticketId: id, changes: dto });
    if (dto.status === 'closed') {
      this.events.emit(DOMAIN_EVENTS.TICKET_CLOSED, { ticketId: id, byAgentId });
    }
    return ticket;
  }

  async assign(id: string, agentId: string, byAgentId: string, reason?: string) {
    const ticket = await this.requireTicket(id);
    const previousAssigneeId = ticket.assigneeId;

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.ticket.update({
        where: { id },
        data: { assigneeId: agentId },
        include: TICKET_INCLUDE,
      });
      await tx.ticketEvent.create({
        data: {
          ticketId: id,
          agentId: byAgentId,
          type: 'assigned',
          payload: { agentId, previousAssigneeId, reason },
        },
      });
      return result;
    });

    this.events.emit(DOMAIN_EVENTS.TICKET_ASSIGNED, {
      ticketId: id,
      assigneeId: agentId,
      previousAssigneeId,
      byAgentId,
    });
    return updated;
  }

  async close(id: string, byAgentId: string) {
    return this.patch(id, { status: 'closed' }, byAgentId);
  }

  async reopen(id: string, byAgentId: string) {
    return this.patch(id, { status: 'open' }, byAgentId);
  }

  async snooze(id: string, until: string, byAgentId: string) {
    return this.patch(id, { status: 'on_hold', snooze_until: until }, byAgentId);
  }

  async bulk(
    ticketIds: string[],
    action: 'assign' | 'close' | 'label',
    payload: Record<string, unknown>,
    byAgentId: string,
  ) {
    const results = [];
    for (const id of ticketIds) {
      if (action === 'assign') {
        results.push(await this.assign(id, payload.agent_id as string, byAgentId));
      } else if (action === 'close') {
        results.push(await this.close(id, byAgentId));
      } else if (action === 'label') {
        const ticket = await this.getById(id);
        const labelIds = new Set(ticket.labels.map((l) => l.labelId));
        labelIds.add(payload.label_id as string);
        results.push(await this.patch(id, { labels: Array.from(labelIds) }, byAgentId));
      }
    }
    return results;
  }
}
