import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID } from 'class-validator';

export class CreateOrganizationDto {
  @ApiProperty()
  @IsString()
  name!: string;
}

export class AssignCustomerOrganizationDto {
  @ApiProperty()
  @IsUUID()
  organization_id!: string;
}
