import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  createIntegrationApp,
  createMeter,
  createMeterTypes,
  resetTables,
  type IntegrationContext,
} from '../../test/integration/app';

// Exercises v_meter_stats (docker/db/sql/app/02_report_meters.sql) through GET /api/meter-stats.

describe('GET /api/meter-stats (v_meter_stats)', () => {
  let ctx: IntegrationContext;

  beforeAll(async () => {
    ctx = await createIntegrationApp();
  });

  afterAll(async () => {
    await ctx?.app.close();
  });

  beforeEach(async () => {
    await resetTables(ctx.prisma);
  });

  it('returns first/last value and date and the number of readings per meter', async () => {
    const types = await createMeterTypes(ctx.prisma, ['gas', 'water']);
    // Inserted out of chronological order, so id order differs from time order.
    const gasA = await createMeter(ctx.prisma, types.gas, 'gas A', [
      ['2024-02-01T00:00:00.000Z', 20],
      ['2024-01-01T08:30:00.000Z', 10],
      ['2024-03-01T00:00:00.000Z', 35],
    ]);
    const gasB = await createMeter(ctx.prisma, types.gas, 'gas B', [['2024-04-01T00:00:00.000Z', 5]]);
    const waterEmpty = await createMeter(ctx.prisma, types.water, 'water empty');
    const gasEmpty = await createMeter(ctx.prisma, types.gas, 'gas empty');

    const res = await ctx.app.inject({ method: 'GET', url: '/api/meter-stats' });

    expect(res.statusCode).toBe(200);
    const noReadings = {
      firstValue: null,
      firstValueDate: null,
      lastValue: null,
      lastValueDate: null,
      totalValues: 0,
    };
    expect(res.json()).toEqual([
      {
        id: gasA.meterId,
        name: 'gas A',
        meterTypeId: types.gas,
        firstValue: 10,
        firstValueDate: '2024-01-01T08:30:00.000Z',
        lastValue: 35,
        lastValueDate: '2024-03-01T00:00:00.000Z',
        totalValues: 3,
      },
      {
        id: gasB.meterId,
        name: 'gas B',
        meterTypeId: types.gas,
        firstValue: 5,
        firstValueDate: '2024-04-01T00:00:00.000Z',
        lastValue: 5,
        lastValueDate: '2024-04-01T00:00:00.000Z',
        totalValues: 1,
      },
      // Meters without readings still get exactly one row each.
      { id: waterEmpty.meterId, name: 'water empty', meterTypeId: types.water, ...noReadings },
      { id: gasEmpty.meterId, name: 'gas empty', meterTypeId: types.gas, ...noReadings },
    ]);
  });

  it('returns an empty list when there are no meters', async () => {
    const res = await ctx.app.inject({ method: 'GET', url: '/api/meter-stats' });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
  });
});
