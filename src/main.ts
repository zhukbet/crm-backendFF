import 'reflect-metadata';
import './common/bigint-json';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  // Without this, SIGTERM/SIGINT (how Docker/k8s stop a container) never fires
  // onModuleDestroy — Redis/Prisma connections would leak instead of closing cleanly.
  app.enableShutdownHooks();

  // Without this, every @IsIn/@IsUUID/@Type(...) decorator across every DTO is dead code —
  // Nest only runs class-validator/class-transformer through a pipe, and none is wired in by
  // default. Also what actually applies `@Type(() => Number)` + default values (e.g.
  // ListTicketsQueryDto.limit) to raw query strings; without it query.limit stays `undefined`.
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));

  // Section 22.1: fixed route prefix /api so support-crm-infra's reverse proxy and the
  // frontend's generated API client can rely on it without per-environment configuration.
  app.setGlobalPrefix('api');
  app.use(cookieParser());
  app.enableCors({
    origin: config.get<string[]>('frontendOrigins'),
    credentials: true,
  });

  const swaggerDocument = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('Support CRM API')
      .setDescription('Backend API for the Telegram-based support CRM')
      .setVersion('0.1.0')
      .build(),
  );
  // Exposes both the UI (/api/docs) and, per section 22.1 point 1, the raw spec the frontend
  // codegens a typed client from (/api/docs-json).
  SwaggerModule.setup('api/docs', app, swaggerDocument);

  const port = config.get<number>('port') ?? 3000;
  await app.listen(port);
}

bootstrap();
