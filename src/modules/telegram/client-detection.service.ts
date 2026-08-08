import { Injectable } from '@nestjs/common';
import { Agent } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

export type SenderClassification =
  { kind: 'agent'; agent: Agent } | { kind: 'excluded' } | { kind: 'customer' };

@Injectable()
export class ClientDetectionService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Section 4: a sender is a customer only if their telegram_user_id is neither an active
   * agent nor an active excluded_sender. This check runs before thread-grouping rules 1-3.
   */
  async classify(telegramUserId: bigint, username?: string): Promise<SenderClassification> {
    const agent = await this.prisma.agent.findUnique({ where: { telegramUserId } });
    if (agent?.isActive) {
      return { kind: 'agent', agent };
    }

    const excludedById = await this.prisma.excludedSender.findUnique({ where: { telegramUserId } });
    if (excludedById?.isActive) {
      return { kind: 'excluded' };
    }

    // Section 8a: the Bot API cannot resolve an arbitrary @username to an id without prior
    // interaction, so an admin-entered record may only have telegram_username until this
    // person's first message. Match by username here and backfill the id once seen.
    if (username) {
      const excludedByUsername = await this.prisma.excludedSender.findFirst({
        where: { telegramUsername: username, telegramUserId: null, isActive: true },
      });
      if (excludedByUsername) {
        await this.prisma.excludedSender.update({
          where: { id: excludedByUsername.id },
          data: { telegramUserId },
        });
        return { kind: 'excluded' };
      }
    }

    return { kind: 'customer' };
  }
}
