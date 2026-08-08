import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsString } from 'class-validator';

const CHANNELS = ['in_app', 'browser', 'telegram', 'email'] as const;

export class UpdateNotificationPrefDto {
  @ApiProperty({ enum: CHANNELS })
  @IsIn(CHANNELS as unknown as string[])
  channel!: (typeof CHANNELS)[number];

  @ApiProperty()
  @IsString()
  event_type!: string;

  @ApiProperty()
  @IsBoolean()
  enabled!: boolean;
}
