import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AllowlistGuard } from '../auth/allowlist.guard';
import { AssignCustomerOrganizationDto, CreateOrganizationDto } from './dto/organization.dto';
import { OrganizationsService } from './organizations.service';

@ApiTags('organizations')
@Controller()
@UseGuards(AllowlistGuard)
export class OrganizationsController {
  constructor(private readonly organizations: OrganizationsService) {}

  @Get('organizations')
  list() {
    return this.organizations.list();
  }

  @Post('organizations')
  create(@Body() dto: CreateOrganizationDto) {
    return this.organizations.create(dto.name);
  }

  @Get('organizations/:id')
  getById(@Param('id') id: string) {
    return this.organizations.getById(id);
  }

  @Patch('customers/:id/organization')
  assignCustomer(@Param('id') customerId: string, @Body() dto: AssignCustomerOrganizationDto) {
    return this.organizations.assignCustomer(customerId, dto.organization_id);
  }
}
