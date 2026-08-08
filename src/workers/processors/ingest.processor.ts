import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_INGEST } from '../../common/queues/queue.constants';
import { IngestOrchestratorService } from '../../modules/tickets/ingest-orchestrator.service';
import { NormalizedIncomingMessage } from '../../modules/telegram/telegram.types';

/**
 * Seq 7: consumes the ingest queue. Per-message dedup happens at the queue level (the
 * producer sets jobId = `${chatId}:${tgMessageId}`, so BullMQ silently drops re-enqueued
 * duplicates); the DB-level unique constraint on messages(tg_message_id, ticket_id) is the
 * backstop if a duplicate ever slips through (e.g. after the dedup window/removeOnComplete
 * cap has passed).
 */
@Processor(QUEUE_INGEST)
export class IngestProcessor extends WorkerHost {
  private readonly logger = new Logger(IngestProcessor.name);

  constructor(private readonly orchestrator: IngestOrchestratorService) {
    super();
  }

  async process(job: Job<NormalizedIncomingMessage>): Promise<void> {
    const result = await this.orchestrator.process(job.data);
    this.logger.debug(`Ingest job ${job.id} -> ${result.outcome}`);
  }
}
