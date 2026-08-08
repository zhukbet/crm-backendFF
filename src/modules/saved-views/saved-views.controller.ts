import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Agent } from '@prisma/client';
import { AllowlistGuard } from '../auth/allowlist.guard';
import { CurrentAgent } from '../auth/current-agent.decorator';
import { CreateSavedViewDto, UpdateSavedViewDto } from './dto/saved-view.dto';
import { SavedViewsService } from './saved-views.service';

@ApiTags('saved-views')
@Controller('saved-views')
@UseGuards(AllowlistGuard)
export class SavedViewsController {
  constructor(private readonly savedViews: SavedViewsService) {}

  @Get()
  list(@CurrentAgent() agent: Agent) {
    return this.savedViews.list(agent.id);
  }

  @Post()
  create(@Body() dto: CreateSavedViewDto, @CurrentAgent() agent: Agent) {
    return this.savedViews.create(agent.id, dto.name, dto.filter, dto.sort, dto.personal);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateSavedViewDto, @CurrentAgent() agent: Agent) {
    return this.savedViews.update(id, agent.id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentAgent() agent: Agent) {
    return this.savedViews.remove(id, agent.id);
  }
}
