import { Inject, Injectable } from '@nestjs/common';
import { THREAD_GROUPING_REPOSITORY } from './thread-grouping.tokens';
import { ThreadGroupingDecision, ThreadGroupingRepository } from './thread-grouping.types';

const REOPENABLE = new Set(['open', 'pending', 'on_hold', 'solved']);
const TERMINAL = new Set(['closed', 'archived']);

export interface ThreadGroupingInput {
  chatId: string;
  customerId: string;
  replyToTgMessageId?: bigint;
  idleWindowMinutes: number;
  now: Date;
}

/**
 * Implements section 4 of the spec: belonging of an incoming customer message to a thread,
 * in priority order. Must be called only for messages already classified as "from a customer"
 * (i.e. after ClientDetectionService ruled out agents and excluded_senders).
 */
@Injectable()
export class ThreadGroupingService {
  constructor(
    @Inject(THREAD_GROUPING_REPOSITORY) private readonly repo: ThreadGroupingRepository,
  ) {}

  async decide(input: ThreadGroupingInput): Promise<ThreadGroupingDecision> {
    // Rule 1: reply to a message that already belongs to a thread — always wins, regardless
    // of how long ago that thread was active, and revives it even if pending/on_hold/solved.
    if (input.replyToTgMessageId !== undefined) {
      const anchor = await this.repo.findTicketByAnchorMessage(
        input.chatId,
        input.replyToTgMessageId,
      );
      if (anchor && !TERMINAL.has(anchor.status)) {
        return {
          action: 'attach',
          ticketId: anchor.ticketId,
          revive: anchor.status !== 'open',
          matchedRule: 1,
        };
      }
    }

    // Rule 2: same customer, same chat, an active (non-closed) thread with activity within
    // the idle window — the common path for group chats where people rarely use reply.
    const active = await this.repo.findMostRecentActiveTicket(input.chatId, input.customerId);
    if (active && REOPENABLE.has(active.status)) {
      const minutesSinceActivity = (input.now.getTime() - active.lastActivityAt.getTime()) / 60_000;
      if (minutesSinceActivity < input.idleWindowMinutes) {
        return {
          action: 'attach',
          ticketId: active.ticketId,
          revive: active.status !== 'open',
          matchedRule: 2,
        };
      }
    }

    // Rule 3: nothing matched — a brand new thread starts, anchored on this very message.
    return { action: 'create-new', matchedRule: 3 };
  }
}
