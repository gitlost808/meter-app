export type AuthErrorReason = 'init' | 'callback' | 'guard' | 'login';
export type AuthErrorCode = 'auth-flow-failed';

export function buildAuthErrorRoute(
  reason: AuthErrorReason,
  _error: unknown,
  redirectTo?: string,
): string {
  const params = new URLSearchParams();
  params.set('reason', reason);
  params.set('code', 'auth-flow-failed');
  if (redirectTo) {
    params.set('redirectTo', redirectTo);
  }

  return `/auth/error?${params.toString()}`;
}
