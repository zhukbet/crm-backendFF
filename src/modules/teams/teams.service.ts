import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class TeamsService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.agentTeam.findMany({
      include: { members: { include: { agent: true } } },
      orderBy: { name: 'asc' },
    });
  }

  create(name: string) {
    return this.prisma.agentTeam.create({ data: { name } });
  }

  async addMember(teamId: string, agentId: string) {
    const [team, agent] = await Promise.all([
      this.prisma.agentTeam.findUnique({ where: { id: teamId } }),
      this.prisma.agent.findUnique({ where: { id: agentId } }),
    ]);
    if (!team) throw new NotFoundException('Team not found');
    if (!agent) throw new NotFoundException('Agent not found');

    return this.prisma.teamMember.upsert({
      where: { teamId_agentId: { teamId, agentId } },
      update: {},
      create: { teamId, agentId },
    });
  }

  async removeMember(teamId: string, agentId: string) {
    await this.prisma.teamMember.deleteMany({ where: { teamId, agentId } });
  }
}
