import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AllowlistGuard } from '../auth/allowlist.guard';
import { AnalyticsRangeQueryDto } from './dto/analytics-range-query.dto';
import { AnalyticsService } from './analytics.service';

@ApiTags('analytics')
@Controller('analytics')
@UseGuards(AllowlistGuard)
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('chats')
  chats(@Query() query: AnalyticsRangeQueryDto) {
    return this.analytics.getChatsAnalytics({
      from: new Date(query.from),
      to: new Date(query.to),
      chatGroupId: query.chat_group,
    });
  }

  @Get('overview')
  overview(@Query() query: AnalyticsRangeQueryDto) {
    return this.analytics.getOverview({ from: new Date(query.from), to: new Date(query.to) });
  }
}
