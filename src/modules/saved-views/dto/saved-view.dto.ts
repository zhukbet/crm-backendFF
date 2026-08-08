import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString } from 'class-validator';

export class CreateSavedViewDto {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty({ description: 'Filter object, same shape as GET /tickets query params' })
  @IsObject()
  filter!: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  sort?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'true = personal (only owner sees it), false/omit = shared' })
  @IsOptional()
  personal?: boolean;
}

export class UpdateSavedViewDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  filter?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  sort?: Record<string, unknown>;
}
