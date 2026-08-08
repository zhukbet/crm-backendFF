import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AllowlistGuard } from '../auth/allowlist.guard';
import { CannedResponsesService } from './canned-responses.service';
import { CreateCannedResponseDto, UpdateCannedResponseDto } from './dto/canned-response.dto';

@ApiTags('canned-responses')
@Controller('canned-responses')
@UseGuards(AllowlistGuard)
export class CannedResponsesController {
  constructor(private readonly cannedResponses: CannedResponsesService) {}

  @Get()
  list() {
    return this.cannedResponses.list();
  }

  @Post()
  create(@Body() dto: CreateCannedResponseDto) {
    return this.cannedResponses.create(dto.title, dto.body, dto.scope, dto.variables);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCannedResponseDto) {
    return this.cannedResponses.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.cannedResponses.remove(id);
  }
}
