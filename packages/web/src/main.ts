import { createApp } from "vue";
import { createPinia } from "pinia";
import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import App from "./App.vue";
import { router } from "./router";
import { vuetify } from "./plugins/vuetify";
import { buildAuthErrorRoute } from "./auth/authErrorRoute";
import { oidcAuthService } from "./auth/oidcAuthService";
import "./styles/reset.css";
import "./styles/tailwind.css";

const app = createApp(App);
const queryClient = new QueryClient();

app.use(createPinia());
app.use(VueQueryPlugin, { queryClient });
app.use(router);
app.use(vuetify);

// Don't await router.isReady() here: it rejects when the initial navigation
// is aborted (e.g. by the auth guard redirecting to the identity provider),
// which would stop this module before app.mount() and leave a blank page.
try {
  await oidcAuthService.init();
} catch (error) {
  console.error("OIDC initialization failed", error);
  await router.replace(
    buildAuthErrorRoute("init", error, window.location.pathname),
  );
}

app.mount("#app");
