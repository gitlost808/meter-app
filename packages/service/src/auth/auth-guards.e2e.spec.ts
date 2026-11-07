import {
  CanActivate,
  Controller,
  ExecutionContext,
  Get,
  Module,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { Public } from './public.decorator';
import { WriteAccessGuard } from './write-access.guard';

class TestAuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      headers: { authorization?: string };
      user?: { roles: string[] };
    }>();
    const authHeader = request.headers.authorization;
    const [scheme, token] = authHeader?.split(' ') ?? [];
    if (scheme?.toLowerCase() !== 'bearer' || !token) {
      throw new UnauthorizedException('Missing bearer token');
    }

    request.user = { roles: token.split(',').filter(Boolean) };
    return true;
  }
}

@Controller('auth-e2e')
class AuthE2eController {
  @Public()
  @Get('public')
  getPublic() {
    return { ok: true };
  }

  @Get('protected')
  getProtected(@Req() req: { user?: { roles: string[] } }) {
    return { roles: req.user?.roles ?? [] };
  }

  @Post('protected')
  postProtected() {
    return { written: true };
  }
}

@Module({
  controllers: [AuthE2eController],
  providers: [
    Reflector,
    {
      provide: ConfigService,
      useValue: {
        get: (key: string) => {
          if (key === 'METER_APP_AUTH_DISABLED') return 'false';
          if (key === 'METER_APP_JWT_WRITE_ROLES') return 'admin';
          return undefined;
        },
      },
    },
    {
      provide: APP_GUARD,
      inject: [Reflector],
      useFactory: (reflector: Reflector) => new TestAuthGuard(reflector),
    },
    {
      provide: APP_GUARD,
      inject: [Reflector, ConfigService],
      useFactory: (reflector: Reflector, configService: ConfigService) =>
        new WriteAccessGuard(reflector, configService),
    },
  ],
})
class AuthE2eModule {}

describe('Auth guards integration', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AuthE2eModule],
    }).compile();

    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter(), {
      logger: ['error'],
    });
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('allows public route without token', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/auth-e2e/public',
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
  });

  it('allows protected read for authenticated user', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/auth-e2e/protected',
      headers: { authorization: 'Bearer reader' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ roles: ['reader'] });
  });

  it('rejects protected write for user without write role', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth-e2e/protected',
      headers: { authorization: 'Bearer reader' },
    });

    expect(res.statusCode).toBe(403);
  });

  it('allows protected write for user with write role', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth-e2e/protected',
      headers: { authorization: 'Bearer admin' },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json()).toEqual({ written: true });
  });
});
