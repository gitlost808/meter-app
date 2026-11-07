import { INestApplication, ValidationPipe } from '@nestjs/common';

/**
 * HTTP configuration shared by main.ts and the integration tests,
 * so tests exercise the same routes and validation as the running service.
 */
export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
}
