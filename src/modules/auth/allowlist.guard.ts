import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { SessionService } from './session.service';

/** Section 7: only telegram_user_id present in the allowlist (agents.is_active = true) gets in. */
@Injectable()
export class AllowlistGuard implements CanActivate {
  constructor(
    private readonly sessions: SessionService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = request.cookies?.[this.sessions.cookieName];
    if (!token) throw new UnauthorizedException('No session');

    const claims = this.sessions.verify(token);
    if (!claims) throw new UnauthorizedException('Invalid or expired session');

    const agent = await this.prisma.agent.findUnique({ where: { id: claims.sub } });
    if (!agent || !agent.isActive) throw new UnauthorizedException('Agent is not active');

    request.agent = agent;
    return true;
  }
}
