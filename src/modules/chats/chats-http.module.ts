import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ChatsController } from './chats.controller';
import { ChatsModule } from './chats.module';

@Module({
  imports: [ChatsModule, AuthModule],
  controllers: [ChatsController],
})
export class ChatsHttpModule {}
