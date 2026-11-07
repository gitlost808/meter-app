import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { Client } from 'pg';

/** The SQL files the docker `db` service runs on first start (schema, seed data, report views). */
export const SQL_DIR = resolve(__dirname, '../../../../docker/db/sql/app');

const USAGE = [
  'Integration tests need DATABASE_URL pointing at a dedicated, disposable PostgreSQL test database.',
  'Its public schema is dropped and recreated on every run, so the database name must contain "test".',
  'Example:',
  '  docker run -d --rm --name meter-it-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=meter_app_test -p 55432:5432 postgres:16-alpine',
  '  DATABASE_URL=postgres://postgres:postgres@localhost:55432/meter_app_test npm run test:integration --workspace @meter-app/service',
].join('\n');

/**
 * Returns DATABASE_URL after checking that it names a test database.
 * There is deliberately no default: falling back to the dev database would wipe it.
 */
export function requireTestDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(`DATABASE_URL is not set.\n${USAGE}`);
  }

  let databaseName: string;
  try {
    databaseName = decodeURIComponent(new URL(url).pathname.replace(/^\//, ''));
  } catch {
    throw new Error(`DATABASE_URL is not a valid connection URL.\n${USAGE}`);
  }
  if (!/test/i.test(databaseName)) {
    throw new Error(`DATABASE_URL points at database "${databaseName}", which is not a test database.\n${USAGE}`);
  }
  return url;
}

async function withClient<T>(url: string, run: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    return await run(client);
  } finally {
    await client.end();
  }
}

/**
 * Recreates the public schema from the shipped SQL files, exactly as the docker `db` service does.
 * Each file runs on its own connection (like psql in docker-entrypoint-initdb.d), because
 * 01_init.sql clears search_path for its session and 03_report_values.sql relies on the default one.
 * 01_init.sql also loads the seed data; tests truncate it before inserting their own fixtures.
 */
export async function prepareTestDatabase(url: string): Promise<string[]> {
  await withClient(url, (client) =>
    client.query('DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;'),
  );

  const files = readdirSync(SQL_DIR)
    .filter((file) => file.endsWith('.sql'))
    .sort();
  for (const file of files) {
    const sql = readFileSync(join(SQL_DIR, file), 'utf8');
    try {
      await withClient(url, (client) => client.query(sql));
    } catch (error) {
      throw new Error(`Failed to run ${file}: ${(error as Error).message}`, { cause: error });
    }
  }
  return files;
}
