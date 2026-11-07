import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  createIntegrationApp,
  createMeter,
  createMeterTypes,
  resetTables,
  type IntegrationContext,
} from '../../test/integration/app';

// POST /api/value-entries writes all entries of one request in a single transaction:
// any failing check must roll back every earlier write of the same request.

const EXISTING_DATE = '2024-05-01T00:00:00.000Z';
const ENTRY_DATE = '2024-06-01T00:00:00.000Z';

describe('POST /api/value-entries (transaction)', () => {
  let ctx: IntegrationContext;
  let fx: {
    types: { gas: number; electricity: number; water: number };
    gasMeterId: number;
    gasValueId: number;
    electricityMeterId: number;
    waterMeterId: number;
    waterValueId: number;
  };

  beforeAll(async () => {
    ctx = await createIntegrationApp();
  });

  afterAll(async () => {
    await ctx?.app.close();
  });

  beforeEach(async () => {
    await resetTables(ctx.prisma);
    const types = await createMeterTypes(ctx.prisma, ['gas', 'electricity', 'water']);
    const gas = await createMeter(ctx.prisma, types.gas, 'gas', [[EXISTING_DATE, 100]]);
    const electricity = await createMeter(ctx.prisma, types.electricity, 'electricity', [[EXISTING_DATE, 4000]]);
    const water = await createMeter(ctx.prisma, types.water, 'water', [[EXISTING_DATE, 50]]);
    fx = {
      types,
      gasMeterId: gas.meterId,
      gasValueId: gas.valueIds[0],
      electricityMeterId: electricity.meterId,
      waterMeterId: water.meterId,
      waterValueId: water.valueIds[0],
    };
  });

  function post(body: unknown) {
    return ctx.app.inject({ method: 'POST', url: '/api/value-entries', payload: body as object });
  }

  async function snapshot() {
    return {
      meters: await ctx.prisma.meter.findMany({ orderBy: { id: 'asc' } }),
      values: await ctx.prisma.value.findMany({ orderBy: { id: 'asc' } }),
    };
  }

  it('stores all entries, including a meter change, with the same timestamp', async () => {
    const res = await post({
      timestamp: ENTRY_DATE,
      entries: [
        { meterTypeId: fx.types.gas, value: { kind: 'create', meterId: fx.gasMeterId, value: 123.5 } },
        {
          meterTypeId: fx.types.electricity,
          value: { kind: 'create', meterId: fx.electricityMeterId, value: 4321 },
          newMeter: { kind: 'create', meterName: 'electricity 2024-06-01', value: 0.5 },
        },
        { meterTypeId: fx.types.water, value: { kind: 'update', valueId: fx.waterValueId, value: 55 } },
      ],
    });

    expect(res.statusCode).toBe(204);
    expect(res.body).toBe('');

    const newMeters = await ctx.prisma.meter.findMany({ where: { name: 'electricity 2024-06-01' } });
    expect(newMeters).toEqual([
      { id: expect.any(Number), name: 'electricity 2024-06-01', meterTypeId: fx.types.electricity },
    ]);
    const newMeterId = newMeters[0].id;

    const created = await ctx.prisma.value.findMany({
      where: { timestamp: new Date(ENTRY_DATE) },
      orderBy: { id: 'asc' },
    });
    expect(created.map(({ meterId, value, timestamp }) => ({ meterId, value, timestamp }))).toEqual([
      { meterId: fx.gasMeterId, value: 123.5, timestamp: new Date(ENTRY_DATE) },
      { meterId: fx.electricityMeterId, value: 4321, timestamp: new Date(ENTRY_DATE) },
      { meterId: newMeterId, value: 0.5, timestamp: new Date(ENTRY_DATE) },
    ]);

    // The update changes only the value, not the timestamp of the existing reading.
    expect(await ctx.prisma.value.findUnique({ where: { id: fx.waterValueId } })).toEqual({
      id: fx.waterValueId,
      meterId: fx.waterMeterId,
      value: 55,
      timestamp: new Date(EXISTING_DATE),
    });
    expect(await ctx.prisma.meter.count()).toBe(4);
    expect(await ctx.prisma.value.count()).toBe(6);
  });

  it('rolls back all earlier writes when a later entry references a missing value (404)', async () => {
    const before = await snapshot();

    const res = await post({
      timestamp: ENTRY_DATE,
      entries: [
        { meterTypeId: fx.types.gas, value: { kind: 'update', valueId: fx.gasValueId, value: 999 } },
        {
          meterTypeId: fx.types.electricity,
          value: { kind: 'create', meterId: fx.electricityMeterId, value: 4321 },
          newMeter: { kind: 'create', meterName: 'electricity rollback', value: 0.5 },
        },
        { meterTypeId: fx.types.water, value: { kind: 'update', valueId: 999_999, value: 1 } },
      ],
    });

    expect(res.statusCode).toBe(404);
    expect(res.json()).toMatchObject({ message: 'Value 999999 not found' });
    // No updated gas value, no electricity readings and no new meter from this request.
    expect(await snapshot()).toEqual(before);
    expect(await ctx.prisma.meter.findMany({ where: { name: 'electricity rollback' } })).toEqual([]);
  });

  it('rolls back all earlier writes when a later entry uses a meter of another type (400)', async () => {
    const before = await snapshot();

    const res = await post({
      timestamp: ENTRY_DATE,
      entries: [
        {
          meterTypeId: fx.types.electricity,
          value: { kind: 'create', meterId: fx.electricityMeterId, value: 4321 },
          newMeter: { kind: 'create', meterName: 'electricity rollback', value: 0.5 },
        },
        { meterTypeId: fx.types.gas, value: { kind: 'create', meterId: fx.waterMeterId, value: 1 } },
      ],
    });

    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({
      message: `Meter ${fx.waterMeterId} does not belong to meter type ${fx.types.gas}`,
    });
    expect(await snapshot()).toEqual(before);
    expect(await ctx.prisma.meter.findMany({ where: { name: 'electricity rollback' } })).toEqual([]);
  });

  it.each([
    {
      case: 'an unknown property in a later entry',
      entries: () => [
        { meterTypeId: fx.types.gas, value: { kind: 'create', meterId: fx.gasMeterId, value: 1 } },
        { meterTypeId: fx.types.water, value: { kind: 'update', valueId: fx.waterValueId }, extra: true },
      ],
    },
    {
      case: 'a meter change without a meter name',
      entries: () => [
        { meterTypeId: fx.types.gas, value: { kind: 'create', meterId: fx.gasMeterId, value: 1 } },
        { meterTypeId: fx.types.electricity, newMeter: { kind: 'create', value: 0.5 } },
      ],
    },
    {
      case: 'the same meter type twice',
      entries: () => [
        { meterTypeId: fx.types.gas, value: { kind: 'create', meterId: fx.gasMeterId, value: 1 } },
        { meterTypeId: fx.types.gas, value: { kind: 'create', meterId: fx.gasMeterId, value: 2 } },
      ],
    },
  ])('rejects $case with 400 and writes nothing', async ({ entries }) => {
    const before = await snapshot();

    const res = await post({ timestamp: ENTRY_DATE, entries: entries() });

    expect(res.statusCode).toBe(400);
    expect(await snapshot()).toEqual(before);
  });
});
