import { prepareTestDatabase, requireTestDatabaseUrl } from './database';

/** Vitest global setup: rebuild the test database schema once per integration run. */
export async function setup(): Promise<void> {
  const url = requireTestDatabaseUrl();
  await prepareTestDatabase(url);
}
