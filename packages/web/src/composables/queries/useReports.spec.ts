import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { createApp, effectScope, nextTick, ref, type EffectScope } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { listReportRows, type ReportRow } from '@/api/reports';
import { useReportRowsQuery } from './useReports';

vi.mock('@/api/reports', () => ({
  listReportRows: vi.fn(),
}));

function createReportRow(overrides: Partial<ReportRow> = {}): ReportRow {
  return {
    id: 1,
    timestamp: new Date(2026, 9, 15),
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

let scope: EffectScope | undefined;

function setup(initialMeterTypeId: number | null) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const app = createApp({ render: () => null });
  app.use(VueQueryPlugin, { queryClient });
  const meterTypeId = ref<number | null>(initialMeterTypeId);

  scope = effectScope();
  const query = app.runWithContext(() => scope!.run(() => useReportRowsQuery(meterTypeId))!);

  return { queryClient, meterTypeId, query };
}

describe('useReportRowsQuery', () => {
  beforeEach(() => {
    vi.mocked(listReportRows).mockReset().mockImplementation(async (meterTypeId) => [
      createReportRow({ id: meterTypeId * 100, meterTypeId }),
    ]);
  });

  afterEach(() => {
    scope?.stop();
  });

  it('loads the report rows of the meter type under its reports key', async () => {
    const { query, queryClient } = setup(1);
    const expected = [createReportRow({ id: 100, meterTypeId: 1 })];

    await vi.waitFor(() => expect(query.data.value).toEqual(expected));

    expect(listReportRows).toHaveBeenCalledExactlyOnceWith(1);
    expect(queryClient.getQueryData(['reports', 1])).toEqual(expected);
  });

  it('does not fetch while no meter type is selected', async () => {
    const { query } = setup(null);

    await nextTick();

    expect(listReportRows).not.toHaveBeenCalled();
    expect(query.fetchStatus.value).toBe('idle');
    expect(query.data.value).toBeUndefined();
  });

  it('fetches once a meter type is selected and refetches when it changes', async () => {
    const { query, queryClient, meterTypeId } = setup(null);

    meterTypeId.value = 1;
    await vi.waitFor(() => expect(query.data.value).toEqual([createReportRow({ id: 100, meterTypeId: 1 })]));

    meterTypeId.value = 2;
    await vi.waitFor(() => expect(query.data.value).toEqual([createReportRow({ id: 200, meterTypeId: 2 })]));

    expect(listReportRows).toHaveBeenCalledTimes(2);
    expect(listReportRows).toHaveBeenNthCalledWith(1, 1);
    expect(listReportRows).toHaveBeenNthCalledWith(2, 2);
    expect(queryClient.getQueryData(['reports', 2])).toEqual([createReportRow({ id: 200, meterTypeId: 2 })]);
  });
});
