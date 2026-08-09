import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AgentRole } from '@prisma/client';
import * as jwt from 'jsonwebtoken';

export interface SessionClaims {
  sub: string;
  role: AgentRole;
}

@Injectable()
export class SessionService {
  constructor(private readonly config: ConfigService) {}

  get cookieName(): string {
    return this.config.get<string>('auth.sessionCookieName')!;
  }

  sign(claims: SessionClaims): string {
    return jwt.sign(claims, this.config.get<string>('auth.jwtSecret')!, { expiresIn: '7d' });
  }

  verify(token: string): SessionClaims | null {
    try {
      return jwt.verify(token, this.config.get<string>('auth.jwtSecret')!) as SessionClaims;
    } catch {
      return null;
    }
  }

  cookieOptions() {
    const crossSite = this.config.get<boolean>('auth.cookieCrossSite');
    return {
      httpOnly: true,
      // SameSite=None requires Secure — browsers silently drop the cookie otherwise.
      sameSite: (crossSite ? 'none' : 'lax') as 'none' | 'lax',
      secure: crossSite || this.config.get<string>('NODE_ENV') === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    };
  }
}
