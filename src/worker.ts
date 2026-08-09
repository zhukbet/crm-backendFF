import 'reflect-metadata';
import './common/bigint-json';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { WorkerModule } from './worker.module';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(WorkerModule);
  app.enableShutdownHooks();
  Logger.log('Workers process started — ingest and outbound queues have processors.', 'Bootstrap');
}

bootstrap();
