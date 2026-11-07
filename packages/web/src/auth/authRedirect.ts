export function sanitizeRedirectTarget(value: unknown, fallback = '/'): string {
  if (typeof value !== 'string' || value.length === 0) {
    return fallback;
  }

  if (!value.startsWith('/')) {
    return fallback;
  }

  if (value.startsWith('//')) {
    return fallback;
  }

  return value;
}
