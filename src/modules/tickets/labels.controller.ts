import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AllowlistGuard } from '../auth/allowlist.guard';
import { LabelsService } from './labels.service';

@ApiTags('labels')
@Controller('labels')
@UseGuards(AllowlistGuard)
export class LabelsController {
  constructor(private readonly labels: LabelsService) {}

  @Get()
  list() {
    return this.labels.list();
  }

  @Post()
  create(@Body('name') name: string, @Body('color') color: string) {
    return this.labels.create(name, color);
  }
}
