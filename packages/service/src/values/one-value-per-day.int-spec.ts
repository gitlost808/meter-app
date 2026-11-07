import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Client } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  createIntegrationApp,
  createMeter,
  createMeterTypes,
  resetTables,
  type IntegrationContext,
} from '../../test/integration/app';
import { requireTestDatabaseUrl, SQL_DIR } from '../../test/integration/database';
import { ONE_VALUE_PER_DAY_INDEX } from './one-value-per-day';

// Readings are daily values: a meter has at most one reading per day (UTC), enforced by the
// unique index from docker/db/sql/app/04_unique_value_per_day.sql. Different meters may share
// a day (meter change). Every API path that writes readings reports a violation as 409.

const DAY = '2024-06-01T00:00:00.000Z';
const SAME_DAY_LATER = '2024-06-01T18:30:00.000Z';
const NEXT_DAY = '2024-06-02T00:00:00.000Z';
const MIGRATION = readFileSync(join(SQL_DIR, '04_unique_value_per_day.sql'), 'utf8');

/** Runs SQL on its own connection; the migration uses BEGIN/COMMIT and a DO block. */
async function runSql(sql: string): Promise<void> {
  const client = new Client({ connectionString: requireTestDatabaseUrl() });
  await client.connect();
  try {
    await client.query(sql);
  } finally {
    await client.end();
  }
}

describe('one reading per meter and day', () => {
  let ctx: IntegrationContext;
  let fx: { types: { gas: number; electricity: number }; gasMeterId: number; gasValueId: number; electricityMeterId: number };

  const valueCount = () => ctx.prisma.value.count();
  const indexExists = async () =>
    (await ctx.prisma.$queryRaw<{ n: bigint }[]>`
      SELECT count(*) AS n FROM pg_indexes WHERE indexname = ${ONE_VALUE_PER_DAY_INDEX}`)[0].n === 1n;

  beforeAll(async () => {
    ctx = await createIntegrationApp();
  });

  afterAll(async () => {
    // Leave the shared test database with the index in place for the other test files.
    await resetTables(ctx.prisma);
    await runSql(MIGRATION);
    await ctx.app.close();
  });

  beforeEach(async () => {
    await resetTables(ctx.prisma);
    const types = await createMeterTypes(ctx.prisma, ['gas', 'electricity']);
    const gas = await createMeter(ctx.prisma, types.gas, 'gas 1', [[DAY, 100]]);
    const electricity = await createMeter(ctx.prisma, types.electricity, 'electricity 1');
    fx = { types, gasMeterId: gas.meterId, gasValueId: gas.valueIds[0], electricityMeterId: electricity.meterId };
  });

  describe('API', () => {
    it('rejects a second reading of a meter on the same day with 409', async () => {
      for (const timestamp of [DAY, SAME_DAY_LATER]) {
        const res = await ctx.app.inject({
          method: 'POST',
          url: '/api/values',
          payload: { meterId: fx.gasMeterId, timestamp, value: 101 },
        });
        expect(res.statusCode).toBe(409);
        expect(res.json()).toMatchObject({ message: `Meter ${fx.gasMeterId} already has a reading on 2024-06-01` });
      }
      expect(await valueCount()).toBe(1);
    });

    it('allows the same day for another meter and the next day for the same meter', async () => {
      const otherMeter = await ctx.app.inject({
        method: 'POST',
        url: '/api/values',
        payload: { meterId: fx.electricityMeterId, timestamp: DAY, value: 5 },
      });
      const nextDay = await ctx.app.inject({
        method: 'POST',
        url: '/api/values',
        payload: { meterId: fx.gasMeterId, timestamp: NEXT_DAY, value: 101 },
      });
      expect([otherMeter.statusCode, nextDay.statusCode]).toEqual([201, 201]);
      expect(await valueCount()).toBe(3);
    });

    it('rejects moving a reading onto a day that already has one, but allows changing its value', async () => {
      const next = await ctx.prisma.value.create({
        data: { meterId: fx.gasMeterId, timestamp: new Date(NEXT_DAY), value: 110 },
      });

      const moved = await ctx.app.inject({ method: 'PATCH', url: `/api/values/${next.id}`, payload: { timestamp: DAY } });
      expect(moved.statusCode).toBe(409);
      expect(moved.json()).toMatchObject({ message: `Meter ${fx.gasMeterId} already has a reading on 2024-06-01` });
      expect((await ctx.prisma.value.findUniqueOrThrow({ where: { id: next.id } })).timestamp.toISOString()).toBe(NEXT_DAY);

      const revalued = await ctx.app.inject({ method: 'PATCH', url: `/api/values/${next.id}`, payload: { value: 111 } });
      expect(revalued.statusCode).toBe(200);
    });

    it('rejects a duplicate through POST /api/meters/:id/values', async () => {
      const res = await ctx.app.inject({
        method: 'POST',
        url: `/api/meters/${fx.gasMeterId}/values`,
        payload: { timestamp: SAME_DAY_LATER, value: 101 },
      });
      expect(res.statusCode).toBe(409);
      expect(await valueCount()).toBe(1);
    });

    it('rolls back the whole value entry when one of its readings would duplicate a day', async () => {
      const res = await ctx.app.inject({
        method: 'POST',
        url: '/api/value-entries',
        payload: {
          timestamp: DAY,
          entries: [
            { meterTypeId: fx.types.electricity, value: { kind: 'create', meterId: fx.electricityMeterId, value: 5 } },
            { meterTypeId: fx.types.gas, value: { kind: 'create', meterId: fx.gasMeterId, value: 101 } },
          ],
        },
      });
      expect(res.statusCode).toBe(409);
      expect(res.json()).toMatchObject({ message: `Meter ${fx.gasMeterId} already has a reading on 2024-06-01` });
      // the electricity reading of the same request is rolled back too
      expect(await valueCount()).toBe(1);
    });

    it('still allows a meter change: the old and the new meter both get a reading on that day', async () => {
      const res = await ctx.app.inject({
        method: 'POST',
        url: '/api/value-entries',
        payload: {
          timestamp: NEXT_DAY,
          entries: [{
            meterTypeId: fx.types.gas,
            value: { kind: 'create', meterId: fx.gasMeterId, value: 105 },
            newMeter: { kind: 'create', meterName: 'gas 2', value: 0 },
          }],
        },
      });
      expect(res.statusCode).toBe(204);
      expect(await valueCount()).toBe(3);
    });
  });

  describe('04_unique_value_per_day.sql on an existing database', () => {
    beforeEach(async () => {
      await runSql(`DROP INDEX ${ONE_VALUE_PER_DAY_INDEX}`);
    });

    it('removes exact duplicates (keeping the lowest id), creates the index and can run again', async () => {
      const duplicates = await ctx.prisma.value.createManyAndReturn({
        data: [
          { meterId: fx.gasMeterId, timestamp: new Date(DAY), value: 100 },
          { meterId: fx.gasMeterId, timestamp: new Date(SAME_DAY_LATER), value: 100 },
          { meterId: fx.gasMeterId, timestamp: new Date(NEXT_DAY), value: 110 },
        ],
      });
      expect(await valueCount()).toBe(4);

      await runSql(MIGRATION);
      await runSql(MIGRATION);

      const remaining = await ctx.prisma.value.findMany({ orderBy: { id: 'asc' } });
      expect(remaining.map((row) => row.id)).toEqual([fx.gasValueId, duplicates[2].id]);
      expect(await indexExists()).toBe(true);
    });

    it('stops without changing anything when a meter has different values on one day', async () => {
      const conflicting = await ctx.prisma.value.create({
        data: { meterId: fx.gasMeterId, timestamp: new Date(SAME_DAY_LATER), value: 999 },
      });
      // an exact duplicate in the same run must not be deleted either, because the script rolls back
      await ctx.prisma.value.create({ data: { meterId: fx.gasMeterId, timestamp: new Date(DAY), value: 100 } });

      await expect(runSql(MIGRATION)).rejects.toThrow(
        `Meters with several different readings on the same day: meter ${fx.gasMeterId} on 2024-06-01`,
      );
      expect(await valueCount()).toBe(3);
      expect(await indexExists()).toBe(false);

      await ctx.prisma.value.delete({ where: { id: conflicting.id } });
      await runSql(MIGRATION);
      expect(await valueCount()).toBe(1);
      expect(await indexExists()).toBe(true);
    });
  });
});
