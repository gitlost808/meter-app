import path from "node:path";
import AutoImport from "unplugin-auto-import/vite";
import Components from "unplugin-vue-components/vite";
import VueRouter from "vue-router/vite";
import vue from "@vitejs/plugin-vue";
import vuetify from "vite-plugin-vuetify";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    VueRouter(),
    vue(),
    vuetify({ autoImport: true }),
    AutoImport({
      imports: ["vue", "vue-router", "pinia"],
      dirs: ["src/stores", "src/composables"],
      vueTemplate: true,
      dts: "src/auto-imports.d.ts",
      eslintrc: {
        enabled: false,
      },
    }),
    Components({
      dirs: ["src/components"],
      dts: "src/components.d.ts",
    }),
  ],
  // Pre-bundle Vuetify's overlay modules together so they share one z-index
  // stack in dev mode (menus inside dialogs otherwise render behind them).
  optimizeDeps: {
    include: [
      "vuetify/components/VOverlay",
      "vuetify/components/VDialog",
      "vuetify/components/VMenu",
      "vuetify/components/VSelect",
      "vuetify/components/VTooltip",
    ],
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@shared-api": path.resolve(import.meta.dirname, "../shared-api/src"),
    },
  },
  server: {
    allowedHosts: ["cybernode.vpn.0x29a.me"],
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3002",
        changeOrigin: true,
      },
    },
  },
});
