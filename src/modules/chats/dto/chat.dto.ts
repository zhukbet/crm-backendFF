import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { IsArray, IsIn, IsOptional, IsString, IsUUID } from 'class-validator';

const ROUTING_STRATEGIES = ['manual', 'round_robin', 'least_busy'] as const;
const PRIORITIES = ['urgent', 'high', 'normal', 'low'] as const;

export class UpdateChatSettingsDto {
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsUUID()
  chat_group_id?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsUUID()
  default_team_id?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsUUID()
  default_assignee_id?: string | null;

  @ApiPropertyOptional({ enum: ROUTING_STRATEGIES })
  @IsOptional()
  @IsIn(ROUTING_STRATEGIES as unknown as string[])
  routing_strategy?: (typeof ROUTING_STRATEGIES)[number];

  @ApiPropertyOptional({ enum: PRIORITIES })
  @IsOptional()
  @IsIn(PRIORITIES as unknown as string[])
  default_priority?: (typeof PRIORITIES)[number];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  tags?: string[];
}

export class CreateChatGroupDto {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  color?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}
