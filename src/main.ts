import 'reflect-metadata';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  // Section 22.1: fixed route prefix /api so support-crm-infra's reverse proxy and the
  // frontend's generated API client can rely on it without per-environment configuration.
  app.setGlobalPrefix('api');
  app.use(cookieParser());
  app.enableCors({
    origin: config.get<string>('frontendOrigin'),
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
