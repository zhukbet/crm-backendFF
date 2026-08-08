import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Agent } from '@prisma/client';
import { AllowlistGuard } from '../auth/allowlist.guard';
import { CurrentAgent } from '../auth/current-agent.decorator';
import { UpdateNotificationPrefDto } from './dto/update-notification-pref.dto';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@Controller()
@UseGuards(AllowlistGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get('notifications')
  list(@Query('unread') unread: string | undefined, @CurrentAgent() agent: Agent) {
    return this.notifications.list(agent.id, unread === 'true');
  }

  @Post('notifications/:id/read')
  markRead(@Param('id') id: string, @CurrentAgent() agent: Agent) {
    return this.notifications.markRead(id, agent.id);
  }

  @Post('notifications/read-all')
  markAllRead(@CurrentAgent() agent: Agent) {
    return this.notifications.markAllRead(agent.id);
  }

  @Get('notification-prefs')
  getPrefs(@CurrentAgent() agent: Agent) {
    return this.notifications.getPrefs(agent.id);
  }

  @Patch('notification-prefs')
  updatePrefs(@Body() dto: UpdateNotificationPrefDto, @CurrentAgent() agent: Agent) {
    return this.notifications.updatePref(agent.id, dto.channel, dto.event_type, dto.enabled);
  }
}
