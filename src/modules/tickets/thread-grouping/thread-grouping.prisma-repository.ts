import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import {
  ActiveTicketForCustomer,
  ThreadGroupingRepository,
  TicketAnchorLookup,
} from './thread-grouping.types';

@Injectable()
export class PrismaThreadGroupingRepository implements ThreadGroupingRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findTicketByAnchorMessage(
    chatId: string,
    tgMessageId: bigint,
  ): Promise<TicketAnchorLookup | null> {
    const message = await this.prisma.message.findFirst({
      where: { tgMessageId, ticket: { chatId } },
      select: { ticket: { select: { id: true, status: true } } },
      orderBy: { createdAt: 'desc' },
    });
    if (!message) return null;
    return { ticketId: message.ticket.id, status: message.ticket.status as any };
  }

  async findMostRecentActiveTicket(
    chatId: string,
    customerId: string,
  ): Promise<ActiveTicketForCustomer | null> {
    const ticket = await this.prisma.ticket.findFirst({
      where: { chatId, customerId, status: { not: 'closed' } },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, status: true, updatedAt: true },
    });
    if (!ticket) return null;
    return { ticketId: ticket.id, status: ticket.status as any, lastActivityAt: ticket.updatedAt };
  }
}
