import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AgentRole } from '@prisma/client';
import { ROLES_KEY } from './roles.decorator';

/** Section 7: admin (allowlist/chats/groups/teams/global settings), lead (team + analytics), agent. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<AgentRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const { agent } = context.switchToHttp().getRequest();
    if (!agent || !required.includes(agent.role)) {
      throw new ForbiddenException('Insufficient role');
    }
    return true;
  }
}
