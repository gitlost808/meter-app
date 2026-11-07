import { splitCsv } from './env.utils';

export function getAllowedCorsOrigins(corsOriginEnv: string | undefined): string[] {
  const origins = splitCsv(corsOriginEnv);

  if (origins.length === 0) {
    throw new Error('CORS_ORIGIN must be set to a comma-separated allowlist');
  }

  return origins;
}
