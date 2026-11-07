<template>
  <v-app>
    <v-layout>
      <v-navigation-drawer v-model="drawer">
        <v-list>
          <NavItem v-for="item in menu" :key="item.name" :item="item" />
        </v-list>
        <template #append>
          <div class="pa-2">
            <p class="mb-2">Logged in as: {{ user?.userName ?? 'anonymous' }}</p>
            <v-btn block @click="handleAuthAction">
              {{ user ? 'Logout' : 'Login' }}
            </v-btn>
          </div>
        </template>
      </v-navigation-drawer>
      <v-app-bar>
        <v-app-bar-nav-icon @click="drawer = !drawer" />
        <v-app-bar-title>Hausdaten</v-app-bar-title>
        <v-spacer />
        <slot name="controls" />
      </v-app-bar>
      <v-main>
        <v-container fluid max-width="1800">
          <slot />
        </v-container>
      </v-main>
      <NavSnackbarArea />

    </v-layout>
  </v-app>
</template>

<script setup>
import { oidcAuthService } from '@/auth/oidcAuthService'

const user = oidcAuthService.user
const drawer = ref(null)
const menu = computed(() => ([
  {
    name: "Eingabe",
    page: "/",
  },
  {
    name: "Messwerte",
    page: "/values",
  },
  {
    name: "Notizen",
    page: "/notes",
  },
  {
    name: "Verwaltung",
    items: [
      {
        name: "Zähler",
        page: "/meters",
      },
      {
        name: "Zählerarten",
        page: "/meter-types",
      },
      {
        name: "Einheiten",
        page: "/units",
      },
    ],
  },
  {
    name: "Auswertungen",
    page: "/reports",
  },
]))

async function handleAuthAction() {
  if (user.value) {
    await oidcAuthService.logout()
    return
  }

  await oidcAuthService.login()
}
</script>
