import { ThreadGroupingService } from './thread-grouping.service';
import {
  ActiveTicketForCustomer,
  ThreadGroupingRepository,
  TicketAnchorLookup,
} from './thread-grouping.types';

class FakeThreadGroupingRepository implements ThreadGroupingRepository {
  anchor: TicketAnchorLookup | null = null;
  active: ActiveTicketForCustomer | null = null;

  async findTicketByAnchorMessage(): Promise<TicketAnchorLookup | null> {
    return this.anchor;
  }

  async findMostRecentActiveTicket(): Promise<ActiveTicketForCustomer | null> {
    return this.active;
  }
}

describe('ThreadGroupingService (spec. section 4)', () => {
  let repo: FakeThreadGroupingRepository;
  let service: ThreadGroupingService;
  const now = new Date('2026-01-01T12:00:00Z');

  beforeEach(() => {
    repo = new FakeThreadGroupingRepository();
    service = new ThreadGroupingService(repo);
  });

  it('rule 1: attaches to the ticket owning the replied-to message, even over rule 2 candidates', async () => {
    repo.anchor = { ticketId: 'ticket-anchor', status: 'open' };
    repo.active = { ticketId: 'ticket-other', status: 'open', lastActivityAt: now };

    const decision = await service.decide({
      chatId: 'chat-1',
      customerId: 'cust-1',
      replyToTgMessageId: 42n,
      idleWindowMinutes: 180,
      now,
    });

    expect(decision).toEqual({ action: 'attach', ticketId: 'ticket-anchor', revive: false, matchedRule: 1 });
  });

  it('rule 1: revives a pending/on_hold/solved thread when replied to', async () => {
    repo.anchor = { ticketId: 'ticket-anchor', status: 'on_hold' };

    const decision = await service.decide({
      chatId: 'chat-1',
      customerId: 'cust-1',
      replyToTgMessageId: 42n,
      idleWindowMinutes: 180,
      now,
    });

    expect(decision).toEqual({ action: 'attach', ticketId: 'ticket-anchor', revive: true, matchedRule: 1 });
  });

  it('rule 1: a reply targeting a message in a closed ticket does not reopen it, falls through to rule 2/3', async () => {
    repo.anchor = { ticketId: 'ticket-closed', status: 'closed' };
    repo.active = null;

    const decision = await service.decide({
      chatId: 'chat-1',
      customerId: 'cust-1',
      replyToTgMessageId: 42n,
      idleWindowMinutes: 180,
      now,
    });

    expect(decision).toEqual({ action: 'create-new', matchedRule: 3 });
  });

  it('rule 2: attaches to an existing open thread for the same customer+chat within the idle window', async () => {
    repo.active = {
      ticketId: 'ticket-2',
      status: 'open',
      lastActivityAt: new Date(now.getTime() - 60 * 60_000), // 60 min ago
    };

    const decision = await service.decide({
      chatId: 'chat-1',
      customerId: 'cust-1',
      idleWindowMinutes: 180,
      now,
    });

    expect(decision).toEqual({ action: 'attach', ticketId: 'ticket-2', revive: false, matchedRule: 2 });
  });

  it('rule 2: exactly at the idle-window boundary counts as expired (strict less-than)', async () => {
    repo.active = {
      ticketId: 'ticket-2',
      status: 'open',
      lastActivityAt: new Date(now.getTime() - 180 * 60_000), // exactly 180 min ago
    };

    const decision = await service.decide({
      chatId: 'chat-1',
      customerId: 'cust-1',
      idleWindowMinutes: 180,
      now,
    });

    expect(decision).toEqual({ action: 'create-new', matchedRule: 3 });
  });

  it('rule 2: revives a pending/on_hold/solved thread within the idle window', async () => {
    repo.active = {
      ticketId: 'ticket-2',
      status: 'pending',
      lastActivityAt: new Date(now.getTime() - 10 * 60_000),
    };

    const decision = await service.decide({
      chatId: 'chat-1',
      customerId: 'cust-1',
      idleWindowMinutes: 180,
      now,
    });

    expect(decision).toEqual({ action: 'attach', ticketId: 'ticket-2', revive: true, matchedRule: 2 });
  });

  it('rule 2: a closed ticket is never matched, even if most recent', async () => {
    repo.active = { ticketId: 'ticket-closed', status: 'closed', lastActivityAt: now };

    const decision = await service.decide({
      chatId: 'chat-1',
      customerId: 'cust-1',
      idleWindowMinutes: 180,
      now,
    });

    expect(decision).toEqual({ action: 'create-new', matchedRule: 3 });
  });

  it('rule 3: no reply and no recent active thread creates a new ticket', async () => {
    const decision = await service.decide({
      chatId: 'chat-1',
      customerId: 'cust-1',
      idleWindowMinutes: 180,
      now,
    });

    expect(decision).toEqual({ action: 'create-new', matchedRule: 3 });
  });

  it('rule 3: an active thread past the idle window falls through to a new ticket', async () => {
    repo.active = {
      ticketId: 'ticket-old',
      status: 'open',
      lastActivityAt: new Date(now.getTime() - 181 * 60_000),
    };

    const decision = await service.decide({
      chatId: 'chat-1',
      customerId: 'cust-1',
      idleWindowMinutes: 180,
      now,
    });

    expect(decision).toEqual({ action: 'create-new', matchedRule: 3 });
  });
});
