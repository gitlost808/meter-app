import 'reflect-metadata';
import 'dotenv/config';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cors from '@fastify/cors';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import { getAllowedCorsOrigins } from './config/app.config';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  );
  const configService = app.get(ConfigService);
  const corsOrigins = getAllowedCorsOrigins(configService.get<string>('CORS_ORIGIN'));

  await app.register(cors, {
    origin: corsOrigins,
    credentials: true,
  });

  configureApp(app);

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Meter App Service V2')
    .setDescription('REST API for meter app')
    .setVersion('0.1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
      'bearer',
    )
    .addSecurityRequirements('bearer')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document, {
    jsonDocumentUrl: 'openapi.json',
  });

  const port = Number(process.env.PORT ?? 3002);
  await app.listen(port, '0.0.0.0');
}

void bootstrap();
