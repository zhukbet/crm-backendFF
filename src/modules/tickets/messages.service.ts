import { Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TelegramOutboundProducer } from '../telegram/telegram-outbound.producer';
import { DOMAIN_EVENTS } from './events/domain-events';

@Injectable()
export class MessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
    private readonly outboundProducer: TelegramOutboundProducer,
  ) {}

  /** Persists an inbound customer message and bumps the ticket's activity/anchor pointers. */
  async recordIncoming(params: {
    ticketId: string;
    tgMessageId: bigint;
    text?: string;
    attachments: Array<{ type: string; fileId: string }>;
    isNewTicket: boolean;
  }) {
    const message = await this.prisma.$transaction(async (tx) => {
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

    this.events.emit(DOMAIN_EVENTS.MESSAGE_RECEIVED, {
      ticketId: params.ticketId,
      messageId: message.id,
      isNewTicket: params.isNewTicket,
    });
    return message;
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

    const replyToTgMessageId = ticket.lastClientMessageTgId ?? ticket.anchorMessageTgId;

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
}
