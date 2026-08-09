import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class ReplyTicketDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  text!: string;

  @ApiPropertyOptional({ type: [String], description: 'Telegram file_ids to attach' })
  @IsOptional()
  @IsArray()
  attachments?: string[];

  @ApiPropertyOptional({
    description:
      'Whether to send this as a Telegram reply (quoting the client message). Defaults to ' +
      'true; the agent can turn it off to send a plain message instead, e.g. for a second ' +
      'reply to the same client message where quoting again would just be noise.',
  })
  @IsOptional()
  @IsBoolean()
  asReply?: boolean;
}
