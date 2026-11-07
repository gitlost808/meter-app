import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type MockOidcUser = {
  expired?: boolean;
  access_token?: string;
  profile?: Record<string, unknown>;
  state?: unknown;
};

function createMockOidcUser(overrides: MockOidcUser = {}) {
  return {
    expired: false,
    access_token: 'token-1',
    profile: {
      preferred_username: 'alice',
      sub: 'user-1',
    },
    ...overrides,
  };
}

function setupOidcMock() {
  const manager = {
    getUser: vi.fn(),
    signinRedirect: vi.fn(),
    signinCallback: vi.fn(),
    signoutRedirect: vi.fn(),
    events: {
      addUserLoaded: vi.fn(),
      addUserUnloaded: vi.fn(),
      addAccessTokenExpired: vi.fn(),
    },
  };

  const UserManager = vi.fn(function UserManagerMock() {
    return manager;
  });
  const WebStorageStateStore = vi.fn(function WebStorageStateStoreMock() {
    return {};
  });

  vi.doMock('oidc-client-ts', () => ({
    UserManager,
    WebStorageStateStore,
  }));

  return { manager, UserManager, WebStorageStateStore };
}

async function loadService() {
  const mod = await import('./oidcAuthService');
  return mod.oidcAuthService;
}

function enableAuthEnv(): void {
  vi.stubEnv('VITE_AUTH_DISABLED', 'false');
  vi.stubEnv('VITE_OIDC_ISSUER', 'http://localhost:8081/realms/dev');
  vi.stubEnv('VITE_OIDC_CLIENT_ID', 'app');
  vi.stubEnv('VITE_OIDC_REDIRECT_URI', 'http://localhost:5173/auth/callback');
}

describe('oidcAuthService', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('uses local dev user when auth is disabled', async () => {
    vi.stubEnv('VITE_AUTH_DISABLED', 'true');
    const { UserManager } = setupOidcMock();
    const service = await loadService();

    await service.init();

    expect(service.user.value).toEqual({ userName: 'local-dev' });
    expect(UserManager).not.toHaveBeenCalled();
  });

  it('initializes and maps loaded user when auth is enabled', async () => {
    enableAuthEnv();
    const { manager, UserManager, WebStorageStateStore } = setupOidcMock();
    manager.getUser.mockResolvedValue(createMockOidcUser());
    const service = await loadService();

    await service.init();

    expect(UserManager).toHaveBeenCalledTimes(1);
    expect(WebStorageStateStore).toHaveBeenCalledWith({
      store: window.sessionStorage,
    });
    expect(service.user.value).toEqual({ userName: 'alice' });
    expect(manager.events.addUserLoaded).toHaveBeenCalledTimes(1);
    expect(manager.events.addUserUnloaded).toHaveBeenCalledTimes(1);
    expect(manager.events.addAccessTokenExpired).toHaveBeenCalledTimes(1);
  });

  it('retries init after an initialization failure', async () => {
    enableAuthEnv();
    const { manager } = setupOidcMock();
    manager.getUser
      .mockRejectedValueOnce(new Error('init failed'))
      .mockResolvedValueOnce(null);
    const service = await loadService();

    await expect(service.init()).rejects.toThrow('init failed');
    await expect(service.init()).resolves.toBeUndefined();
    expect(manager.getUser).toHaveBeenCalledTimes(2);
  });

  it('ensureAuthenticated redirects when token is missing', async () => {
    enableAuthEnv();
    const { manager } = setupOidcMock();
    manager.getUser.mockResolvedValue(null);
    const service = await loadService();

    await expect(service.ensureAuthenticated('/meters?x=1')).resolves.toBe(false);
    expect(manager.signinRedirect).toHaveBeenCalledWith({
      state: { redirectTo: '/meters?x=1' },
    });
  });

  it('ensureAuthenticated succeeds when token exists', async () => {
    enableAuthEnv();
    const { manager } = setupOidcMock();
    manager.getUser.mockResolvedValue(createMockOidcUser({ access_token: 'token-abc' }));
    const service = await loadService();

    await expect(service.ensureAuthenticated('/reports')).resolves.toBe(true);
    expect(manager.signinRedirect).not.toHaveBeenCalled();
  });

  it('returns redirect target from signin callback state', async () => {
    enableAuthEnv();
    const { manager } = setupOidcMock();
    manager.signinCallback.mockResolvedValue(
      createMockOidcUser({
        state: { redirectTo: '/reports?range=30d' },
      }),
    );
    const service = await loadService();

    await expect(service.completeSigninCallback()).resolves.toBe('/reports?range=30d');
    expect(service.user.value).toEqual({ userName: 'alice' });
  });

  it('falls back to the app root for unsafe callback redirect targets', async () => {
    enableAuthEnv();
    const { manager } = setupOidcMock();
    manager.signinCallback.mockResolvedValue(
      createMockOidcUser({
        state: { redirectTo: 'https://evil.example' },
      }),
    );
    const service = await loadService();

    await expect(service.completeSigninCallback()).resolves.toBe('/');
  });

  it('fails fast when auth is enabled and required oidc env is missing', async () => {
    vi.stubEnv('VITE_AUTH_DISABLED', 'false');
    const { manager } = setupOidcMock();
    manager.getUser.mockResolvedValue(null);
    const service = await loadService();

    await expect(service.init()).rejects.toThrow('Missing required OIDC config');
  });
});
