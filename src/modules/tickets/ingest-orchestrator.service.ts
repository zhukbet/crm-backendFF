import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientDetectionService } from '../telegram/client-detection.service';
import { NormalizedIncomingMessage } from '../telegram/telegram.types';
import { ChatsService } from '../chats/chats.service';
import { RoutingService } from '../routing/routing.service';
import { CustomersService } from './customers.service';
import { MessagesService } from './messages.service';
import { TicketsService } from './tickets.service';
import { ThreadGroupingService } from './thread-grouping/thread-grouping.service';

export type IngestResult =
  | { outcome: 'ticket-message'; ticketId: string; isNewTicket: boolean }
  | { outcome: 'ignored-agent' }
  | { outcome: 'ignored-excluded' };

/**
 * Wires together section 4 of the spec end to end for a single normalized incoming message:
 * classify sender -> resolve chat/customer -> decide thread -> persist message.
 * Called from the ingest BullMQ worker, after per-message dedup has already happened.
 */
@Injectable()
export class IngestOrchestratorService {
  private readonly logger = new Logger(IngestOrchestratorService.name);

  constructor(
    private readonly clientDetection: ClientDetectionService,
    private readonly chats: ChatsService,
    private readonly customers: CustomersService,
    private readonly threadGrouping: ThreadGroupingService,
    private readonly tickets: TicketsService,
    private readonly messages: MessagesService,
    private readonly routing: RoutingService,
    private readonly config: ConfigService,
  ) {}

  async process(message: NormalizedIncomingMessage): Promise<IngestResult> {
    const fromTelegramUserId = BigInt(message.fromTelegramUserId);
    const classification = await this.clientDetection.classify(
      fromTelegramUserId,
      message.fromUsername,
    );

    if (classification.kind === 'agent') {
      return { outcome: 'ignored-agent' };
    }
    if (classification.kind === 'excluded') {
      return { outcome: 'ignored-excluded' };
    }

    const chat = await this.chats.findOrCreateByTelegramId(
      BigInt(message.telegramChatId),
      message.chatTitle,
    );
    const customer = await this.customers.findOrCreateByTelegramId(
      fromTelegramUserId,
      message.fromUsername,
      message.fromDisplayName,
    );

    const idleWindowMinutes = this.config.get<number>('routing.threadIdleWindowMinutes')!;
    const decision = await this.threadGrouping.decide({
      chatId: chat.id,
      customerId: customer.id,
      replyToTgMessageId: message.replyToTgMessageId
        ? BigInt(message.replyToTgMessageId)
        : undefined,
      idleWindowMinutes,
      now: new Date(),
    });

    let ticketId: string;
    let isNewTicket: boolean;

    if (decision.action === 'attach') {
      ticketId = decision.ticketId;
      isNewTicket = false;
      if (decision.revive) {
        await this.tickets.patch(ticketId, { status: 'open' }, null);
      }
      this.logger.debug(`Message attached to ticket ${ticketId} via rule ${decision.matchedRule}`);
    } else {
      // Section 9: new tickets get a team/assignee decided by the chat's routing strategy
      // (manual/round_robin/least_busy), not just the chat's raw defaults.
      const routingDecision = await this.routing.decideAssignment(chat);
      const ticket = await this.tickets.createForNewThread({
        chatId: chat.id,
        customerId: customer.id,
        anchorMessageTgId: BigInt(message.tgMessageId),
        priority: chat.defaultPriority,
        teamId: routingDecision.teamId,
        assigneeId: routingDecision.assigneeId,
      });
      ticketId = ticket.id;
      isNewTicket = true;
      this.logger.debug(`New ticket ${ticketId} created (rule 3)`);
    }

    await this.messages.recordIncoming({
      ticketId,
      tgMessageId: BigInt(message.tgMessageId),
      text: message.text,
      attachments: message.attachments,
      isNewTicket,
    });

    return { outcome: 'ticket-message', ticketId, isNewTicket };
  }
}
