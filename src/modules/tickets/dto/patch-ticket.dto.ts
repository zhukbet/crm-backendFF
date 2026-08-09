import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsDateString, IsIn, IsOptional, IsString, IsUUID } from 'class-validator';

const STATUSES = ['open', 'pending', 'on_hold', 'solved', 'closed', 'archived'] as const;
const PRIORITIES = ['urgent', 'high', 'normal', 'low'] as const;

export class PatchTicketDto {
  @ApiPropertyOptional({ enum: STATUSES })
  @IsOptional()
  @IsIn(STATUSES as unknown as string[])
  status?: (typeof STATUSES)[number];

  @ApiPropertyOptional({ enum: PRIORITIES })
  @IsOptional()
  @IsIn(PRIORITIES as unknown as string[])
  priority?: (typeof PRIORITIES)[number];

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsUUID()
  assignee_id?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsUUID()
  team_id?: string | null;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  labels?: string[];

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsDateString()
  snooze_until?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  jira_key?: string | null;
}
