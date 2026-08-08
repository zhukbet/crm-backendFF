import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString, MinLength } from 'class-validator';

export class ReplyTicketDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  text!: string;

  @ApiPropertyOptional({ type: [String], description: 'Telegram file_ids to attach' })
  @IsOptional()
  @IsArray()
  attachments?: string[];
}
