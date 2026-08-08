import { Module } from '@nestjs/common';
import { TelegramModule } from '../telegram/telegram.module';
import { AgentsController } from './agents.controller';
import { AllowlistGuard } from './allowlist.guard';
import { AuthController } from './auth.controller';
import { RolesGuard } from './roles.guard';
import { SessionService } from './session.service';

@Module({
  imports: [TelegramModule],
  controllers: [AuthController, AgentsController],
  providers: [SessionService, AllowlistGuard, RolesGuard],
  exports: [SessionService, AllowlistGuard, RolesGuard],
})
export class AuthModule {}
