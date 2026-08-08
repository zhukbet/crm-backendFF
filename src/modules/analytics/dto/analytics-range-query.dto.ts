import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsUUID } from 'class-validator';

export class AnalyticsRangeQueryDto {
  @ApiProperty({ description: 'ISO date, e.g. 2026-08-01' })
  @IsDateString()
  from!: string;

  @ApiProperty({ description: 'ISO date, e.g. 2026-08-08' })
  @IsDateString()
  to!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  chat_group?: string;
}
