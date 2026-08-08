import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Agent } from '@prisma/client';
import { AllowlistGuard } from '../auth/allowlist.guard';
import { CurrentAgent } from '../auth/current-agent.decorator';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import {
  CreateExcludedSenderDto,
  ListExcludedSendersQueryDto,
  ResolveExcludedSenderDto,
  UpdateExcludedSenderDto,
} from './dto/excluded-sender.dto';
import { ExcludedSendersService } from './excluded-senders.service';

@ApiTags('excluded-senders')
@Controller('excluded-senders')
@UseGuards(AllowlistGuard, RolesGuard)
@Roles('admin')
export class ExcludedSendersController {
  constructor(private readonly service: ExcludedSendersService) {}

  @Get()
  list(@Query() query: ListExcludedSendersQueryDto) {
    return this.service.list({
      q: query.q,
      isActive: query.is_active !== undefined ? query.is_active === 'true' : undefined,
    });
  }

  @Post()
  create(@Body() dto: CreateExcludedSenderDto, @CurrentAgent() agent: Agent) {
    return this.service.create({
      telegramUserId: dto.telegram_user_id,
      telegramUsername: dto.telegram_username,
      name: dto.name,
      note: dto.note,
      addedByAgentId: agent.id,
    });
  }

  @Post('resolve')
  resolve(@Body() dto: ResolveExcludedSenderDto) {
    return this.service.resolveUsername(dto.telegram_username);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateExcludedSenderDto) {
    return this.service.update(id, { name: dto.name, note: dto.note, isActive: dto.is_active });
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
