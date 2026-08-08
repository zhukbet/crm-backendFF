import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

interface RangeStats {
  ticketsOpened: number;
  ticketsClosed: number;
  messagesIn: number;
  messagesOut: number;
  avgFirstResponseSec: number | null;
  avgResolutionSec: number | null;
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round(values.reduce((sum, v) => sum + v, 0) / values.length);
}

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  private async computeStatsForRange(chatId: string, start: Date, end: Date): Promise<RangeStats> {
    const [
      ticketsOpened,
      ticketsClosed,
      messagesIn,
      messagesOut,
      firstResponseTickets,
      resolvedTickets,
    ] = await Promise.all([
      this.prisma.ticket.count({ where: { chatId, createdAt: { gte: start, lt: end } } }),
      this.prisma.ticket.count({ where: { chatId, closedAt: { gte: start, lt: end } } }),
      this.prisma.message.count({
        where: { ticket: { chatId }, direction: 'in', createdAt: { gte: start, lt: end } },
      }),
      this.prisma.message.count({
        where: { ticket: { chatId }, direction: 'out', createdAt: { gte: start, lt: end } },
      }),
      this.prisma.ticket.findMany({
        where: { chatId, firstResponseAt: { gte: start, lt: end } },
        select: { createdAt: true, firstResponseAt: true },
      }),
      this.prisma.ticket.findMany({
        where: { chatId, resolvedAt: { gte: start, lt: end } },
        select: { createdAt: true, resolvedAt: true },
      }),
    ]);

    return {
      ticketsOpened,
      ticketsClosed,
      messagesIn,
      messagesOut,
      avgFirstResponseSec: average(
        firstResponseTickets.map(
          (t) => (t.firstResponseAt!.getTime() - t.createdAt.getTime()) / 1000,
        ),
      ),
      avgResolutionSec: average(
        resolvedTickets.map((t) => (t.resolvedAt!.getTime() - t.createdAt.getTime()) / 1000),
      ),
    };
  }

  /** Seq 36: the background job's unit of work — one chat, one calendar day. */
  async aggregateDailyForChat(chatId: string, date: Date): Promise<void> {
    const dayStart = startOfDay(date);
    const stats = await this.computeStatsForRange(chatId, dayStart, addDays(dayStart, 1));

    await this.prisma.chatStatsDaily.upsert({
      where: { chatId_date: { chatId, date: dayStart } },
      create: { chatId, date: dayStart, ...stats },
      update: stats,
    });
  }

  async aggregateAllChatsForDate(date: Date): Promise<number> {
    const chats = await this.prisma.chat.findMany({ select: { id: true } });
    for (const chat of chats) {
      await this.aggregateDailyForChat(chat.id, date);
    }
    return chats.length;
  }

  /**
   * Seq 37: /analytics/chats. Sums pre-aggregated chat_stats_daily rows for the range, and
   * only computes "today" live (section 11: "на льоту дорахувати лише сьогодні") since the
   * background job only ever fills in *past* days.
   */
  async getChatsAnalytics(params: { from: Date; to: Date; chatGroupId?: string }) {
    const chats = await this.prisma.chat.findMany({
      where: { chatGroupId: params.chatGroupId },
      select: { id: true, title: true },
    });
    const todayStart = startOfDay(new Date());

    return Promise.all(
      chats.map(async (chat) => {
        const storedRows = await this.prisma.chatStatsDaily.findMany({
          where: {
            chatId: chat.id,
            date: { gte: startOfDay(params.from), lt: todayStart, lte: params.to },
          },
        });

        const rangesToSum: RangeStats[] = storedRows;
        if (params.to >= todayStart) {
          rangesToSum.push(
            await this.computeStatsForRange(chat.id, todayStart, addDays(todayStart, 1)),
          );
        }

        const backlog = await this.prisma.ticket.count({
          where: { chatId: chat.id, status: { notIn: ['solved', 'closed'] } },
        });

        return {
          chatId: chat.id,
          title: chat.title,
          ticketsOpened: rangesToSum.reduce((sum, r) => sum + r.ticketsOpened, 0),
          ticketsClosed: rangesToSum.reduce((sum, r) => sum + r.ticketsClosed, 0),
          messagesIn: rangesToSum.reduce((sum, r) => sum + r.messagesIn, 0),
          messagesOut: rangesToSum.reduce((sum, r) => sum + r.messagesOut, 0),
          // Unweighted mean across days — chat_stats_daily only stores per-day averages, not
          // the underlying per-ticket samples, so a ticket-count-weighted mean isn't available
          // without changing that table's shape. Good enough for an MVP trend indicator.
          avgFirstResponseSec: average(
            rangesToSum.map((r) => r.avgFirstResponseSec).filter((v): v is number => v !== null),
          ),
          avgResolutionSec: average(
            rangesToSum.map((r) => r.avgResolutionSec).filter((v): v is number => v !== null),
          ),
          backlog,
        };
      }),
    );
  }

  /** Seq 37: /analytics/overview — load by agent, volume by label, over the given range. */
  async getOverview(params: { from: Date; to: Date }) {
    const [ticketsCreated, byAgentRaw, byLabelRaw] = await Promise.all([
      this.prisma.ticket.count({ where: { createdAt: { gte: params.from, lte: params.to } } }),
      this.prisma.ticket.groupBy({
        by: ['assigneeId'],
        where: { createdAt: { gte: params.from, lte: params.to } },
        _count: true,
      }),
      this.prisma.ticketLabel.groupBy({
        by: ['labelId'],
        where: { ticket: { createdAt: { gte: params.from, lte: params.to } } },
        _count: true,
      }),
    ]);

    const agentIds = byAgentRaw.map((a) => a.assigneeId).filter((id): id is string => id !== null);
    const [agents, labels] = await Promise.all([
      this.prisma.agent.findMany({ where: { id: { in: agentIds } } }),
      this.prisma.label.findMany({ where: { id: { in: byLabelRaw.map((l) => l.labelId) } } }),
    ]);

    return {
      ticketsCreated,
      byAgent: byAgentRaw.map((row) => ({
        agentId: row.assigneeId,
        agentName: row.assigneeId
          ? agents.find((a) => a.id === row.assigneeId)?.name
          : 'Unassigned',
        count: row._count,
      })),
      byLabel: byLabelRaw.map((row) => ({
        labelId: row.labelId,
        labelName: labels.find((l) => l.id === row.labelId)?.name,
        count: row._count,
      })),
    };
  }
}
