import { ConfigService } from '@nestjs/config';
import { describe, expect, it } from 'vitest';
import { JwtStrategy } from './jwt.strategy';

function createConfig(values: Record<string, string | undefined>): ConfigService {
  return {
    get: (key: string) => values[key],
  } as unknown as ConfigService;
}

describe('JwtStrategy', () => {
  it('throws when auth is enabled and issuer is missing', () => {
    expect(() => {
      new JwtStrategy(
        createConfig({
          METER_APP_AUTH_DISABLED: 'false',
        }),
      );
    }).toThrowError('METER_APP_JWT_ISSUER must be set');
  });

  it('does not throw when auth is disabled and issuer is missing', () => {
    expect(() => {
      new JwtStrategy(
        createConfig({
          METER_APP_AUTH_DISABLED: 'true',
        }),
      );
    }).not.toThrow();
  });

  it('extracts roles from realm and configured resource only', () => {
    const strategy = new JwtStrategy(
      createConfig({
        METER_APP_AUTH_DISABLED: 'false',
        METER_APP_JWT_ISSUER: 'http://localhost:8081/realms/dev',
        METER_APP_JWT_RESOURCE: 'app',
      }),
    );

    const user = strategy.validate({
      sub: 'user-1',
      realm_access: { roles: ['reader'] },
      resource_access: {
        app: { roles: ['admin'] },
        other: { roles: ['admin-other'] },
      },
    });

    expect(user.roles).toEqual(['reader', 'admin']);
    expect(user.roles).not.toContain('admin-other');
  });
});
