import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { TelegramModule } from '../telegram/telegram.module';
import { ExcludedSendersController } from './excluded-senders.controller';
import { ExcludedSendersService } from './excluded-senders.service';

@Module({
  imports: [TelegramModule, AuthModule],
  controllers: [ExcludedSendersController],
  providers: [ExcludedSendersService],
  exports: [ExcludedSendersService],
})
export class ExcludedSendersModule {}
