import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  async findOrCreateByTelegramId(
    telegramUserId: bigint,
    username: string | undefined,
    displayName: string,
  ) {
    const existing = await this.prisma.customer.findUnique({ where: { telegramUserId } });
    if (existing) {
      if (existing.username !== username || existing.displayName !== displayName) {
        return this.prisma.customer.update({
          where: { id: existing.id },
          data: { username, displayName },
        });
      }
      return existing;
    }
    return this.prisma.customer.create({ data: { telegramUserId, username, displayName } });
  }

  async ticketHistory(customerId: string) {
    return this.prisma.ticket.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
      include: { chat: true },
    });
  }
}
