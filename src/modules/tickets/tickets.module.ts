import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ChatsModule } from '../chats/chats.module';
import { ExcludedSendersModule } from '../excluded-senders/excluded-senders.module';
import { RoutingModule } from '../routing/routing.module';
import { TelegramModule } from '../telegram/telegram.module';
import { CommentsService } from './comments.service';
import { CustomersService } from './customers.service';
import { IngestOrchestratorService } from './ingest-orchestrator.service';
import { LabelsController } from './labels.controller';
import { LabelsService } from './labels.service';
import { MessagesService } from './messages.service';
import { THREAD_GROUPING_REPOSITORY } from './thread-grouping/thread-grouping.tokens';
import { PrismaThreadGroupingRepository } from './thread-grouping/thread-grouping.prisma-repository';
import { ThreadGroupingService } from './thread-grouping/thread-grouping.service';
import { TicketsController } from './tickets.controller';
import { TicketsGateway } from './tickets.gateway';
import { TicketsService } from './tickets.service';

@Module({
  imports: [ChatsModule, RoutingModule, TelegramModule, AuthModule, ExcludedSendersModule],
  controllers: [TicketsController, LabelsController],
  providers: [
    TicketsService,
    MessagesService,
    LabelsService,
    CommentsService,
    CustomersService,
    ThreadGroupingService,
    { provide: THREAD_GROUPING_REPOSITORY, useClass: PrismaThreadGroupingRepository },
    IngestOrchestratorService,
    TicketsGateway,
  ],
  exports: [
    TicketsService,
    MessagesService,
    LabelsService,
    CommentsService,
    CustomersService,
    IngestOrchestratorService,
  ],
})
export class TicketsModule {}
