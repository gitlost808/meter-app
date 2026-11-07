import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { createApp, effectScope, ref, type EffectScope, type Ref } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createNote, deleteNote, listNotes, type Note, updateNote } from '@/api/notes';
import {
  notesQueryKey,
  useCreateNoteMutation,
  useDeleteNoteMutation,
  useNotesQuery,
  useUpdateNoteMutation,
} from './useNotes';

vi.mock('@/api/notes', () => ({
  listNotes: vi.fn(),
  createNote: vi.fn(),
  updateNote: vi.fn(),
  deleteNote: vi.fn(),
}));

type NoteFilter = { from?: string; to?: string };

const FROM = '2026-01-01';
const TO = '2026-12-31';
const NOTE: Note = { id: 1, text: 'Yearly meter check done', timestamp: new Date(2026, 2, 5) };
const NOTE_INPUT = { text: 'Yearly meter check done', timestamp: '2026-03-05T12:00:00.000Z' };

let scope: EffectScope | undefined;

function setup(initialFilters: NoteFilter = { from: FROM, to: TO }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const app = createApp({ render: () => null });
  app.use(VueQueryPlugin, { queryClient });
  const filters: Ref<NoteFilter> = ref(initialFilters);

  scope = effectScope();
  const composables = app.runWithContext(() => scope!.run(() => ({
    query: useNotesQuery(filters),
    create: useCreateNoteMutation(),
    update: useUpdateNoteMutation(),
    remove: useDeleteNoteMutation(),
  }))!);

  return { queryClient, filters, ...composables };
}

beforeEach(() => {
  vi.mocked(listNotes).mockReset().mockResolvedValue([NOTE]);
  vi.mocked(createNote).mockReset().mockResolvedValue(NOTE);
  vi.mocked(updateNote).mockReset().mockResolvedValue(NOTE);
  vi.mocked(deleteNote).mockReset().mockResolvedValue(undefined);
});

afterEach(() => {
  scope?.stop();
});

describe('useNotesQuery', () => {
  it('loads notes for the filter range under a filter-specific key', async () => {
    const { query, queryClient } = setup();

    await vi.waitFor(() => expect(query.data.value).toEqual([NOTE]));

    expect(listNotes).toHaveBeenCalledExactlyOnceWith(FROM, TO);
    expect(queryClient.getQueryData(['notes', FROM, TO])).toEqual([NOTE]);
  });

  it('uses null key parts when no range is set', async () => {
    const { query, queryClient } = setup({});

    await vi.waitFor(() => expect(query.data.value).toEqual([NOTE]));

    expect(listNotes).toHaveBeenCalledExactlyOnceWith(undefined, undefined);
    expect(queryClient.getQueryData(['notes', null, null])).toEqual([NOTE]);
  });

  it('refetches with the new range when the filters change', async () => {
    const { query, queryClient, filters } = setup();
    await vi.waitFor(() => expect(query.data.value).toEqual([NOTE]));
    const laterNote: Note = { ...NOTE, id: 2, text: 'Later' };
    vi.mocked(listNotes).mockResolvedValue([laterNote]);

    filters.value = { from: '2027-01-01', to: '2027-12-31' };

    await vi.waitFor(() => expect(query.data.value).toEqual([laterNote]));
    expect(listNotes).toHaveBeenLastCalledWith('2027-01-01', '2027-12-31');
    expect(queryClient.getQueryData(['notes', '2027-01-01', '2027-12-31'])).toEqual([laterNote]);
    expect(queryClient.getQueryData(['notes', FROM, TO])).toEqual([NOTE]);
  });
});

describe('note mutations', () => {
  it('uses the notes key as the prefix of every range key', () => {
    expect(notesQueryKey).toEqual(['notes']);
  });

  it('creates a note and invalidates the notes of every range', async () => {
    const { create, queryClient } = setup();
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');

    await create.mutateAsync(NOTE_INPUT);

    expect(createNote).toHaveBeenCalledExactlyOnceWith(NOTE_INPUT);
    expect(invalidateQueries).toHaveBeenCalledExactlyOnceWith({ queryKey: notesQueryKey });
  });

  it('updates a note by id and invalidates the notes of every range', async () => {
    const { update, queryClient } = setup();
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');

    await update.mutateAsync({ id: 1, input: { text: 'Edited' } });

    expect(updateNote).toHaveBeenCalledExactlyOnceWith(1, { text: 'Edited' });
    expect(invalidateQueries).toHaveBeenCalledExactlyOnceWith({ queryKey: notesQueryKey });
  });

  it('deletes a note by id and invalidates the notes of every range', async () => {
    const { remove, queryClient } = setup();
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');

    await remove.mutateAsync(1);

    expect(deleteNote).toHaveBeenCalledExactlyOnceWith(1);
    expect(invalidateQueries).toHaveBeenCalledExactlyOnceWith({ queryKey: notesQueryKey });
  });

  it('also invalidates cached notes of other ranges, but no other queries', async () => {
    const { create, query, queryClient } = setup();
    await vi.waitFor(() => expect(query.data.value).toEqual([NOTE]));
    queryClient.setQueryData(['notes', '2020-01-01', '2020-12-31'], [NOTE]);
    queryClient.setQueryData(['notes', null, null], [NOTE]);
    queryClient.setQueryData(['units'], []);

    await create.mutateAsync(NOTE_INPUT);

    const isInvalidated = (queryKey: unknown[]) => queryClient.getQueryState(queryKey)?.isInvalidated;
    expect(isInvalidated(['notes', '2020-01-01', '2020-12-31'])).toBe(true);
    expect(isInvalidated(['notes', null, null])).toBe(true);
    expect(isInvalidated(['units'])).toBe(false);
    // The active query of the current range is refetched right away.
    expect(listNotes).toHaveBeenCalledTimes(2);
  });

  it('does not invalidate anything when the mutation fails', async () => {
    const { create, update, remove, queryClient } = setup();
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');
    vi.mocked(createNote).mockRejectedValue(new Error('network down'));
    vi.mocked(updateNote).mockRejectedValue(new Error('network down'));
    vi.mocked(deleteNote).mockRejectedValue(new Error('network down'));

    await expect(create.mutateAsync(NOTE_INPUT)).rejects.toThrow('network down');
    await expect(update.mutateAsync({ id: 1, input: { text: 'Edited' } })).rejects.toThrow('network down');
    await expect(remove.mutateAsync(1)).rejects.toThrow('network down');

    expect(invalidateQueries).not.toHaveBeenCalled();
  });
});
