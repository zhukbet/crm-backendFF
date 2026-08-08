import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../common/prisma/prisma.service';
import { DOMAIN_EVENTS } from './events/domain-events';

@Injectable()
export class CommentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  async create(ticketId: string, agentId: string, body: string, mentions: string[] = []) {
    // Internal comments never reach Telegram — separate path/table from Message (section 7).
    const comment = await this.prisma.internalComment.create({
      data: { ticketId, agentId, body, mentions: mentions as any },
    });

    this.events.emit(DOMAIN_EVENTS.COMMENT_CREATED, {
      ticketId,
      commentId: comment.id,
      mentions,
    });
    return comment;
  }

  list(ticketId: string) {
    return this.prisma.internalComment.findMany({
      where: { ticketId },
      orderBy: { createdAt: 'asc' },
      include: { agent: true },
    });
  }
}
