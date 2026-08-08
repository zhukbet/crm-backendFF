import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AllowlistGuard } from '../auth/allowlist.guard';
import { ChatsService } from './chats.service';
import { CreateChatGroupDto, UpdateChatSettingsDto } from './dto/chat.dto';

@ApiTags('chats')
@Controller()
@UseGuards(AllowlistGuard)
export class ChatsController {
  constructor(private readonly chats: ChatsService) {}

  /** Section 8б: chat directory — list with per-chat volume/backlog, searchable/filterable. */
  @Get('chats')
  list(@Query('chat_group') chatGroupId?: string, @Query('q') q?: string) {
    return this.chats.directory({ chatGroupId, q });
  }

  @Get('chats/:id')
  getById(@Param('id') id: string) {
    return this.chats.getById(id);
  }

  /** Section 8б: per-chat defaults for new tickets originating there. */
  @Patch('chats/:id')
  updateSettings(@Param('id') id: string, @Body() dto: UpdateChatSettingsDto) {
    return this.chats.updateSettings(id, {
      chatGroupId: dto.chat_group_id,
      defaultTeamId: dto.default_team_id,
      defaultAssigneeId: dto.default_assignee_id,
      routingStrategy: dto.routing_strategy,
      defaultPriority: dto.default_priority,
      tags: dto.tags,
    });
  }

  @Get('chat-groups')
  listGroups() {
    return this.chats.listGroups();
  }

  @Post('chat-groups')
  createGroup(@Body() dto: CreateChatGroupDto) {
    return this.chats.createGroup(dto.name, dto.color, dto.description);
  }
}
