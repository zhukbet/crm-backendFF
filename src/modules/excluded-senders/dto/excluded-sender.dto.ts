import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { IsBooleanString, IsOptional, IsString } from 'class-validator';

export class CreateExcludedSenderDto {
  @ApiPropertyOptional({ description: 'Numeric telegram_user_id, if known' })
  @IsOptional()
  @IsString()
  telegram_user_id?: string;

  @ApiPropertyOptional({ description: '@username, without the @' })
  @IsOptional()
  @IsString()
  telegram_username?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}

export class UpdateExcludedSenderDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional()
  @IsOptional()
  is_active?: boolean;
}

export class ListExcludedSendersQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBooleanString()
  is_active?: string;
}

export class ResolveExcludedSenderDto {
  @ApiProperty()
  @IsString()
  telegram_username!: string;
}
