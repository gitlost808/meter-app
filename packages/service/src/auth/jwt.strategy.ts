import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy, type SecretOrKeyProvider } from 'passport-jwt';
import { passportJwtSecret } from 'jwks-rsa';
import { readAuthConfig } from '../config/auth.config';

type JwtPayload = {
  sub?: string;
  preferred_username?: string;
  email?: string;
  name?: string;
  realm_access?: {
    roles?: string[];
  };
  resource_access?: Record<string, { roles?: string[] }>;
  [key: string]: unknown;
};

export type AuthenticatedUser = JwtPayload & {
  roles: string[];
};

function extractRoles(payload: JwtPayload, resource: string): string[] {
  const realmRoles = payload.realm_access?.roles ?? [];
  const resourceRoles = payload.resource_access?.[resource]?.roles ?? [];
  return Array.from(new Set([...realmRoles, ...resourceRoles]));
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly configService: ConfigService) {
    const authConfig = readAuthConfig(configService);

    if (authConfig.authDisabled) {
      super({
        jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
        ignoreExpiration: false,
        secretOrKey: 'auth-disabled-dev-only',
        algorithms: ['HS256'],
      });
      return;
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      issuer: authConfig.issuer,
      audience: authConfig.audience,
      algorithms: ['RS256'],
      secretOrKeyProvider: passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 5,
        jwksUri: authConfig.jwksUri,
      }) as unknown as SecretOrKeyProvider,
    });
  }

  validate(payload: JwtPayload): AuthenticatedUser {
    const { resource } = readAuthConfig(this.configService);
    const roles = extractRoles(payload, resource);
    return { ...payload, roles };
  }
}
