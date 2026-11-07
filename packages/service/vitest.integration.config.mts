import { defineConfig } from 'vitest/config';

// Integration tests against a real PostgreSQL (see AGENTS.md, "Testing and verification").
// Requires DATABASE_URL pointing at a disposable test database; the global setup
// drops and recreates its schema from docker/db/sql/app.
export default defineConfig({
  test: {
    include: ['src/**/*.int-spec.ts'],
    globalSetup: ['./test/integration/global-setup.ts'],
    // All test files share one database, so they must not run concurrently.
    fileParallelism: false,
    hookTimeout: 60_000,
    testTimeout: 30_000,
  },
});
