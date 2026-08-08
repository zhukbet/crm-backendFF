import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.organization.findMany({ orderBy: { name: 'asc' } });
  }

  create(name: string) {
    return this.prisma.organization.create({ data: { name } });
  }

  /** Section 12: "історія всіх звернень компанії" — customers + each one's ticket history. */
  async getById(id: string) {
    const organization = await this.prisma.organization.findUnique({
      where: { id },
      include: {
        customers: {
          include: {
            tickets: { include: { chat: true }, orderBy: { createdAt: 'desc' } },
          },
        },
      },
    });
    if (!organization) throw new NotFoundException('Organization not found');
    return organization;
  }

  async assignCustomer(customerId: string, organizationId: string) {
    const [customer, organization] = await Promise.all([
      this.prisma.customer.findUnique({ where: { id: customerId } }),
      this.prisma.organization.findUnique({ where: { id: organizationId } }),
    ]);
    if (!customer) throw new NotFoundException('Customer not found');
    if (!organization) throw new NotFoundException('Organization not found');

    return this.prisma.customer.update({ where: { id: customerId }, data: { organizationId } });
  }
}
