<template>
  <v-row class="py-8" justify="center">
    <v-col cols="12" md="8" lg="6">
      <v-card>
        <v-card-title class="text-h6">Anmeldung fehlgeschlagen</v-card-title>
        <v-card-text>
          <p class="mb-2">
            {{ message }}
          </p>
          <p class="text-medium-emphasis">
            Ursache: {{ reasonLabel }}
          </p>
        </v-card-text>
        <v-card-actions>
          <v-btn variant="flat" color="primary" @click="retry">
            Erneut versuchen
          </v-btn>
          <v-btn variant="outlined" @click="triggerLogin">
            Login starten
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-col>
  </v-row>
</template>

<script setup lang="ts">
import type { AuthErrorCode } from '@/auth/authErrorRoute';
import { sanitizeRedirectTarget } from '@/auth/authRedirect';
import { oidcAuthService } from '@/auth/oidcAuthService';

const route = useRoute();
const router = useRouter();

const reason = computed(() =>
  typeof route.query.reason === 'string' ? route.query.reason : 'unknown',
);

const code = computed<AuthErrorCode | 'unknown'>(() =>
  route.query.code === 'auth-flow-failed' ? 'auth-flow-failed' : 'unknown',
);

const message = computed(() => {
  if (code.value === 'auth-flow-failed') {
    return 'Die Anmeldung konnte nicht abgeschlossen werden. Bitte versuchen Sie es erneut.';
  }

  return 'Die Anmeldung ist fehlgeschlagen.';
});

const reasonLabel = computed(() => {
  switch (reason.value) {
    case 'init':
      return 'Initialisierung';
    case 'callback':
      return 'OIDC Callback';
    case 'guard':
      return 'Routenprüfung';
    case 'login':
      return 'Login Start';
    default:
      return 'Unbekannt';
  }
});

const redirectTo = computed(() => sanitizeRedirectTarget(route.query.redirectTo));

async function retry() {
  try {
    await oidcAuthService.init();
    await router.replace(redirectTo.value);
  } catch (error) {
    console.error('Auth retry failed', error);
  }
}

async function triggerLogin() {
  try {
    await oidcAuthService.login(redirectTo.value);
  } catch (error) {
    console.error('Auth login failed', error);
  }
}
</script>
