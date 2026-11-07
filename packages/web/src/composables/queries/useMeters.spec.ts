import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { createApp, effectScope, type EffectScope } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createMeter,
  deleteMeter,
  listMeterStats,
  type Meter,
  type MeterStat,
  updateMeter,
} from '@/api/meters';
import {
  metersQueryKey,
  useDeleteMeterMutation,
  useMetersQuery,
  useSaveMeterMutation,
} from './useMeters';

vi.mock('@/api/meters', () => ({
  listMeterStats: vi.fn(),
  createMeter: vi.fn(),
  updateMeter: vi.fn(),
  deleteMeter: vi.fn(),
}));

const METER: Meter = { id: 1, name: 'Gas 2025', meterTypeId: 3 };
const METER_STAT: MeterStat = {
  ...METER,
  firstValue: 100,
  firstValueDate: '2025-01-01T00:00:00.000Z',
  lastValue: 250,
  lastValueDate: '2025-12-31T00:00:00.000Z',
  totalValues: 12,
};

let scope: EffectScope | undefined;

function setup() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const app = createApp({ render: () => null });
  app.use(VueQueryPlugin, { queryClient });

  scope = effectScope();
  const composables = app.runWithContext(() => scope!.run(() => ({
    query: useMetersQuery(),
    save: useSaveMeterMutation(),
    remove: useDeleteMeterMutation(),
  }))!);

  return { queryClient, ...composables };
}

beforeEach(() => {
  vi.mocked(listMeterStats).mockReset().mockResolvedValue([METER_STAT]);
  vi.mocked(createMeter).mockReset().mockResolvedValue(METER);
  vi.mocked(updateMeter).mockReset().mockResolvedValue(METER);
  vi.mocked(deleteMeter).mockReset().mockResolvedValue(undefined);
});

afterEach(() => {
  scope?.stop();
});

describe('useMetersQuery', () => {
  it('loads meter stats under the meter stats query key', async () => {
    const { query, queryClient } = setup();

    await vi.waitFor(() => expect(query.data.value).toEqual([METER_STAT]));

    expect(listMeterStats).toHaveBeenCalledOnce();
    expect(queryClient.getQueryData(metersQueryKey)).toEqual([METER_STAT]);
  });
});

describe('useSaveMeterMutation', () => {
  it('creates a meter when no id is given', async () => {
    const { save } = setup();

    await save.mutateAsync({ name: 'Gas 2026', meterTypeId: 3 });

    expect(createMeter).toHaveBeenCalledExactlyOnceWith({ name: 'Gas 2026', meterTypeId: 3 });
    expect(updateMeter).not.toHaveBeenCalled();
  });

  it('updates the meter with only the editable fields when an id is given', async () => {
    const { save } = setup();

    await save.mutateAsync({ id: 4, name: 'Gas 2026', meterTypeId: 3 });

    expect(updateMeter).toHaveBeenCalledExactlyOnceWith(4, { name: 'Gas 2026', meterTypeId: 3 });
    expect(createMeter).not.toHaveBeenCalled();
  });

  it('invalidates the meter stats query after saving', async () => {
    const { save, queryClient } = setup();
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');

    await save.mutateAsync({ name: 'Gas 2026', meterTypeId: 3 });

    expect(invalidateQueries).toHaveBeenCalledExactlyOnceWith({ queryKey: metersQueryKey });
  });

  it('does not invalidate anything when saving fails', async () => {
    const { save, queryClient } = setup();
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');
    vi.mocked(createMeter).mockRejectedValue(new Error('network down'));

    await expect(save.mutateAsync({ name: 'Gas 2026', meterTypeId: 3 })).rejects.toThrow('network down');

    expect(invalidateQueries).not.toHaveBeenCalled();
  });
});

describe('useDeleteMeterMutation', () => {
  it('deletes the meter and invalidates the meter stats query', async () => {
    const { remove, queryClient } = setup();
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');

    await remove.mutateAsync(4);

    expect(deleteMeter).toHaveBeenCalledOnce();
    expect(vi.mocked(deleteMeter).mock.calls[0]?.[0]).toBe(4);
    expect(invalidateQueries).toHaveBeenCalledExactlyOnceWith({ queryKey: metersQueryKey });
  });

  it('does not invalidate anything when deleting fails', async () => {
    const { remove, queryClient } = setup();
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');
    vi.mocked(deleteMeter).mockRejectedValue(new Error('conflict'));

    await expect(remove.mutateAsync(4)).rejects.toThrow('conflict');

    expect(invalidateQueries).not.toHaveBeenCalled();
  });
});
