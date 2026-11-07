import { prepareTestDatabase, requireTestDatabaseUrl } from './database';

/** `npm run test:integration:prepare`: rebuild the test database schema without running the tests. */
async function main(): Promise<void> {
  const url = requireTestDatabaseUrl();
  const files = await prepareTestDatabase(url);
  console.log(`Prepared test database from ${files.join(', ')}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
