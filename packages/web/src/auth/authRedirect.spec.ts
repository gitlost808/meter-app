import { describe, expect, it } from 'vitest';
import { sanitizeRedirectTarget } from './authRedirect';

describe('sanitizeRedirectTarget', () => {
  it('accepts app-internal paths', () => {
    expect(sanitizeRedirectTarget('/reports?range=30d')).toBe('/reports?range=30d');
  });

  it('rejects external or protocol-relative targets', () => {
    expect(sanitizeRedirectTarget('https://evil.example')).toBe('/');
    expect(sanitizeRedirectTarget('//evil.example')).toBe('/');
  });

  it('falls back for missing targets', () => {
    expect(sanitizeRedirectTarget(undefined)).toBe('/');
  });
});
