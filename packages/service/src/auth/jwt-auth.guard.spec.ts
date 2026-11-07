import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { describe, expect, it, vi } from 'vitest';
import { JwtAuthGuard } from './jwt-auth.guard';

function createConfig(values: Record<string, string | undefined>): ConfigService {
  return {
    get: (key: string) => values[key],
  } as unknown as ConfigService;
}

function createContext() {
  return {
    getHandler: () => ({}),
    getClass: () => class TestController {},
  };
}

describe('JwtAuthGuard', () => {
  it('allows public routes without delegating to passport', async () => {
    const reflector = {
      getAllAndOverride: vi.fn().mockReturnValue(true),
    } as unknown as Reflector;
    const guard = new JwtAuthGuard(reflector, createConfig({}));

    const parentCanActivate = vi.spyOn(
      Object.getPrototypeOf(JwtAuthGuard.prototype),
      'canActivate',
    );

    const result = await guard.canActivate(createContext() as never);

    expect(result).toBe(true);
    expect(parentCanActivate).not.toHaveBeenCalled();
  });

  it('allows when auth is disabled without delegating to passport', async () => {
    const reflector = {
      getAllAndOverride: vi.fn().mockReturnValue(false),
    } as unknown as Reflector;
    const guard = new JwtAuthGuard(
      reflector,
      createConfig({ METER_APP_AUTH_DISABLED: 'true' }),
    );

    const parentCanActivate = vi.spyOn(
      Object.getPrototypeOf(JwtAuthGuard.prototype),
      'canActivate',
    );

    const result = await guard.canActivate(createContext() as never);

    expect(result).toBe(true);
    expect(parentCanActivate).not.toHaveBeenCalled();
  });

  it('delegates to passport guard when auth is enabled', async () => {
    const reflector = {
      getAllAndOverride: vi.fn().mockReturnValue(false),
    } as unknown as Reflector;
    const guard = new JwtAuthGuard(
      reflector,
      createConfig({ METER_APP_AUTH_DISABLED: 'false' }),
    );

    const parentCanActivate = vi
      .spyOn(Object.getPrototypeOf(JwtAuthGuard.prototype), 'canActivate')
      .mockResolvedValueOnce(true);

    const context = createContext() as never;
    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(parentCanActivate).toHaveBeenCalledWith(context);
  });
});
