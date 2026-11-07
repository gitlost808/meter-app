import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { createApp, effectScope, type EffectScope } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createUnit, deleteUnit, listUnits, updateUnit, type Unit } from '@/api/units';
import {
  unitsQueryKey,
  useDeleteUnitMutation,
  useSaveUnitMutation,
  useUnitsQuery,
} from './useUnits';

vi.mock('@/api/units', () => ({
  listUnits: vi.fn(),
  createUnit: vi.fn(),
  updateUnit: vi.fn(),
  deleteUnit: vi.fn(),
}));

const UNIT: Unit = { id: 1, name: 'Kubikmeter', suffix: 'm³' };

let scope: EffectScope | undefined;

function setup() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const app = createApp({ render: () => null });
  app.use(VueQueryPlugin, { queryClient });

  scope = effectScope();
  const composables = app.runWithContext(() => scope!.run(() => ({
    query: useUnitsQuery(),
    save: useSaveUnitMutation(),
    remove: useDeleteUnitMutation(),
  }))!);

  return { queryClient, ...composables };
}

beforeEach(() => {
  vi.mocked(listUnits).mockReset().mockResolvedValue([UNIT]);
  vi.mocked(createUnit).mockReset().mockResolvedValue(UNIT);
  vi.mocked(updateUnit).mockReset().mockResolvedValue(UNIT);
  vi.mocked(deleteUnit).mockReset().mockResolvedValue(undefined);
});

afterEach(() => {
  scope?.stop();
});

describe('useUnitsQuery', () => {
  it('loads units under the units query key', async () => {
    const { query, queryClient } = setup();

    await vi.waitFor(() => expect(query.data.value).toEqual([UNIT]));

    expect(listUnits).toHaveBeenCalledOnce();
    expect(queryClient.getQueryData(unitsQueryKey)).toEqual([UNIT]);
  });
});

describe('useSaveUnitMutation', () => {
  it('creates a unit when no id is given', async () => {
    const { save } = setup();

    await save.mutateAsync({ name: 'Liter', suffix: 'l' });

    expect(createUnit).toHaveBeenCalledExactlyOnceWith({ name: 'Liter', suffix: 'l' });
    expect(updateUnit).not.toHaveBeenCalled();
  });

  it('updates the unit with only the editable fields when an id is given', async () => {
    const { save } = setup();

    await save.mutateAsync({ id: 4, name: 'Liter', suffix: 'l' });

    expect(updateUnit).toHaveBeenCalledExactlyOnceWith(4, { name: 'Liter', suffix: 'l' });
    expect(createUnit).not.toHaveBeenCalled();
  });

  it('invalidates the units query after saving', async () => {
    const { save, queryClient } = setup();
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');

    await save.mutateAsync({ name: 'Liter', suffix: 'l' });

    expect(invalidateQueries).toHaveBeenCalledExactlyOnceWith({ queryKey: unitsQueryKey });
  });

  it('does not invalidate anything when saving fails', async () => {
    const { save, queryClient } = setup();
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');
    vi.mocked(createUnit).mockRejectedValue(new Error('network down'));

    await expect(save.mutateAsync({ name: 'Liter', suffix: 'l' })).rejects.toThrow('network down');

    expect(invalidateQueries).not.toHaveBeenCalled();
  });
});

describe('useDeleteUnitMutation', () => {
  it('deletes the unit and invalidates the units query', async () => {
    const { remove, queryClient } = setup();
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');

    await remove.mutateAsync(4);

    expect(deleteUnit).toHaveBeenCalledOnce();
    expect(vi.mocked(deleteUnit).mock.calls[0]?.[0]).toBe(4);
    expect(invalidateQueries).toHaveBeenCalledExactlyOnceWith({ queryKey: unitsQueryKey });
  });

  it('does not invalidate anything when deleting fails', async () => {
    const { remove, queryClient } = setup();
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');
    vi.mocked(deleteUnit).mockRejectedValue(new Error('conflict'));

    await expect(remove.mutateAsync(4)).rejects.toThrow('conflict');

    expect(invalidateQueries).not.toHaveBeenCalled();
  });
});
