import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { describe, expect, it, vi } from 'vitest';
import { WriteAccessGuard } from './write-access.guard';

type RequestLike = {
  method?: string;
  user?: { roles: string[] };
};

function createContext(request: RequestLike) {
  return {
    getHandler: () => ({}),
    getClass: () => class TestController {},
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  };
}

function createConfig(values: Record<string, string | undefined>): ConfigService {
  return {
    get: (key: string) => values[key],
  } as unknown as ConfigService;
}

describe('WriteAccessGuard', () => {
  it('allows public routes', () => {
    const reflector = {
      getAllAndOverride: vi.fn().mockReturnValue(true),
    } as unknown as Reflector;
    const guard = new WriteAccessGuard(reflector, createConfig({}));

    const result = guard.canActivate(
      createContext({ method: 'POST', user: { roles: [] } }) as never,
    );

    expect(result).toBe(true);
  });

  it('allows write when required role is present', () => {
    const reflector = {
      getAllAndOverride: vi.fn().mockReturnValue(false),
    } as unknown as Reflector;
    const guard = new WriteAccessGuard(
      reflector,
      createConfig({
        METER_APP_AUTH_DISABLED: 'false',
        METER_APP_JWT_WRITE_ROLES: 'admin,editor',
      }),
    );

    const result = guard.canActivate(
      createContext({ method: 'PATCH', user: { roles: ['reader', 'editor'] } }) as never,
    );

    expect(result).toBe(true);
  });

  it('rejects write when required role is missing', () => {
    const reflector = {
      getAllAndOverride: vi.fn().mockReturnValue(false),
    } as unknown as Reflector;
    const guard = new WriteAccessGuard(
      reflector,
      createConfig({
        METER_APP_AUTH_DISABLED: 'false',
        METER_APP_JWT_WRITE_ROLES: 'admin',
      }),
    );

    expect(() =>
      guard.canActivate(
        createContext({ method: 'DELETE', user: { roles: ['reader'] } }) as never,
      ),
    ).toThrowError('Insufficient role for write access');
  });

  it('allows read methods without role checks', () => {
    const reflector = {
      getAllAndOverride: vi.fn().mockReturnValue(false),
    } as unknown as Reflector;
    const guard = new WriteAccessGuard(
      reflector,
      createConfig({
        METER_APP_AUTH_DISABLED: 'false',
        METER_APP_JWT_WRITE_ROLES: 'admin',
      }),
    );

    const result = guard.canActivate(
      createContext({ method: 'GET', user: { roles: [] } }) as never,
    );

    expect(result).toBe(true);
  });
});
