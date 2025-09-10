import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { json } from 'express';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn', 'log'] });
  app.enableCors();
  app.use(json());
  app.useGlobalPipes(new ValidationPipe());
  await app.listen(3000);
}
if (require.main === module) {
  bootstrap();
}