import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  createIntegrationApp,
  createMeter,
  createMeterTypes,
  resetTables,
  type IntegrationContext,
} from '../../test/integration/app';

// Exercises v_value_stats (docker/db/sql/app/03_report_values.sql) through GET /api/reports/:meterTypeId.
// All expected numbers are worked out by hand from the fixtures:
//   value      = running sum per meter type of (reading - previous reading of the same meter),
//                where a meter's first reading contributes 0 (so the first row has value 0)
//   date_diff  = whole days since the previous row of the meter type (0 for the first row)
//   delta      = value - previous value (null for the first row)
//   delta_year = delta / date_diff * 365, or null when date_diff is 0 (the row closes no interval)
//   averages   = mean of the last 4 (delta_last4_avg) or 52 (delta_year_avg) delta_year values,
//                counted in intervals, not rows; a row without an interval repeats the row before
// Rows are ordered by timestamp; at a meter change the old meter's final reading comes before
// the new meter's first reading at the same timestamp.

type ReportRowJson = {
  id: number;
  timestamp: string;
  meterId: number | null;
  meterTypeId: number | null;
  rawValue: number | null;
  value: number | null;
  dateDiff: number | null;
  delta: number | null;
  deltaYear: number | null;
  deltaLast4Avg: number | null;
  deltaYearAvg: number | null;
};

type Column = keyof ReportRowJson;

const approx = (n: number | null) => (n === null ? null : expect.closeTo(n, 6));

function column(rows: ReportRowJson[], key: Column) {
  return rows.map((row) => row[key]);
}

function expectColumn(rows: ReportRowJson[], key: Column, expected: (number | null)[]) {
  expect(column(rows, key), key).toEqual(expected.map(approx));
}

// Gas readings, 7 rows at UTC midnight. Day gaps: 10, 10, 20, 5, 30, 10.
const GAS_SERIES = [
  ['2024-01-01T00:00:00.000Z', 100],
  ['2024-01-11T00:00:00.000Z', 110],
  ['2024-01-21T00:00:00.000Z', 130],
  ['2024-02-10T00:00:00.000Z', 150],
  ['2024-02-15T00:00:00.000Z', 160],
  ['2024-03-16T00:00:00.000Z', 220], // 2024 is a leap year: Feb 15 -> Mar 16 = 30 days
  ['2024-03-26T00:00:00.000Z', 230],
] as const;

describe('GET /api/reports/:meterTypeId (v_value_stats)', () => {
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

  async function report(meterTypeId: number, query = ''): Promise<ReportRowJson[]> {
    const res = await ctx.app.inject({ method: 'GET', url: `/api/reports/${meterTypeId}${query}` });
    expect(res.statusCode).toBe(200);
    return res.json<ReportRowJson[]>();
  }

  async function seedGasSeries() {
    const types = await createMeterTypes(ctx.prisma, ['gas', 'water']);
    const gas = await createMeter(ctx.prisma, types.gas, 'gas 1', GAS_SERIES);
    // Water readings interleaved in time with the gas readings; they must not affect the gas report.
    await createMeter(ctx.prisma, types.water, 'water 1', [
      ['2024-01-05T00:00:00.000Z', 5],
      ['2024-02-01T00:00:00.000Z', 9],
      ['2024-03-20T00:00:00.000Z', 20],
    ]);
    return { types, gas };
  }

  it('computes value, date_diff, delta and delta_year between consecutive readings', async () => {
    const { types, gas } = await seedGasSeries();

    const rows = await report(types.gas);

    expect(column(rows, 'id')).toEqual(gas.valueIds);
    expect(column(rows, 'timestamp')).toEqual(GAS_SERIES.map(([timestamp]) => timestamp));
    expect(new Set(column(rows, 'meterId'))).toEqual(new Set([gas.meterId]));
    expectColumn(rows, 'rawValue', [100, 110, 130, 150, 160, 220, 230]);
    // Differences between readings: +10, +20, +20, +10, +60, +10; the first reading starts at 0.
    expectColumn(rows, 'value', [0, 10, 30, 50, 60, 120, 130]);
    expectColumn(rows, 'dateDiff', [0, 10, 10, 20, 5, 30, 10]);
    expectColumn(rows, 'delta', [null, 10, 20, 20, 10, 60, 10]);
    // row 1 has date_diff 0 -> null; then 10/10*365, 20/10*365, 20/20*365, 10/5*365, 60/30*365, 10/10*365
    expectColumn(rows, 'deltaYear', [null, 365, 730, 365, 730, 730, 365]);
  });

  it('computes the rolling averages over the last 4 and 52 intervals of delta_year', async () => {
    const { types } = await seedGasSeries();

    const rows = await report(types.gas);

    // delta_year per row: [null, 365, 730, 365, 730, 730, 365]; the first row closes no interval.
    expectColumn(rows, 'deltaLast4Avg', [
      null, // no interval yet
      365, // [365]
      1095 / 2, // [365, 730]
      1460 / 3, // [365, 730, 365]
      2190 / 4, // [365, 730, 365, 730]
      2555 / 4, // [730, 365, 730, 730]
      2190 / 4, // [365, 730, 730, 365]
    ]);
    // Fewer than 52 intervals, so delta_year_avg is the running average of all intervals so far
    // (running sums 365, 1095, 1460, 2190, 2920, 3285).
    expectColumn(rows, 'deltaYearAvg', [null, 365, 1095 / 2, 1460 / 3, 2190 / 4, 2920 / 5, 3285 / 6]);
  });

  it('limits delta_year_avg to the last 52 intervals', async () => {
    const types = await createMeterTypes(ctx.prisma, ['gas']);
    // 57 weekly readings; interval k (k = 1..56) consumes k units, so its delta_year is k/7*365.
    const readings = Array.from({ length: 57 }, (_, i) => [
      new Date(Date.UTC(2024, 0, 1 + 7 * i)).toISOString(),
      1000 + (i * (i + 1)) / 2,
    ] as const);
    await createMeter(ctx.prisma, types.gas, 'gas 1', readings);

    const rows = await report(types.gas);

    const perYear = (k: number) => (k / 7) * 365;
    // Intervals 1..52 (mean 26.5), then the window moves on: 2..53 (27.5) ... 5..56 (30.5).
    expectColumn(rows.slice(52), 'deltaYearAvg', [26.5, 27.5, 28.5, 29.5, 30.5].map(perYear));
    // The last 4 intervals of the final row: 53..56 (mean 54.5).
    expectColumn(rows.slice(-1), 'deltaLast4Avg', [perYear(54.5)]);
  });

  it('computes window columns over the full series when filtering by from/to', async () => {
    const { types, gas } = await seedGasSeries();

    const rows = await report(types.gas, '?from=2024-02-01T00:00:00.000Z&to=2024-03-20T00:00:00.000Z');

    expect(column(rows, 'id')).toEqual(gas.valueIds.slice(3, 6));
    // The first returned row is still compared with the (filtered out) reading of 2024-01-21.
    expectColumn(rows, 'dateDiff', [20, 5, 30]);
    expectColumn(rows, 'delta', [20, 10, 60]);
    // Rows 4-6 of the full series: [365, 730, 365], [365, 730, 365, 730], [730, 365, 730, 730].
    expectColumn(rows, 'deltaLast4Avg', [1460 / 3, 2190 / 4, 2555 / 4]);
  });

  it('returns delta_year null instead of dividing by zero when readings are less than a day apart', async () => {
    const types = await createMeterTypes(ctx.prisma, ['gas']);
    await createMeter(ctx.prisma, types.gas, 'gas 1', [
      ['2024-01-01T00:00:00.000Z', 100],
      ['2024-01-11T00:00:00.000Z', 110],
      ['2024-01-21T06:00:00.000Z', 130], // 10 days 6 hours after the previous reading
      // 21 hours later: the next day (one reading per meter and day), but less than a full day
      ['2024-01-22T03:00:00.000Z', 133],
    ]);

    const rows = await report(types.gas);

    expectColumn(rows, 'value', [0, 10, 30, 33]);
    // date_diff counts whole days only (extract(DAY FROM interval)).
    expectColumn(rows, 'dateDiff', [0, 10, 10, 0]);
    expectColumn(rows, 'delta', [null, 10, 20, 3]);
    expectColumn(rows, 'deltaYear', [null, 365, 730, null]); // 10/10*365, 20/10*365, then date_diff 0
    // The last row closes no interval and repeats the averages of the row before it.
    expectColumn(rows, 'deltaLast4Avg', [null, 365, 1095 / 2, 1095 / 2]);
  });

  it('counts the first interval of a meter type in delta, delta_year and the averages', async () => {
    const types = await createMeterTypes(ctx.prisma, ['gas']);
    await createMeter(ctx.prisma, types.gas, 'gas 1', [
      ['2024-01-01T00:00:00.000Z', 100],
      ['2024-01-11T00:00:00.000Z', 110],
    ]);

    const rows = await report(types.gas);

    // The normalized series starts at 0, so the 10 units consumed between the two readings
    // show up as the delta of the second row (they were lost while value started at null).
    expectColumn(rows, 'value', [0, 10]);
    expectColumn(rows, 'dateDiff', [0, 10]);
    expectColumn(rows, 'delta', [null, 10]);
    expectColumn(rows, 'deltaYear', [null, 365]); // 10/10*365
    // The averages count only that interval, not a 0 for the first row.
    expectColumn(rows, 'deltaLast4Avg', [null, 365]);
    expectColumn(rows, 'deltaYearAvg', [null, 365]);
  });

  // Duplicated readings of one meter on the same day can't exist anymore (unique index from
  // 04_unique_value_per_day.sql, see values/one-value-per-day.int-spec.ts). The view keeps the
  // value id as the last ordering key as a safeguard.

  describe('meter change', () => {
    // The old electricity meter is replaced on 2024-03-01: its final reading and the new meter's
    // first reading share that timestamp. Day gaps: 30 (Jan 1 -> Jan 31), 30 (Jan 31 -> Mar 1,
    // 2024 is a leap year), 0 (the meter change itself), 30, 30.
    const CHANGE_DATE = '2024-03-01T00:00:00.000Z';
    const OLD_METER_READINGS = [
      ['2024-01-01T00:00:00.000Z', 1000],
      ['2024-01-31T00:00:00.000Z', 1300],
      [CHANGE_DATE, 1450], // final reading of the old meter ...
    ] as const;
    const NEW_METER_READINGS = [
      [CHANGE_DATE, 2], // ... and first reading of the new meter at the same timestamp
      ['2024-03-31T00:00:00.000Z', 302],
      ['2024-04-30T00:00:00.000Z', 602],
    ] as const;

    function expectMeterChangeReport(
      rows: ReportRowJson[],
      oldMeter: { meterId: number; valueIds: number[] },
      newMeter: { meterId: number; valueIds: number[] },
    ) {
      // Exact order: the old meter's final reading comes before the new meter's first reading.
      expect(column(rows, 'id')).toEqual([...oldMeter.valueIds, ...newMeter.valueIds]);
      expect(column(rows, 'meterId')).toEqual([
        oldMeter.meterId,
        oldMeter.meterId,
        oldMeter.meterId,
        newMeter.meterId,
        newMeter.meterId,
        newMeter.meterId,
      ]);
      expect(column(rows, 'timestamp')).toEqual(
        [...OLD_METER_READINGS, ...NEW_METER_READINGS].map(([timestamp]) => timestamp),
      );
      expectColumn(rows, 'rawValue', [1000, 1300, 1450, 2, 302, 602]);
      // Old meter: starts at 0, then +300, +150. New meter: its first reading adds 0 (no jump
      // in the normalized series), then +300, +300.
      expectColumn(rows, 'value', [0, 300, 450, 450, 750, 1050]);
      // The old meter's final reading carries the 30 days and its remaining 150 units;
      // the new meter's first reading follows 0 days later with delta 0.
      expectColumn(rows, 'dateDiff', [0, 30, 30, 0, 30, 30]);
      expectColumn(rows, 'delta', [null, 300, 150, 0, 300, 300]);
      // 300/30*365 = 3650, 150/30*365 = 1825; date_diff 0 -> null
      expectColumn(rows, 'deltaYear', [null, 3650, 1825, null, 3650, 3650]);
      expectColumn(rows, 'deltaLast4Avg', [
        null, // no interval yet
        3650, // [3650]
        5475 / 2, // [3650, 1825]
        5475 / 2, // the meter change closes no interval: same as the row before
        9125 / 3, // [3650, 1825, 3650]
        12775 / 4, // [3650, 1825, 3650, 3650]: 4 intervals, although they span 5 rows
      ]);
      // Running sums of delta_year: 3650, 5475, 5475, 9125, 12775 over 1, 2, 2, 3, 4 intervals.
      expectColumn(rows, 'deltaYearAvg', [null, 3650, 5475 / 2, 5475 / 2, 9125 / 3, 12775 / 4]);
    }

    it('normalizes values across a meter change into one continuous series', async () => {
      const types = await createMeterTypes(ctx.prisma, ['electricity']);
      const oldMeter = await createMeter(ctx.prisma, types.electricity, 'electricity old', OLD_METER_READINGS);
      const newMeter = await createMeter(ctx.prisma, types.electricity, 'electricity new', NEW_METER_READINGS);

      expectMeterChangeReport(await report(types.electricity), oldMeter, newMeter);
    });

    it('orders the readings at the meter change the same way when the new meter is inserted first', async () => {
      const types = await createMeterTypes(ctx.prisma, ['electricity']);
      // The new meter and all of its readings are created first, so at the shared timestamp the
      // new meter's reading has the lower value id, the lower meter id and the earlier physical
      // row position. None of that may decide the order: the old meter started earlier.
      const newMeter = await createMeter(ctx.prisma, types.electricity, 'electricity new', NEW_METER_READINGS);
      const oldMeter = await createMeter(ctx.prisma, types.electricity, 'electricity old', OLD_METER_READINGS);
      expect(newMeter.meterId).toBeLessThan(oldMeter.meterId);
      expect(newMeter.valueIds[0]).toBeLessThan(oldMeter.valueIds[2]);

      expectMeterChangeReport(await report(types.electricity), oldMeter, newMeter);
    });

    // Gas changes meters on the same day as electricity:
    // old 100 -> 160 -> 190, new 5 -> 65 -> 125, i.e. +60, +30, then 0, +60, +60.
    const GAS_OLD_METER_READINGS = [
      ['2024-01-01T00:00:00.000Z', 100],
      ['2024-01-31T00:00:00.000Z', 160],
      [CHANGE_DATE, 190],
    ] as const;
    const GAS_NEW_METER_READINGS = [
      [CHANGE_DATE, 5],
      ['2024-03-31T00:00:00.000Z', 65],
      ['2024-04-30T00:00:00.000Z', 125],
    ] as const;

    it.each([
      ['the old meters', false],
      ['the new meters', true],
    ])(
      'computes the same result per row with and without a meter type filter (%s inserted first)',
      async (_label, newMetersFirst) => {
        const types = await createMeterTypes(ctx.prisma, ['electricity', 'gas']);
        const meters: Record<string, { meterId: number; valueIds: number[] }> = {};
        const inserts = [
          ['electricityOld', types.electricity, OLD_METER_READINGS],
          ['gasOld', types.gas, GAS_OLD_METER_READINGS],
          ['electricityNew', types.electricity, NEW_METER_READINGS],
          ['gasNew', types.gas, GAS_NEW_METER_READINGS],
        ] as const;
        for (const [name, meterTypeId, readings] of newMetersFirst ? [...inserts].reverse() : inserts) {
          meters[name] = await createMeter(ctx.prisma, meterTypeId, name, readings);
        }

        expectMeterChangeReport(await report(types.electricity), meters.electricityOld, meters.electricityNew);
        const gasRows = await report(types.gas);
        expect(column(gasRows, 'id')).toEqual([...meters.gasOld.valueIds, ...meters.gasNew.valueIds]);
        expectColumn(gasRows, 'value', [0, 60, 90, 90, 150, 210]);
        expectColumn(gasRows, 'dateDiff', [0, 30, 30, 0, 30, 30]);
        expectColumn(gasRows, 'delta', [null, 60, 30, 0, 60, 60]);
        expectColumn(gasRows, 'deltaYear', [null, 730, 365, null, 730, 730]); // 60/30*365, 30/30*365

        // Queried without a meter type filter, PostgreSQL plans the view differently (the window
        // input is re-sorted per meter type instead of arriving presorted). The rows at the meter
        // change must still get the same values: the old meter's final reading carries the interval.
        const atChange = await ctx.prisma.$queryRaw<
          { id: number; dateDiff: number; delta: number; deltaYear: number | null }[]
        >`
          SELECT id, date_diff AS "dateDiff", delta, delta_year AS "deltaYear"
          FROM v_value_stats
          WHERE "timestamp" = ${new Date(CHANGE_DATE)}
          ORDER BY meter_type_id, meter_first_date, id
        `;
        expect(atChange).toEqual([
          { id: meters.electricityOld.valueIds[2], dateDiff: 30, delta: 150, deltaYear: 1825 },
          { id: meters.electricityNew.valueIds[0], dateDiff: 0, delta: 0, deltaYear: null },
          { id: meters.gasOld.valueIds[2], dateDiff: 30, delta: 30, deltaYear: 365 },
          { id: meters.gasNew.valueIds[0], dateDiff: 0, delta: 0, deltaYear: null },
        ]);
      },
    );
  });

  it('only includes readings of the requested meter type', async () => {
    const types = await createMeterTypes(ctx.prisma, ['gas', 'water', 'electricity']);
    const gas = await createMeter(ctx.prisma, types.gas, 'gas 1', [
      ['2024-01-01T00:00:00.000Z', 100],
      ['2024-01-11T00:00:00.000Z', 110],
      ['2024-01-21T00:00:00.000Z', 130],
    ]);
    const water = await createMeter(ctx.prisma, types.water, 'water 1', [
      ['2024-01-06T00:00:00.000Z', 5],
      ['2024-01-16T00:00:00.000Z', 8],
      ['2024-01-26T00:00:00.000Z', 15],
    ]);

    const gasRows = await report(types.gas);
    const waterRows = await report(types.water);
    const electricityRows = await report(types.electricity);

    expect(column(gasRows, 'id')).toEqual(gas.valueIds);
    expect(new Set(column(gasRows, 'meterTypeId'))).toEqual(new Set([types.gas]));
    expectColumn(gasRows, 'value', [0, 10, 30]);
    expectColumn(gasRows, 'dateDiff', [0, 10, 10]);
    expectColumn(gasRows, 'deltaYear', [null, 365, 730]); // 10/10*365, 20/10*365

    expect(column(waterRows, 'id')).toEqual(water.valueIds);
    expect(new Set(column(waterRows, 'meterTypeId'))).toEqual(new Set([types.water]));
    expectColumn(waterRows, 'value', [0, 3, 10]);
    expectColumn(waterRows, 'dateDiff', [0, 10, 10]);
    expectColumn(waterRows, 'deltaYear', [null, 109.5, 255.5]); // 3/10*365, 7/10*365

    expect(electricityRows).toEqual([]);
  });
});
