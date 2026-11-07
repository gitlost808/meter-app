import { describe, expect, it } from 'vitest';
import { getAllowedCorsOrigins } from './app.config';

describe('getAllowedCorsOrigins', () => {
  it('parses a comma-separated allowlist', () => {
    expect(
      getAllowedCorsOrigins('http://localhost:5173, https://meter.example'),
    ).toEqual(['http://localhost:5173', 'https://meter.example']);
  });

  it('rejects missing or empty config', () => {
    expect(() => getAllowedCorsOrigins(undefined)).toThrowError(
      'CORS_ORIGIN must be set',
    );
    expect(() => getAllowedCorsOrigins(' , ')).toThrowError(
      'CORS_ORIGIN must be set',
    );
  });
});
