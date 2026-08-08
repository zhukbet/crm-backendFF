import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class SavedViewsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Section 12: personal views (owned by this agent) + shared ones (ownerId null), together. */
  list(agentId: string) {
    return this.prisma.savedView.findMany({
      where: { OR: [{ ownerId: agentId }, { ownerId: null }] },
      orderBy: { name: 'asc' },
    });
  }

  create(agentId: string, name: string, filter: unknown, sort: unknown, personal?: boolean) {
    return this.prisma.savedView.create({
      data: {
        name,
        filter: filter as any,
        sort: sort as any,
        ownerId: personal ? agentId : null,
      },
    });
  }

  private async requireEditable(id: string, agentId: string) {
    const view = await this.prisma.savedView.findUnique({ where: { id } });
    if (!view) throw new NotFoundException('Saved view not found');
    // Shared views (ownerId null) are editable by any agent; personal ones only by their owner.
    if (view.ownerId && view.ownerId !== agentId) {
      throw new ForbiddenException('Not your saved view');
    }
    return view;
  }

  async update(
    id: string,
    agentId: string,
    data: { name?: string; filter?: unknown; sort?: unknown },
  ) {
    await this.requireEditable(id, agentId);
    return this.prisma.savedView.update({
      where: { id },
      data: { name: data.name, filter: data.filter as any, sort: data.sort as any },
    });
  }

  async remove(id: string, agentId: string) {
    await this.requireEditable(id, agentId);
    await this.prisma.savedView.delete({ where: { id } });
  }
}
