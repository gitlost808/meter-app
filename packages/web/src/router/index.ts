import { createRouter, createWebHistory } from "vue-router";
import { routes, handleHotUpdate } from "vue-router/auto-routes";
import { buildAuthErrorRoute } from "@/auth/authErrorRoute";
import { oidcAuthService } from "@/auth/oidcAuthService";

export const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach(async (to) => {
  if (!oidcAuthService.isAuthEnabled()) {
    return true;
  }

  if (to.path === "/auth/callback") {
    return true;
  }

  if (to.path === "/auth/error") {
    return true;
  }

  try {
    return await oidcAuthService.ensureAuthenticated(to.fullPath);
  } catch (error) {
    return buildAuthErrorRoute('guard', error, to.fullPath);
  }
});

if (import.meta.hot) {
  handleHotUpdate(router);
}
