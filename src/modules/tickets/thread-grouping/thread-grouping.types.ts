export type ReopenableTicketStatus = 'open' | 'pending' | 'on_hold' | 'solved';

export interface TicketAnchorLookup {
  ticketId: string;
  status: ReopenableTicketStatus | 'closed';
}

export interface ActiveTicketForCustomer {
  ticketId: string;
  status: ReopenableTicketStatus | 'closed';
  lastActivityAt: Date;
}

/**
 * Narrow read port the domain logic needs from storage. Kept separate from PrismaService so
 * the grouping rules (section 4 of the spec) can be unit-tested with an in-memory fake instead
 * of a live database.
 */
export interface ThreadGroupingRepository {
  /** Rule 1: find which ticket (if any) owns the message being replied to, within this chat. */
  findTicketByAnchorMessage(
    chatId: string,
    tgMessageId: bigint,
  ): Promise<TicketAnchorLookup | null>;

  /** Rule 2: find the most recently active non-closed ticket for this customer in this chat. */
  findMostRecentActiveTicket(
    chatId: string,
    customerId: string,
  ): Promise<ActiveTicketForCustomer | null>;
}

export type ThreadGroupingDecision =
  | { action: 'attach'; ticketId: string; revive: boolean; matchedRule: 1 | 2 }
  | { action: 'create-new'; matchedRule: 3 };
