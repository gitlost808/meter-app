import { ConfigService } from '@nestjs/config';
import { parseBoolean, splitCsv } from './env.utils';

export type AuthConfig = {
  authDisabled: boolean;
  issuer: string;
  audience?: string;
  jwksUri: string;
  resource: string;
  writeRoles: string[];
};

export function isAuthDisabled(configService: ConfigService): boolean {
  return parseBoolean(configService.get<string>('METER_APP_AUTH_DISABLED'), false);
}

export function getWriteRoles(configService: ConfigService): string[] {
  return splitCsv(configService.get<string>('METER_APP_JWT_WRITE_ROLES'));
}

export function readAuthConfig(configService: ConfigService): AuthConfig {
  const authDisabled = isAuthDisabled(configService);
  const issuer =
    configService.get<string>('METER_APP_JWT_ISSUER') ??
    (authDisabled ? 'http://auth-disabled.local' : undefined);

  if (!issuer) {
    throw new Error(
      'METER_APP_JWT_ISSUER must be set when METER_APP_AUTH_DISABLED=false',
    );
  }

  return {
    authDisabled,
    issuer,
    audience: configService.get<string>('METER_APP_JWT_AUDIENCE') || undefined,
    jwksUri:
      configService.get<string>('METER_APP_JWT_JWKS_URI') ??
      `${issuer}/protocol/openid-connect/certs`,
    resource: configService.get<string>('METER_APP_JWT_RESOURCE') ?? 'app',
    writeRoles: getWriteRoles(configService),
  };
}
