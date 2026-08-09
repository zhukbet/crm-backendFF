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
    return {
      ...this.baseCookieAttributes(),
      maxAge: 7 * 24 * 60 * 60 * 1000,
    };
  }

  /** For res.clearCookie() — must share httpOnly/sameSite/secure/path with cookieOptions() or
   * the clearing Set-Cookie won't reliably match/expire the original in every browser, but
   * deliberately without maxAge: clearCookie() needs an already-expired date, and passing a
   * 7-day maxAge here overrides that default and would re-extend the cookie's life instead. */
  clearCookieOptions() {
    return this.baseCookieAttributes();
  }

  private baseCookieAttributes() {
    const crossSite = this.config.get<boolean>('auth.cookieCrossSite');
    return {
      httpOnly: true,
      // SameSite=None requires Secure — browsers silently drop the cookie otherwise.
      sameSite: (crossSite ? 'none' : 'lax') as 'none' | 'lax',
      secure: crossSite || this.config.get<string>('NODE_ENV') === 'production',
      path: '/',
    };
  }
}
