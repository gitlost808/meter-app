import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { createApp, effectScope, type EffectScope } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createMeterType,
  deleteMeterType,
  listMeterTypes,
  updateMeterType,
  type MeterType,
} from '@/api/meter-types';
import {
  meterTypesQueryKey,
  useDeleteMeterTypeMutation,
  useMeterTypesQuery,
  useSaveMeterTypeMutation,
} from './useMeterTypes';

vi.mock('@/api/meter-types', () => ({
  listMeterTypes: vi.fn(),
  createMeterType: vi.fn(),
  updateMeterType: vi.fn(),
  deleteMeterType: vi.fn(),
}));

const METER_TYPE: MeterType = { id: 1, name: 'Gas', unitId: 2 };

let scope: EffectScope | undefined;

function setup() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const app = createApp({ render: () => null });
  app.use(VueQueryPlugin, { queryClient });

  scope = effectScope();
  const composables = app.runWithContext(() => scope!.run(() => ({
    query: useMeterTypesQuery(),
    save: useSaveMeterTypeMutation(),
    remove: useDeleteMeterTypeMutation(),
  }))!);

  return { queryClient, ...composables };
}

beforeEach(() => {
  vi.mocked(listMeterTypes).mockReset().mockResolvedValue([METER_TYPE]);
  vi.mocked(createMeterType).mockReset().mockResolvedValue(METER_TYPE);
  vi.mocked(updateMeterType).mockReset().mockResolvedValue(METER_TYPE);
  vi.mocked(deleteMeterType).mockReset().mockResolvedValue(undefined);
});

afterEach(() => {
  scope?.stop();
});

describe('useMeterTypesQuery', () => {
  it('loads meter types under the meter types query key', async () => {
    const { query, queryClient } = setup();

    await vi.waitFor(() => expect(query.data.value).toEqual([METER_TYPE]));

    expect(listMeterTypes).toHaveBeenCalledOnce();
    expect(queryClient.getQueryData(meterTypesQueryKey)).toEqual([METER_TYPE]);
  });
});

describe('useSaveMeterTypeMutation', () => {
  it('creates a meter type when no id is given', async () => {
    const { save } = setup();

    await save.mutateAsync({ name: 'Wasser', unitId: 3 });

    expect(createMeterType).toHaveBeenCalledExactlyOnceWith({ name: 'Wasser', unitId: 3 });
    expect(updateMeterType).not.toHaveBeenCalled();
  });

  it('updates the meter type with only the editable fields when an id is given', async () => {
    const { save } = setup();

    await save.mutateAsync({ id: 4, name: 'Wasser', unitId: 3 });

    expect(updateMeterType).toHaveBeenCalledExactlyOnceWith(4, { name: 'Wasser', unitId: 3 });
    expect(createMeterType).not.toHaveBeenCalled();
  });

  it('invalidates the meter types query after saving', async () => {
    const { save, queryClient } = setup();
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');

    await save.mutateAsync({ name: 'Wasser', unitId: 3 });

    expect(invalidateQueries).toHaveBeenCalledExactlyOnceWith({ queryKey: meterTypesQueryKey });
  });

  it('does not invalidate anything when saving fails', async () => {
    const { save, queryClient } = setup();
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');
    vi.mocked(createMeterType).mockRejectedValue(new Error('network down'));

    await expect(save.mutateAsync({ name: 'Wasser', unitId: 3 })).rejects.toThrow('network down');

    expect(invalidateQueries).not.toHaveBeenCalled();
  });
});

describe('useDeleteMeterTypeMutation', () => {
  it('deletes the meter type and invalidates the meter types query', async () => {
    const { remove, queryClient } = setup();
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');

    await remove.mutateAsync(4);

    expect(deleteMeterType).toHaveBeenCalledOnce();
    expect(vi.mocked(deleteMeterType).mock.calls[0]?.[0]).toBe(4);
    expect(invalidateQueries).toHaveBeenCalledExactlyOnceWith({ queryKey: meterTypesQueryKey });
  });

  it('does not invalidate anything when deleting fails', async () => {
    const { remove, queryClient } = setup();
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');
    vi.mocked(deleteMeterType).mockRejectedValue(new Error('conflict'));

    await expect(remove.mutateAsync(4)).rejects.toThrow('conflict');

    expect(invalidateQueries).not.toHaveBeenCalled();
  });
});
