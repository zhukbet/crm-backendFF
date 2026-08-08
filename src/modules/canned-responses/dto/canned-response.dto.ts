import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsIn, IsOptional, IsString } from 'class-validator';

const SCOPES = ['global', 'team'] as const;

export class CreateCannedResponseDto {
  @ApiProperty()
  @IsString()
  title!: string;

  @ApiProperty({ description: 'May contain {variable} placeholders, e.g. {імʼя}, {тариф}' })
  @IsString()
  body!: string;

  @ApiPropertyOptional({ enum: SCOPES, default: 'global' })
  @IsOptional()
  @IsIn(SCOPES as unknown as string[])
  scope?: (typeof SCOPES)[number];

  // Note: section 12 also describes macros that "perform an action" (set label/status/
  // priority), not just insert text — the current schema's `variables` column only holds
  // {placeholder} names, not actions. Executing actions is a client-side concern for now
  // (client reads the macro, inserts the text, then calls the normal PATCH /tickets/:id).
  @ApiPropertyOptional({
    type: [String],
    description: 'Names of {placeholder} variables used in body, e.g. ["імʼя", "тариф"]',
  })
  @IsOptional()
  @IsArray()
  variables?: unknown[];
}

export class UpdateCannedResponseDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  body?: string;

  @ApiPropertyOptional({ enum: SCOPES })
  @IsOptional()
  @IsIn(SCOPES as unknown as string[])
  scope?: (typeof SCOPES)[number];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  variables?: unknown[];
}
