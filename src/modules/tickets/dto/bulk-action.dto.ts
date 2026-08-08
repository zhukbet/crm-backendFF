import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsIn, IsObject, IsUUID } from 'class-validator';

const ACTIONS = ['assign', 'close', 'label'] as const;

export class BulkActionDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @IsUUID('4', { each: true })
  ticket_ids!: string[];

  @ApiProperty({ enum: ACTIONS })
  @IsIn(ACTIONS as unknown as string[])
  action!: (typeof ACTIONS)[number];

  @ApiProperty({
    description: 'Action-specific payload, e.g. { agent_id } for assign, { label_id } for label',
  })
  @IsObject()
  payload!: Record<string, unknown>;
}
