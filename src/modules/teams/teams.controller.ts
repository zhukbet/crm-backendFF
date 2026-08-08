import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AllowlistGuard } from '../auth/allowlist.guard';
import { TeamsService } from './teams.service';

@ApiTags('teams')
@Controller('teams')
@UseGuards(AllowlistGuard)
export class TeamsController {
  constructor(private readonly teams: TeamsService) {}

  @Get()
  list() {
    return this.teams.list();
  }

  @Post()
  create(@Body('name') name: string) {
    return this.teams.create(name);
  }

  @Post(':id/members')
  addMember(@Param('id') teamId: string, @Body('agent_id') agentId: string) {
    return this.teams.addMember(teamId, agentId);
  }

  @Delete(':id/members/:agentId')
  removeMember(@Param('id') teamId: string, @Param('agentId') agentId: string) {
    return this.teams.removeMember(teamId, agentId);
  }
}
