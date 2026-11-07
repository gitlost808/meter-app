import { configDefaults, defineConfig } from 'vitest/config';

// Unit tests only: they mock Prisma and need no database.
// Integration tests (*.int-spec.ts) run via vitest.integration.config.mts.
export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude, '**/*.int-spec.ts'],
  },
});
