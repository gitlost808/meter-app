import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { createApp, effectScope, ref, type EffectScope } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { listReportRows, type ReportRow } from '@/api/reports';
import {
  isMeterChangePossible,
  resolveValueEntrySelection,
  selectLatestReportRow,
  selectValueEntryHistory,
  selectValueEntryRowsForDay,
} from '@/features/value-entry/selection';
import {
  useReportRowsByMeterTypesQuery,
  useValueEntryReportState,
} from './useValueEntryReports';

vi.mock('@/api/reports', () => ({
  listReportRows: vi.fn(),
}));

// Local midnight, so day comparisons don't depend on the test machine's timezone.
function day(dayOfMonth: number): Date {
  return new Date(2026, 9, dayOfMonth);
}

function createReportRow(overrides: Partial<ReportRow> = {}): ReportRow {
  return {
    id: 1,
    timestamp: day(15),
    meterId: 10,
    meterTypeId: 1,
    rawValue: 100,
    value: 100,
    dateDiff: null,
    delta: null,
    deltaYear: null,
    deltaLast4Avg: null,
    deltaYearAvg: null,
    ...overrides,
  };
}

// Ordered by timestamp, like the API returns them.
const GAS_ROWS: ReportRow[] = [
  createReportRow({ id: 1, timestamp: day(1), value: 100 }),
  createReportRow({ id: 2, timestamp: day(3), value: 110 }),
  createReportRow({ id: 3, timestamp: day(5), value: 120 }),
  createReportRow({ id: 4, timestamp: day(10), value: 130 }),
  // meter change: final reading of the old meter and first reading of the new one
  createReportRow({ id: 5, timestamp: day(15), meterId: 10, value: 140 }),
  createReportRow({ id: 6, timestamp: day(15), meterId: 11, rawValue: 2, value: 142 }),
];

const WATER_ROWS: ReportRow[] = [
  createReportRow({ id: 20, meterTypeId: 2, meterId: 30, timestamp: day(2), value: 7 }),
];

const ROWS_BY_METER_TYPE: Record<number, ReportRow[]> = { 1: GAS_ROWS, 2: WATER_ROWS };

let scope: EffectScope | undefined;

function createContext() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const app = createApp({ render: () => null });
  app.use(VueQueryPlugin, { queryClient });
  scope = effectScope();

  return {
    queryClient,
    run: <T>(fn: () => T): T => app.runWithContext(() => scope!.run(fn)!),
  };
}

beforeEach(() => {
  vi.mocked(listReportRows).mockReset().mockImplementation(async (meterTypeId) => {
    return ROWS_BY_METER_TYPE[meterTypeId] ?? [];
  });
});

afterEach(() => {
  scope?.stop();
});

describe('useReportRowsByMeterTypesQuery', () => {
  it('loads every meter type under its own key and concatenates the rows', async () => {
    const { queryClient, run } = createContext();
    const result = run(() => useReportRowsByMeterTypesQuery([1, 2]));

    await vi.waitFor(() => expect(result.isPending.value).toBe(false));

    expect(result.data.value).toEqual([...GAS_ROWS, ...WATER_ROWS]);
    expect(listReportRows).toHaveBeenCalledTimes(2);
    expect(listReportRows).toHaveBeenCalledWith(1);
    expect(listReportRows).toHaveBeenCalledWith(2);
    expect(queryClient.getQueryData(['reports', 1])).toEqual(GAS_ROWS);
    expect(queryClient.getQueryData(['reports', 2])).toEqual(WATER_ROWS);
  });

  it('stays pending until every meter type has loaded', async () => {
    let resolveWater!: (rows: ReportRow[]) => void;
    vi.mocked(listReportRows).mockImplementation((meterTypeId) => {
      if (meterTypeId === 2) {
        return new Promise((resolve) => {
          resolveWater = resolve;
        });
      }
      return Promise.resolve(GAS_ROWS);
    });
    const { run } = createContext();
    const result = run(() => useReportRowsByMeterTypesQuery([1, 2]));

    await vi.waitFor(() => expect(result.data.value).toEqual(GAS_ROWS));
    expect(result.isPending.value).toBe(true);

    resolveWater(WATER_ROWS);

    await vi.waitFor(() => expect(result.isPending.value).toBe(false));
    expect(result.data.value).toEqual([...GAS_ROWS, ...WATER_ROWS]);
  });

  it('follows changes of the meter type list', async () => {
    const { run } = createContext();
    const meterTypeIds = ref([1]);
    const result = run(() => useReportRowsByMeterTypesQuery(meterTypeIds));
    await vi.waitFor(() => expect(result.data.value).toEqual(GAS_ROWS));

    meterTypeIds.value = [1, 2];

    await vi.waitFor(() => expect(result.data.value).toEqual([...GAS_ROWS, ...WATER_ROWS]));
    // meter type 1 is served from the cache
    expect(listReportRows).toHaveBeenCalledTimes(2);
    expect(listReportRows).toHaveBeenLastCalledWith(2);
  });

  it('is empty and not pending without meter types', async () => {
    const { run } = createContext();
    const result = run(() => useReportRowsByMeterTypesQuery(() => []));

    expect(result.data.value).toEqual([]);
    expect(result.isPending.value).toBe(false);
    expect(listReportRows).not.toHaveBeenCalled();
  });
});

describe('useValueEntryReportState', () => {
  function setup(initialMeterTypeId: number, initialDate: Date) {
    const context = createContext();
    const meterTypeId = ref(initialMeterTypeId);
    const selectedDate = ref(initialDate);
    const state = context.run(() => useValueEntryReportState(meterTypeId, selectedDate));

    return { ...context, meterTypeId, selectedDate, state };
  }

  function expectStateFor(state: ReturnType<typeof useValueEntryReportState>, rows: ReportRow[], date: Date) {
    const selectedRows = selectValueEntryRowsForDay(rows, date);

    expect(state.reportRows.value).toEqual(rows);
    expect(state.selectedRows.value).toEqual(selectedRows);
    expect(state.selection.value).toEqual(resolveValueEntrySelection(selectedRows));
    expect(state.historyRows.value).toEqual(selectValueEntryHistory(rows, date));
    expect(state.latestReportRow.value).toEqual(selectLatestReportRow(rows));
    expect(state.meterChangeAllowed.value).toBe(isMeterChangePossible(rows, date));
  }

  it('starts with an empty state while the report rows load', () => {
    const { state } = setup(1, day(15));

    expect(state.reportRows.value).toEqual([]);
    expect(state.selectedRows.value).toEqual([]);
    expect(state.selection.value).toEqual({
      selectedValue: undefined,
      selectedNewMeterValue: undefined,
      newMeter: false,
    });
    expect(state.historyRows.value).toEqual([]);
    expect(state.latestReportRow.value).toBeUndefined();
    expect(state.meterChangeAllowed.value).toBe(true);
  });

  it('loads the rows of the meter type under its reports key', async () => {
    const { state, queryClient } = setup(1, day(15));

    await vi.waitFor(() => expect(state.reportRows.value).toEqual(GAS_ROWS));

    expect(listReportRows).toHaveBeenCalledExactlyOnceWith(1);
    expect(queryClient.getQueryData(['reports', 1])).toEqual(GAS_ROWS);
  });

  it('derives a meter change on the latest day', async () => {
    const { state } = setup(1, day(15));

    await vi.waitFor(() => expect(state.reportRows.value).toEqual(GAS_ROWS));

    expectStateFor(state, GAS_ROWS, day(15));
    expect(state.selectedRows.value.map((row) => row.id)).toEqual([5, 6]);
    expect(state.selection.value).toEqual({
      selectedValue: GAS_ROWS[4],
      selectedNewMeterValue: GAS_ROWS[5],
      newMeter: true,
    });
    expect(state.historyRows.value.map((row) => row.id)).toEqual([2, 3, 4]);
    expect(state.latestReportRow.value).toEqual(GAS_ROWS[5]);
    expect(state.meterChangeAllowed.value).toBe(true);
  });

  it('recomputes when the selected date changes', async () => {
    const { state, selectedDate } = setup(1, day(15));
    await vi.waitFor(() => expect(state.reportRows.value).toEqual(GAS_ROWS));

    selectedDate.value = day(5);

    expectStateFor(state, GAS_ROWS, day(5));
    expect(state.selection.value).toEqual({
      selectedValue: GAS_ROWS[2],
      selectedNewMeterValue: undefined,
      newMeter: false,
    });
    expect(state.historyRows.value.map((row) => row.id)).toEqual([1, 2]);
    expect(state.meterChangeAllowed.value).toBe(false);

    selectedDate.value = day(20);

    expectStateFor(state, GAS_ROWS, day(20));
    expect(state.selectedRows.value).toEqual([]);
    expect(state.historyRows.value.map((row) => row.id)).toEqual([4, 5, 6]);
    expect(state.meterChangeAllowed.value).toBe(true);
    expect(listReportRows).toHaveBeenCalledOnce();
  });

  it('switches to the rows of another meter type', async () => {
    const { state, meterTypeId, queryClient } = setup(1, day(2));
    await vi.waitFor(() => expect(state.reportRows.value).toEqual(GAS_ROWS));

    meterTypeId.value = 2;

    await vi.waitFor(() => expect(state.reportRows.value).toEqual(WATER_ROWS));
    expect(listReportRows).toHaveBeenLastCalledWith(2);
    expect(queryClient.getQueryData(['reports', 2])).toEqual(WATER_ROWS);
    expectStateFor(state, WATER_ROWS, day(2));
    expect(state.selection.value.selectedValue).toEqual(WATER_ROWS[0]);
  });
});
