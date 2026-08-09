import '../src/common/bigint-json';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { IngestOrchestratorService } from '../src/modules/tickets/ingest-orchestrator.service';
import { NormalizedIncomingMessage } from '../src/modules/telegram/telegram.types';

/**
 * Runs against a REAL Postgres + Redis (see README: "Перевірено вживу"), not mocks — that's
 * what caught the ValidationPipe/migration/BullMQ-jobId/date-range bugs no unit test could.
 * Needs DATABASE_URL pointed at a *separate* test database before running (see npm run
 * test:e2e in README) — this suite creates real rows and does not roll them back.
 *
 * Ingest is exercised by calling IngestOrchestratorService.process() directly rather than
 * POSTing to /api/telegram/webhook + waiting on the BullMQ worker: AppModule alone (this test
 * only boots AppModule, not WorkerModule) has no ingest processor, and polling for an async
 * worker outcome would make this suite slow and flaky. Calling the same service the real
 * IngestProcessor calls exercises the identical domain logic against the identical real DB —
 * only the queue hop itself is skipped.
 */
describe('Support CRM — core flows (e2e, real DB)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ingest: IngestOrchestratorService;
  let agentCookie: string;
  let agentId: string;

  const runId = Date.now(); // keeps each run's telegram ids/chat ids collision-free

  function normalized(overrides: Partial<NormalizedIncomingMessage>): NormalizedIncomingMessage {
    return {
      telegramChatId: '0',
      chatTitle: 'e2e chat',
      tgMessageId: '0',
      fromTelegramUserId: '0',
      fromDisplayName: 'E2E Customer',
      attachments: [],
      isEdit: false,
      ...overrides,
    };
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    app.setGlobalPrefix('api');
    app.use(cookieParser());
    await app.init();

    prisma = app.get(PrismaService);
    ingest = app.get(IngestOrchestratorService);

    const agent = await prisma.agent.upsert({
      where: { telegramUserId: BigInt(900000000 + (runId % 100000)) },
      update: {},
      create: {
        telegramUserId: BigInt(900000000 + (runId % 100000)),
        name: 'E2E Admin',
        username: `e2e_admin_${runId}`,
        role: 'admin',
        isActive: true,
      },
    });
    agentId = agent.id;

    const loginRes = await request(app.getHttpServer())
      .post('/api/auth/dev-login')
      .send({ username: agent.username })
      .expect(201);
    agentCookie = loginRes.headers['set-cookie'][0];
  });

  afterAll(async () => {
    await app.close();
  });

  it('DoD (section 16): a message from an unknown sender becomes an open ticket automatically', async () => {
    const chatId = `-${runId}1`;
    const customerId = `${runId}101`;

    await ingest.process(
      normalized({
        telegramChatId: chatId,
        chatTitle: 'DoD chat',
        tgMessageId: '1',
        fromTelegramUserId: customerId,
        text: 'Застосунок не працює',
      }),
    );

    const listRes = await request(app.getHttpServer())
      .get('/api/tickets?status=open')
      .set('Cookie', agentCookie)
      .expect(200);
    const ticket = listRes.body.data.find((t: any) => t.chat.telegramChatId === chatId);
    expect(ticket).toBeDefined();
    expect(ticket.status).toBe('open');

    const messagesRes = await request(app.getHttpServer())
      .get(`/api/tickets/${ticket.id}/messages`)
      .set('Cookie', agentCookie)
      .expect(200);
    expect(messagesRes.body).toHaveLength(1);
    expect(messagesRes.body[0].text).toBe('Застосунок не працює');
  });

  it('DoD: claim, reply, and manual close all work end to end', async () => {
    const chatId = `-${runId}2`;
    const customerId = `${runId}102`;

    await ingest.process(
      normalized({
        telegramChatId: chatId,
        tgMessageId: '1',
        fromTelegramUserId: customerId,
        text: 'Допоможіть',
      }),
    );
    const ticket = await prisma.ticket.findFirstOrThrow({
      where: { chat: { telegramChatId: BigInt(chatId) } },
    });

    await request(app.getHttpServer())
      .post(`/api/tickets/${ticket.id}/claim`)
      .set('Cookie', agentCookie)
      .expect(201)
      .expect((res) => expect(res.body.assigneeId).toBe(agentId));

    const replyRes = await request(app.getHttpServer())
      .post(`/api/tickets/${ticket.id}/reply`)
      .set('Cookie', agentCookie)
      .send({ text: 'Розбираємось!' })
      .expect(201);
    expect(replyRes.body.direction).toBe('out');
    expect(replyRes.body.sender).toBe('agent');

    await request(app.getHttpServer())
      .post(`/api/tickets/${ticket.id}/close`)
      .set('Cookie', agentCookie)
      .expect(201);

    const finalRes = await request(app.getHttpServer())
      .get(`/api/tickets/${ticket.id}`)
      .set('Cookie', agentCookie)
      .expect(200);
    expect(finalRes.body.status).toBe('closed');

    const events = await request(app.getHttpServer())
      .get(`/api/tickets/${ticket.id}/events`)
      .set('Cookie', agentCookie)
      .expect(200);
    expect(events.body.some((e: any) => e.type === 'assigned')).toBe(true);
    expect(events.body.some((e: any) => e.type === 'updated')).toBe(true);
  });

  it('section 4, rule 2: a second message within the idle window attaches to the same open ticket', async () => {
    const chatId = `-${runId}3`;
    const customerId = `${runId}103`;

    await ingest.process(
      normalized({
        telegramChatId: chatId,
        tgMessageId: '1',
        fromTelegramUserId: customerId,
        text: 'перше',
      }),
    );
    const first = await prisma.ticket.findFirstOrThrow({
      where: { chat: { telegramChatId: BigInt(chatId) } },
    });

    await ingest.process(
      normalized({
        telegramChatId: chatId,
        tgMessageId: '2',
        fromTelegramUserId: customerId,
        text: 'друге',
      }),
    );

    const allTickets = await prisma.ticket.findMany({
      where: { chat: { telegramChatId: BigInt(chatId) } },
    });
    expect(allTickets).toHaveLength(1);
    expect(allTickets[0].id).toBe(first.id);

    const messages = await prisma.message.findMany({ where: { ticketId: first.id } });
    expect(messages).toHaveLength(2);
  });

  it('section 4, rule 3: after manual close, the next message starts a new ticket', async () => {
    const chatId = `-${runId}4`;
    const customerId = `${runId}104`;

    await ingest.process(
      normalized({
        telegramChatId: chatId,
        tgMessageId: '1',
        fromTelegramUserId: customerId,
        text: 'перше',
      }),
    );
    const first = await prisma.ticket.findFirstOrThrow({
      where: { chat: { telegramChatId: BigInt(chatId) } },
    });
    await prisma.ticket.update({
      where: { id: first.id },
      data: { status: 'closed', closedAt: new Date() },
    });

    await ingest.process(
      normalized({
        telegramChatId: chatId,
        tgMessageId: '2',
        fromTelegramUserId: customerId,
        text: 'нове звернення',
      }),
    );

    const allTickets = await prisma.ticket.findMany({
      where: { chat: { telegramChatId: BigInt(chatId) } },
      orderBy: { createdAt: 'asc' },
    });
    expect(allTickets).toHaveLength(2);
    expect(allTickets[1].id).not.toBe(first.id);
    expect(allTickets[1].status).toBe('open');
  });

  it('section 4, rule 1: replying to an anchor message attaches even across the idle window, and revives it', async () => {
    const chatId = `-${runId}5`;
    const customerId = `${runId}105`;

    await ingest.process(
      normalized({
        telegramChatId: chatId,
        tgMessageId: '1',
        fromTelegramUserId: customerId,
        text: 'перше',
      }),
    );
    const ticket = await prisma.ticket.findFirstOrThrow({
      where: { chat: { telegramChatId: BigInt(chatId) } },
    });

    // Simulate the ticket having gone idle and on_hold, and the agent's earlier reply having
    // been confirmed by the (not-running-in-this-test) outbound worker.
    await prisma.ticket.update({
      where: { id: ticket.id },
      data: { status: 'on_hold', updatedAt: new Date(Date.now() - 999 * 60_000) },
    });
    const agentMessage = await prisma.message.create({
      data: { ticketId: ticket.id, direction: 'out', sender: 'agent', agentId, tgMessageId: 999n },
    });

    await ingest.process(
      normalized({
        telegramChatId: chatId,
        tgMessageId: '2',
        fromTelegramUserId: customerId,
        text: 'дякую, а що з...',
        replyToTgMessageId: String(agentMessage.tgMessageId),
      }),
    );

    const allTickets = await prisma.ticket.findMany({
      where: { chat: { telegramChatId: BigInt(chatId) } },
    });
    expect(allTickets).toHaveLength(1);
    const revived = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
    expect(revived.status).toBe('open');
  });

  it('section 8a: messages from an excluded sender never create a ticket', async () => {
    const chatId = `-${runId}6`;
    const excludedTelegramId = BigInt(`${runId}106`);

    await prisma.excludedSender.create({
      data: { telegramUserId: excludedTelegramId, name: 'Not a customer', addedByAgentId: agentId },
    });

    await ingest.process(
      normalized({
        telegramChatId: chatId,
        tgMessageId: '1',
        fromTelegramUserId: excludedTelegramId.toString(),
        text: 'внутрішнє повідомлення колеги',
      }),
    );

    const tickets = await prisma.ticket.findMany({
      where: { chat: { telegramChatId: BigInt(chatId) } },
    });
    expect(tickets).toHaveLength(0);
  });

  it('dedup backstop: processing the identical tg_message_id twice does not duplicate the message', async () => {
    const chatId = `-${runId}7`;
    const customerId = `${runId}107`;
    const duplicateMessage = normalized({
      telegramChatId: chatId,
      tgMessageId: '1',
      fromTelegramUserId: customerId,
      text: 'редіставка того самого апдейта',
    });

    await ingest.process(duplicateMessage);
    await ingest.process(duplicateMessage); // simulates a duplicate delivery bypassing queue-level dedup

    const tickets = await prisma.ticket.findMany({
      where: { chat: { telegramChatId: BigInt(chatId) } },
    });
    expect(tickets).toHaveLength(1);
    const messages = await prisma.message.findMany({ where: { ticketId: tickets[0].id } });
    expect(messages).toHaveLength(1);
  });

  it('section 8a: "Позначити як не клієнт" excludes the sender and closes the mistaken thread', async () => {
    const chatId = `-${runId}8`;
    const customerId = `${runId}108`;

    await ingest.process(
      normalized({
        telegramChatId: chatId,
        tgMessageId: '1',
        fromTelegramUserId: customerId,
        text: 'привіт всім',
      }),
    );
    const ticket = await prisma.ticket.findFirstOrThrow({
      where: { chat: { telegramChatId: BigInt(chatId) } },
    });

    await request(app.getHttpServer())
      .post(`/api/tickets/${ticket.id}/mark-not-customer`)
      .set('Cookie', agentCookie)
      .expect(201);

    const closed = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
    expect(closed.status).toBe('closed');

    // The next message from the same sender must now be ignored entirely.
    await ingest.process(
      normalized({
        telegramChatId: chatId,
        tgMessageId: '2',
        fromTelegramUserId: customerId,
        text: 'ще одне повідомлення',
      }),
    );
    const ticketsAfter = await prisma.ticket.findMany({
      where: { chat: { telegramChatId: BigInt(chatId) } },
    });
    expect(ticketsAfter).toHaveLength(1); // still just the one, now-closed, ticket
  });
});
