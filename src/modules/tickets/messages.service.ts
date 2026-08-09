import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TelegramOutboundProducer } from '../telegram/telegram-outbound.producer';
import { DOMAIN_EVENTS } from './events/domain-events';

const AUTO_ACK_TEXT = 'Дякую за ваше повідомлення,\nМи взяли в роботу — скоро до вас повернемось.';

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
    private readonly outboundProducer: TelegramOutboundProducer,
  ) {}

  /**
   * Persists an inbound customer message and bumps the ticket's activity/anchor pointers.
   *
   * Section 3.4's primary dedup is the ingest queue's jobId (chatId+tgMessageId) — BullMQ
   * drops re-enqueued duplicates before they ever reach here. This is the backstop for the
   * rare case one still slips through (e.g. Telegram redelivers after the job's dedup window
   * expired): the DB's `@@unique([tgMessageId, ticketId])` constraint catches it, and instead
   * of failing the job we treat it as "already processed" and return the existing row.
   */
  async recordIncoming(params: {
    ticketId: string;
    tgMessageId: bigint;
    text?: string;
    attachments: Array<{ type: string; fileId: string }>;
    isNewTicket: boolean;
  }) {
    let message;
    try {
      message = await this.prisma.$transaction(async (tx) => {
        const created = await tx.message.create({
          data: {
            ticketId: params.ticketId,
            direction: 'in',
            sender: 'customer',
            tgMessageId: params.tgMessageId,
            text: params.text,
            attachments: params.attachments as any,
          },
        });
        await tx.ticket.update({
          where: { id: params.ticketId },
          data: { lastClientMessageTgId: params.tgMessageId },
        });
        return created;
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const existing = await this.prisma.message.findUnique({
          where: {
            tgMessageId_ticketId: { tgMessageId: params.tgMessageId, ticketId: params.ticketId },
          },
        });
        if (existing) return existing;
      }
      throw err;
    }

    this.events.emit(DOMAIN_EVENTS.MESSAGE_RECEIVED, {
      ticketId: params.ticketId,
      messageId: message.id,
      isNewTicket: params.isNewTicket,
    });

    if (params.isNewTicket) {
      // Best-effort: an outbound hiccup here shouldn't fail (and retry) the ingest job that
      // already successfully recorded the customer's message.
      try {
        await this.sendAutoAcknowledgement(params.ticketId, params.tgMessageId);
      } catch (err) {
        this.logger.warn(`Auto-acknowledgement failed for ticket ${params.ticketId}: ${err}`);
      }
    }

    return message;
  }

  /** Immediate bot reply on brand-new tickets so the customer knows the message landed,
   * before an agent has had a chance to look at it. Never touches firstResponseAt — that
   * metric tracks real agent responsiveness, not this automated line. */
  private async sendAutoAcknowledgement(ticketId: string, replyToTgMessageId: bigint) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      include: { chat: true },
    });
    if (!ticket) return;

    const created = await this.prisma.message.create({
      data: {
        ticketId,
        direction: 'out',
        sender: 'bot',
        tgMessageId: null,
        text: AUTO_ACK_TEXT,
        attachments: [],
      },
    });

    await this.outboundProducer.enqueueReply({
      ticketId,
      messageId: created.id,
      telegramChatId: String(ticket.chat.telegramChatId),
      text: AUTO_ACK_TEXT,
      replyToTgMessageId: String(replyToTgMessageId),
    });

    this.events.emit(DOMAIN_EVENTS.MESSAGE_SENT, { ticketId, messageId: created.id });
  }

  /** Section 6: agent reply — persisted, sent to Telegram via the outbound queue. */
  async recordOutgoingReply(params: {
    ticketId: string;
    agentId: string;
    text: string;
    attachments?: string[];
  }) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: params.ticketId },
      include: { chat: true },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');

    // Quote only the first agent reply after a client message, not every consecutive one — once
    // the agent has already replied to the client's latest message, further replies read as a
    // normal back-and-forth instead of repeating the same quoted bubble on every message.
    const lastMessage = await this.prisma.message.findFirst({
      where: { ticketId: ticket.id },
      orderBy: { createdAt: 'desc' },
    });
    const replyToTgMessageId =
      lastMessage?.direction === 'in'
        ? lastMessage.tgMessageId
        : lastMessage
          ? undefined
          : (ticket.lastClientMessageTgId ?? ticket.anchorMessageTgId);

    const message = await this.prisma.$transaction(async (tx) => {
      const created = await tx.message.create({
        data: {
          ticketId: ticket.id,
          direction: 'out',
          sender: 'agent',
          agentId: params.agentId,
          // Real tg_message_id is filled in by the outbound worker once Telegram confirms
          // delivery (see confirmOutgoingSent below).
          tgMessageId: null,
          text: params.text,
          attachments: (params.attachments ?? []).map((fileId) => ({
            type: 'file',
            fileId,
          })) as any,
        },
      });
      if (!ticket.firstResponseAt) {
        await tx.ticket.update({ where: { id: ticket.id }, data: { firstResponseAt: new Date() } });
      }
      return created;
    });

    await this.outboundProducer.enqueueReply({
      ticketId: ticket.id,
      messageId: message.id,
      telegramChatId: String(ticket.chat.telegramChatId),
      text: params.text,
      replyToTgMessageId: replyToTgMessageId ? String(replyToTgMessageId) : undefined,
    });

    this.events.emit(DOMAIN_EVENTS.MESSAGE_SENT, {
      ticketId: ticket.id,
      messageId: message.id,
      agentId: params.agentId,
    });
    return message;
  }

  /** Called by the outbound worker once Telegram confirms the send, to fix up tg_message_id. */
  async confirmOutgoingSent(messageDbId: string, tgMessageId: bigint) {
    await this.prisma.message.update({
      where: { id: messageDbId },
      data: { tgMessageId },
    });
  }

  /** Conversation history for the center panel of the inbox (section 13). */
  listForTicket(ticketId: string) {
    return this.prisma.message.findMany({
      where: { ticketId },
      orderBy: { createdAt: 'asc' },
      include: { agent: true },
    });
  }
}
