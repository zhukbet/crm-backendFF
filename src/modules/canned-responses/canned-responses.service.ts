import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class CannedResponsesService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.cannedResponse.findMany({ orderBy: { title: 'asc' } });
  }

  create(title: string, body: string, scope: string | undefined, variables: unknown[] | undefined) {
    return this.prisma.cannedResponse.create({
      data: { title, body, scope: scope ?? 'global', variables: (variables ?? []) as any },
    });
  }

  async update(
    id: string,
    data: { title?: string; body?: string; scope?: string; variables?: unknown[] },
  ) {
    const existing = await this.prisma.cannedResponse.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Canned response not found');
    return this.prisma.cannedResponse.update({
      where: { id },
      data: { ...data, variables: data.variables as any },
    });
  }

  async remove(id: string) {
    const existing = await this.prisma.cannedResponse.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Canned response not found');
    await this.prisma.cannedResponse.delete({ where: { id } });
  }
}
