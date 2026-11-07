<template>
  <v-row class="py-8" justify="center">
    <v-col cols="12" md="8" lg="6">
      <v-card>
        <v-card-title class="text-h6">Anmeldung wird verarbeitet</v-card-title>
        <v-card-text>
          <p>Bitte warten...</p>
        </v-card-text>
      </v-card>
    </v-col>
  </v-row>
</template>

<script setup lang="ts">
import { buildAuthErrorRoute } from '@/auth/authErrorRoute';
import { sanitizeRedirectTarget } from '@/auth/authRedirect';
import { oidcAuthService } from '@/auth/oidcAuthService';

const router = useRouter();

onMounted(async () => {
  try {
    const redirectTo = await oidcAuthService.completeSigninCallback();
    await router.replace(sanitizeRedirectTarget(redirectTo));
  } catch (error) {
    await router.replace(buildAuthErrorRoute('callback', error));
  }
});
</script>
