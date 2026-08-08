import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AllowlistGuard } from './allowlist.guard';
import { Roles } from './roles.decorator';
import { RolesGuard } from './roles.guard';

@ApiTags('agents')
@Controller('agents')
@UseGuards(AllowlistGuard, RolesGuard)
export class AgentsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  list() {
    return this.prisma.agent.findMany({ orderBy: { name: 'asc' } });
  }

  @Patch(':id')
  @Roles('admin')
  update(
    @Param('id') id: string,
    @Body() body: { role?: 'admin' | 'lead' | 'agent'; is_active?: boolean },
  ) {
    return this.prisma.agent.update({
      where: { id },
      data: { role: body.role, isActive: body.is_active },
    });
  }
}
