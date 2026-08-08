import { Body, Controller, ForbiddenException, Get, Post, Res, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TelegramService } from '../telegram/telegram.service';
import { CurrentAgent } from './current-agent.decorator';
import { TelegramLoginDto } from './dto/telegram-login.dto';
import { AllowlistGuard } from './allowlist.guard';
import { SessionService } from './session.service';
import { Agent } from '@prisma/client';

@ApiTags('auth')
@Controller()
export class AuthController {
  constructor(
    private readonly telegram: TelegramService,
    private readonly prisma: PrismaService,
    private readonly sessions: SessionService,
  ) {}

  @Post('auth/telegram/callback')
  async telegramCallback(@Body() dto: TelegramLoginDto, @Res({ passthrough: true }) res: Response) {
    if (!this.telegram.verifyLoginWidget(dto)) {
      throw new ForbiddenException('Invalid Telegram Login signature');
    }

    const agent = await this.prisma.agent.findUnique({ where: { telegramUserId: BigInt(dto.id) } });
    if (!agent || !agent.isActive) {
      throw new ForbiddenException('Not on the agent allowlist');
    }

    const token = this.sessions.sign({ sub: agent.id, role: agent.role });
    res.cookie(this.sessions.cookieName, token, this.sessions.cookieOptions());
    return { id: agent.id, name: agent.name, role: agent.role };
  }

  @Post('auth/logout')
  @UseGuards(AllowlistGuard)
  async logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(this.sessions.cookieName, { path: '/' });
    return { ok: true };
  }

  @Get('agents/me')
  @UseGuards(AllowlistGuard)
  me(@CurrentAgent() agent: Agent) {
    return agent;
  }
}
