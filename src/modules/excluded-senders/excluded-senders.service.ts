import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TelegramService } from '../telegram/telegram.service';

@Injectable()
export class ExcludedSendersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly telegram: TelegramService,
  ) {}

  list(params: { q?: string; isActive?: boolean }) {
    return this.prisma.excludedSender.findMany({
      where: {
        isActive: params.isActive,
        OR: params.q
          ? [
              { name: { contains: params.q, mode: 'insensitive' } },
              { telegramUsername: { contains: params.q, mode: 'insensitive' } },
            ]
          : undefined,
      },
      orderBy: { createdAt: 'desc' },
      include: { addedBy: true },
    });
  }

  async create(params: {
    telegramUserId?: string;
    telegramUsername?: string;
    name?: string;
    note?: string;
    addedByAgentId: string;
  }) {
    if (!params.telegramUserId && !params.telegramUsername) {
      throw new BadRequestException('Provide telegram_user_id or telegram_username');
    }
    return this.prisma.excludedSender.create({
      data: {
        telegramUserId: params.telegramUserId ? BigInt(params.telegramUserId) : undefined,
        telegramUsername: params.telegramUsername?.replace(/^@/, ''),
        name: params.name,
        note: params.note,
        addedByAgentId: params.addedByAgentId,
      },
    });
  }

  async update(id: string, data: { name?: string; note?: string; isActive?: boolean }) {
    const existing = await this.prisma.excludedSender.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Excluded sender not found');
    return this.prisma.excludedSender.update({ where: { id }, data });
  }

  async remove(id: string) {
    const existing = await this.prisma.excludedSender.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Excluded sender not found');
    await this.prisma.excludedSender.delete({ where: { id } });
  }

  /** Best-effort resolve of @username -> telegram_user_id via the Bot API's getChat. */
  async resolveUsername(username: string): Promise<{ telegramUserId: string | null }> {
    const clean = username.replace(/^@/, '');
    try {
      const chat = await this.telegram.bot.api.getChat(`@${clean}`);
      return { telegramUserId: String(chat.id) };
    } catch {
      // Expected for most private users the bot hasn't interacted with yet — the id will be
      // backfilled automatically from their first message (ClientDetectionService).
      return { telegramUserId: null };
    }
  }

  /** Section 8a: "Позначити як не клієнт" — exclude the sender and close the mistaken thread. */
  async markTicketSenderAsNotCustomer(ticketId: string, byAgentId: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      include: { customer: true },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');

    const excluded = await this.prisma.excludedSender.upsert({
      where: { telegramUserId: ticket.customer.telegramUserId },
      update: { isActive: true },
      create: {
        telegramUserId: ticket.customer.telegramUserId,
        telegramUsername: ticket.customer.username,
        name: ticket.customer.displayName,
        note: 'Auto-added from "Mark as not customer"',
        addedByAgentId: byAgentId,
      },
    });

    await this.prisma.ticket.update({
      where: { id: ticketId },
      data: { status: 'closed', closedAt: new Date(), closedById: byAgentId },
    });

    return excluded;
  }
}
