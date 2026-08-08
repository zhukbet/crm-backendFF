import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { WorkerModule } from './worker.module';

async function bootstrap() {
  await NestFactory.createApplicationContext(WorkerModule);
  Logger.log(
    'Workers process started — connected to Postgres/Redis, but no queue processors are ' +
      'registered yet (see README: Seq 7/16 still open).',
    'Bootstrap',
  );
}

bootstrap();
