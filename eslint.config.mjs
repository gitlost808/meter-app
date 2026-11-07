import js from "@eslint/js";
import globals from "globals";
import eslintConfigPrettier from "eslint-config-prettier";
import pluginVue from "eslint-plugin-vue";
import tseslint from "typescript-eslint";
import vueParser from "vue-eslint-parser";

export default [
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.nuxt/**",
      "**/.output/**",
      "**/coverage/**",
      "**/*.d.ts",
      "packages/shared-api/src/generated/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...pluginVue.configs["flat/recommended"],
  {
    files: ["packages/service/**/*.{ts,js}"],
    languageOptions: {
      parser: tseslint.parser,
      sourceType: "module",
      globals: {
        ...globals.node,
      },
    },
    rules: {
      "no-console": "off",
      "no-undef": "off",
    },
  },
  {
    files: ["packages/shared-api/**/*.ts"],
    languageOptions: {
      parser: tseslint.parser,
      sourceType: "module",
    },
    rules: {
      "no-undef": "off",
    },
  },
  {
    files: ["packages/web/**/*.ts"],
    languageOptions: {
      parser: tseslint.parser,
      sourceType: "module",
      globals: {
        ...globals.browser,
      },
    },
    rules: {
      "no-undef": "off",
    },
  },
  {
    files: ["packages/web/**/*.vue"],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: tseslint.parser,
        sourceType: "module",
        extraFileExtensions: [".vue"],
      },
      globals: {
        ...globals.browser,
      },
    },
    rules: {
      "no-undef": "off",
      "vue/multi-word-component-names": "off",
      "vue/require-prop-types": "off",
      "vue/valid-v-slot": "off",
    },
  },
  {
    files: ["packages/web/*.{ts,js,mjs}"],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
  {
    files: ["packages/web/*.cjs"],
    languageOptions: {
      sourceType: "commonjs",
      globals: {
        ...globals.node,
      },
    },
  },
  {
    files: ["packages/web/src/test/**/*.ts", "packages/web/vitest.config.ts"],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
  eslintConfigPrettier,
];
