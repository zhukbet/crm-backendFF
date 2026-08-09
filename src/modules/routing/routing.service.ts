import { Injectable } from '@nestjs/common';
import { Chat } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

export interface RoutingDecision {
  teamId: string | null;
  assigneeId: string | null;
}

/** Section 9: manual / round_robin / least_busy, decided per-chat at ticket-creation time. */
@Injectable()
export class RoutingService {
  constructor(private readonly prisma: PrismaService) {}

  async decideAssignment(chat: Chat): Promise<RoutingDecision> {
    if (chat.routingStrategy === 'manual' || !chat.defaultTeamId) {
      return { teamId: chat.defaultTeamId, assigneeId: chat.defaultAssigneeId };
    }

    const members = await this.prisma.teamMember.findMany({
      where: { teamId: chat.defaultTeamId, agent: { isActive: true } },
      select: { agentId: true },
    });
    if (members.length === 0) {
      return { teamId: chat.defaultTeamId, assigneeId: chat.defaultAssigneeId };
    }
    const memberIds = members.map((m) => m.agentId);

    if (chat.routingStrategy === 'least_busy') {
      const openCounts = await this.prisma.ticket.groupBy({
        by: ['assigneeId'],
        where: {
          assigneeId: { in: memberIds },
          status: { notIn: ['solved', 'closed', 'archived'] },
        },
        _count: true,
      });
      const countByAgent = new Map(memberIds.map((id) => [id, 0]));
      for (const row of openCounts) {
        if (row.assigneeId) countByAgent.set(row.assigneeId, row._count);
      }
      const [leastBusyAgentId] = [...countByAgent.entries()].sort((a, b) => a[1] - b[1])[0];
      return { teamId: chat.defaultTeamId, assigneeId: leastBusyAgentId };
    }

    // round_robin: pick whoever in the team was assigned longest ago (or never), approximating
    // a rotating cursor without needing extra persisted state.
    const lastAssigned = await this.prisma.ticket.groupBy({
      by: ['assigneeId'],
      where: { assigneeId: { in: memberIds } },
      _max: { createdAt: true },
    });
    const lastAssignedAt = new Map(memberIds.map((id) => [id, new Date(0)]));
    for (const row of lastAssigned) {
      if (row.assigneeId && row._max.createdAt)
        lastAssignedAt.set(row.assigneeId, row._max.createdAt);
    }
    const [nextAgentId] = [...lastAssignedAt.entries()].sort(
      (a, b) => a[1].getTime() - b[1].getTime(),
    )[0];
    return { teamId: chat.defaultTeamId, assigneeId: nextAgentId };
  }
}
