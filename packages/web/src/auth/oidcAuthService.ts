import { readonly, ref, type Ref } from 'vue';
import { UserManager, WebStorageStateStore, type User } from 'oidc-client-ts';
import { sanitizeRedirectTarget } from './authRedirect';

export type OidcUiUser = {
  userName: string;
};

type OidcConfig = {
  issuer: string;
  clientId: string;
  redirectUri: string;
  postLogoutRedirectUri: string;
  scope: string;
};

const REQUIRED_OIDC_ENV_VARS = [
  'VITE_OIDC_ISSUER',
  'VITE_OIDC_CLIENT_ID',
  'VITE_OIDC_REDIRECT_URI',
] as const;

function parseBoolean(value: string | undefined, fallback = false): boolean {
  if (value === undefined) {
    return fallback;
  }

  return value.toLowerCase() === 'true';
}

function mapToUiUser(oidcUser: User): OidcUiUser {
  return {
    userName:
      String(oidcUser.profile.preferred_username ?? '') ||
      String(oidcUser.profile.name ?? '') ||
      String(oidcUser.profile.email ?? '') ||
      String(oidcUser.profile.sub ?? 'unknown-user'),
  };
}

class OidcAuthService {
  private manager: UserManager | null = null;
  private currentUser: User | null = null;
  private initialized = false;
  private initPromise: Promise<void> | null = null;
  private eventsBound = false;
  private readonly userRef = ref<OidcUiUser | null>(null);

  get user(): Readonly<Ref<OidcUiUser | null>> {
    return readonly(this.userRef);
  }

  isAuthEnabled(): boolean {
    return !this.isAuthDisabled();
  }

  async init(): Promise<void> {
    if (this.initialized) {
      return;
    }

    if (!this.initPromise) {
      this.initPromise = this.initializeInternal();
    }

    try {
      await this.initPromise;
    } catch (error) {
      this.initPromise = null;
      throw error;
    }
  }

  async getAccessToken(): Promise<string | null> {
    await this.init();

    if (this.isAuthDisabled()) {
      return null;
    }

    if (this.currentUser && !this.currentUser.expired) {
      return this.currentUser.access_token;
    }

    const loadedUser = await this.getUserManager().getUser();
    if (!loadedUser || loadedUser.expired) {
      this.setCurrentUser(null);
      return null;
    }

    this.setCurrentUser(loadedUser);
    return loadedUser.access_token;
  }

  async ensureAuthenticated(redirectTo: string): Promise<boolean> {
    await this.init();

    if (this.isAuthDisabled()) {
      return true;
    }

    const token = await this.getAccessToken();
    if (token) {
      return true;
    }

    await this.getUserManager().signinRedirect({
      state: { redirectTo },
    });
    return false;
  }

  async completeSigninCallback(): Promise<string> {
    if (this.isAuthDisabled()) {
      return '/';
    }

    const signinResult = await this.getUserManager().signinCallback();
    if (!signinResult) {
      this.setCurrentUser(null);
      return '/';
    }

    this.setCurrentUser(signinResult);

    if (typeof signinResult.state === 'object' && signinResult.state) {
      return sanitizeRedirectTarget(
        (signinResult.state as { redirectTo?: unknown }).redirectTo,
      );
    }

    return '/';
  }

  async login(
    redirectTo = `${window.location.pathname}${window.location.search}${window.location.hash}`,
  ): Promise<void> {
    if (this.isAuthDisabled()) {
      return;
    }

    await this.getUserManager().signinRedirect({
      state: { redirectTo },
    });
  }

  async logout(): Promise<void> {
    if (this.isAuthDisabled()) {
      this.userRef.value = { userName: 'local-dev' };
      return;
    }

    this.setCurrentUser(null);
    await this.getUserManager().signoutRedirect();
  }

  private isAuthDisabled(): boolean {
    if (import.meta.env.VITE_AUTH_DISABLED !== undefined) {
      return parseBoolean(import.meta.env.VITE_AUTH_DISABLED, false);
    }

    if (import.meta.env.MODE === 'test') {
      return true;
    }
    
    return false;
  }

  private getOidcConfig(): OidcConfig {
    const missing = REQUIRED_OIDC_ENV_VARS.filter((name) => {
      const value = import.meta.env[name];
      return typeof value !== 'string' || value.trim().length === 0;
    });

    if (missing.length > 0) {
      throw new Error(
        `Missing required OIDC config: ${missing.join(', ')}. Set these in envs/app.local.env.`,
      );
    }

    return {
      issuer: import.meta.env.VITE_OIDC_ISSUER as string,
      clientId: import.meta.env.VITE_OIDC_CLIENT_ID as string,
      redirectUri: import.meta.env.VITE_OIDC_REDIRECT_URI as string,
      postLogoutRedirectUri:
        import.meta.env.VITE_OIDC_POST_LOGOUT_REDIRECT_URI ?? window.location.origin,
      scope: import.meta.env.VITE_OIDC_SCOPE ?? 'openid profile email',
    };
  }

  private getUserManager(): UserManager {
    if (this.manager) {
      return this.manager;
    }

    const config = this.getOidcConfig();
    this.manager = new UserManager({
      authority: config.issuer,
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      post_logout_redirect_uri: config.postLogoutRedirectUri,
      response_type: 'code',
      scope: config.scope,
      userStore: new WebStorageStateStore({ store: window.sessionStorage }),
    });

    return this.manager;
  }

  private async initializeInternal(): Promise<void> {
    if (this.isAuthDisabled()) {
      this.userRef.value = { userName: 'local-dev' };
      this.initialized = true;
      return;
    }

    const userManager = this.getUserManager();
    const loadedUser = await userManager.getUser();
    if (loadedUser && !loadedUser.expired) {
      this.setCurrentUser(loadedUser);
    } else {
      this.setCurrentUser(null);
    }

    if (!this.eventsBound) {
      userManager.events.addUserLoaded((nextUser) => this.setCurrentUser(nextUser));
      userManager.events.addUserUnloaded(() => this.setCurrentUser(null));
      userManager.events.addAccessTokenExpired(() => this.setCurrentUser(null));
      this.eventsBound = true;
    }

    this.initialized = true;
  }

  private setCurrentUser(nextUser: User | null): void {
    this.currentUser = nextUser;
    this.userRef.value = nextUser ? mapToUiUser(nextUser) : null;
  }
}

export const oidcAuthService = new OidcAuthService();
