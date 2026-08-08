import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AllowlistGuard } from '../auth/allowlist.guard';
import { AnalyticsRangeQueryDto } from './dto/analytics-range-query.dto';
import { AnalyticsService } from './analytics.service';

/** `to=2026-08-08` parses as midnight UTC *start* of that day. Compared with `lte`, that
 * silently excludes everything that happened later that same day — i.e. "today" never shows
 * up in its own range until the last millisecond. Push `to` to end-of-day so the whole
 * calendar day the caller named is actually included. */
function endOfDay(isoDate: string): Date {
  return new Date(new Date(isoDate).getTime() + 24 * 60 * 60 * 1000 - 1);
}

@ApiTags('analytics')
@Controller('analytics')
@UseGuards(AllowlistGuard)
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('chats')
  chats(@Query() query: AnalyticsRangeQueryDto) {
    return this.analytics.getChatsAnalytics({
      from: new Date(query.from),
      to: endOfDay(query.to),
      chatGroupId: query.chat_group,
    });
  }

  @Get('overview')
  overview(@Query() query: AnalyticsRangeQueryDto) {
    return this.analytics.getOverview({ from: new Date(query.from), to: endOfDay(query.to) });
  }
}
