import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Agent } from '@prisma/client';
import { AllowlistGuard } from '../auth/allowlist.guard';
import { CurrentAgent } from '../auth/current-agent.decorator';
import { AssignTicketDto } from './dto/assign-ticket.dto';
import { BulkActionDto } from './dto/bulk-action.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { ListTicketsQueryDto } from './dto/list-tickets.dto';
import { PatchTicketDto } from './dto/patch-ticket.dto';
import { ReplyTicketDto } from './dto/reply-ticket.dto';
import { CommentsService } from './comments.service';
import { MessagesService } from './messages.service';
import { TicketsService } from './tickets.service';
import { ExcludedSendersService } from '../excluded-senders/excluded-senders.service';

@ApiTags('tickets')
@Controller('tickets')
@UseGuards(AllowlistGuard)
export class TicketsController {
  constructor(
    private readonly tickets: TicketsService,
    private readonly messages: MessagesService,
    private readonly comments: CommentsService,
    private readonly excludedSenders: ExcludedSendersService,
  ) {}

  @Get()
  list(@Query() query: ListTicketsQueryDto) {
    return this.tickets.list(query);
  }

  @Get(':id')
  getById(@Param('id') id: string) {
    return this.tickets.getById(id);
  }

  @Get(':id/messages')
  listMessages(@Param('id') id: string) {
    return this.messages.listForTicket(id);
  }

  @Patch(':id')
  patch(@Param('id') id: string, @Body() dto: PatchTicketDto, @CurrentAgent() agent: Agent) {
    return this.tickets.patch(id, dto, agent.id);
  }

  @Post(':id/reply')
  reply(@Param('id') id: string, @Body() dto: ReplyTicketDto, @CurrentAgent() agent: Agent) {
    return this.messages.recordOutgoingReply({
      ticketId: id,
      agentId: agent.id,
      text: dto.text,
      attachments: dto.attachments,
      asReply: dto.asReply,
    });
  }

  @Post(':id/comments')
  addComment(@Param('id') id: string, @Body() dto: CreateCommentDto, @CurrentAgent() agent: Agent) {
    return this.comments.create(id, agent.id, dto.body, dto.mentions);
  }

  @Get(':id/comments')
  listComments(@Param('id') id: string) {
    return this.comments.list(id);
  }

  @Post(':id/assign')
  assign(@Param('id') id: string, @Body() dto: AssignTicketDto, @CurrentAgent() agent: Agent) {
    return this.tickets.assign(id, dto.agent_id, agent.id, dto.reason);
  }

  /** Seq 28: "беру на себе" — self-assign in one click, no agent_id needed in the body. */
  @Post(':id/claim')
  claim(@Param('id') id: string, @CurrentAgent() agent: Agent) {
    return this.tickets.assign(id, agent.id, agent.id);
  }

  @Post(':id/close')
  close(@Param('id') id: string, @CurrentAgent() agent: Agent) {
    return this.tickets.close(id, agent.id);
  }

  @Post(':id/reopen')
  reopen(@Param('id') id: string, @CurrentAgent() agent: Agent) {
    return this.tickets.reopen(id, agent.id);
  }

  @Post(':id/snooze')
  snooze(
    @Param('id') id: string,
    @Body('snooze_until') snoozeUntil: string,
    @CurrentAgent() agent: Agent,
  ) {
    return this.tickets.snooze(id, snoozeUntil, agent.id);
  }

  @Post('bulk')
  bulk(@Body() dto: BulkActionDto, @CurrentAgent() agent: Agent) {
    return this.tickets.bulk(dto.ticket_ids, dto.action, dto.payload, agent.id);
  }

  /** Section 12: audit log for this ticket (assign/reassign/status/priority/labels/close). */
  @Get(':id/events')
  listEvents(@Param('id') id: string) {
    return this.tickets.listEvents(id);
  }

  /** Section 8a: one-click "цей не клієнт" from the ticket card — excludes the sender and
   * closes the mistakenly-created thread. */
  @Post(':id/mark-not-customer')
  markNotCustomer(@Param('id') id: string, @CurrentAgent() agent: Agent) {
    return this.excludedSenders.markTicketSenderAsNotCustomer(id, agent.id);
  }
}
