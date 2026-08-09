import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, RoutingStrategy, TicketPriority } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class ChatsService {
  constructor(private readonly prisma: PrismaService) {}

  async findOrCreateByTelegramId(telegramChatId: bigint, title: string) {
    const existing = await this.prisma.chat.findUnique({ where: { telegramChatId } });
    if (existing) return existing;
    return this.prisma.chat.create({ data: { telegramChatId, title } });
  }

  list() {
    return this.prisma.chat.findMany({
      include: { chatGroup: true },
      orderBy: { title: 'asc' },
    });
  }

  async getById(id: string) {
    const chat = await this.prisma.chat.findUnique({ where: { id }, include: { chatGroup: true } });
    if (!chat) throw new NotFoundException('Chat not found');
    return chat;
  }

  /** Section 8б: per-chat defaults applied to new tickets originating in this chat. */
  async updateSettings(
    id: string,
    data: {
      chatGroupId?: string | null;
      defaultTeamId?: string | null;
      defaultAssigneeId?: string | null;
      routingStrategy?: RoutingStrategy;
      defaultPriority?: TicketPriority;
      tags?: unknown[];
    },
  ) {
    await this.getById(id);
    return this.prisma.chat.update({
      where: { id },
      data: data as Prisma.ChatUncheckedUpdateInput,
    });
  }

  createGroup(name: string, color?: string, description?: string) {
    return this.prisma.chatGroup.create({ data: { name, color, description } });
  }

  listGroups() {
    return this.prisma.chatGroup.findMany({ orderBy: { name: 'asc' } });
  }

  /** Section 8б: chat directory — search/filter with per-chat volume/backlog counts. */
  async directory(params: { chatGroupId?: string; q?: string }) {
    const chats = await this.prisma.chat.findMany({
      where: {
        chatGroupId: params.chatGroupId,
        title: params.q ? { contains: params.q, mode: 'insensitive' } : undefined,
      },
      include: { chatGroup: true },
      orderBy: { title: 'asc' },
    });

    const stats = await this.prisma.ticket.groupBy({
      by: ['chatId', 'status'],
      where: { chatId: { in: chats.map((c) => c.id) } },
      _count: true,
    });

    return chats.map((chat) => {
      const chatStats = stats.filter((s) => s.chatId === chat.id);
      const open = chatStats
        .filter((s) => s.status !== 'closed' && s.status !== 'solved' && s.status !== 'archived')
        .reduce((sum, s) => sum + s._count, 0);
      const total = chatStats.reduce((sum, s) => sum + s._count, 0);
      return { ...chat, backlog: open, ticketsTotal: total };
    });
  }
}
