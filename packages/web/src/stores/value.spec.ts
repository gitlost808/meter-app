import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';
import { useValueStore } from './value';

const DAY = '2026-10-15T00:00:00.000Z';
const OTHER_DAY = '2026-10-16T00:00:00.000Z';

describe('useValueStore applyLoadedNote', () => {
  let store: ReturnType<typeof useValueStore>;

  beforeEach(() => {
    setActivePinia(createPinia());
    store = useValueStore();
  });

  it('prefills the note of the day', () => {
    store.applyLoadedNote(DAY, { id: 4, text: 'checked' });

    expect(store.note).toEqual({ timestamp: DAY, originalNote: { id: 4, text: 'checked' }, text: 'checked' });
  });

  it('empties the note for a day without one', () => {
    store.applyLoadedNote(DAY, { id: 4, text: 'checked' });
    store.applyLoadedNote(OTHER_DAY, undefined);

    expect(store.note).toEqual({ timestamp: OTHER_DAY, originalNote: undefined, text: '' });
  });

  it('replaces edited text when the day changes', () => {
    store.applyLoadedNote(DAY, undefined);
    store.note.text = 'unsaved';

    store.applyLoadedNote(OTHER_DAY, { id: 5, text: 'other' });

    expect(store.note.text).toBe('other');
  });

  it('keeps unsaved typing on a refetch of the same day', () => {
    store.applyLoadedNote(DAY, { id: 4, text: 'checked' });
    store.note.text = 'checked twice';

    store.applyLoadedNote(DAY, { id: 4, text: 'checked' });

    expect(store.note.text).toBe('checked twice');
  });

  it('picks up a changed note of the same day when the text was not edited', () => {
    store.applyLoadedNote(DAY, { id: 4, text: 'checked' });

    store.applyLoadedNote(DAY, { id: 4, text: 'edited elsewhere' });

    expect(store.note.text).toBe('edited elsewhere');
  });

  it('takes over the created note after saving without changing the text', () => {
    store.applyLoadedNote(DAY, undefined);
    store.note.text = 'new note ';

    store.applyLoadedNote(DAY, { id: 6, text: 'new note' });

    expect(store.note).toEqual({ timestamp: DAY, originalNote: { id: 6, text: 'new note' }, text: 'new note ' });
  });

  it('treats a cleared textarea like an empty note', () => {
    store.applyLoadedNote(DAY, undefined);
    store.note.text = null;

    store.applyLoadedNote(DAY, { id: 6, text: 'from elsewhere' });

    expect(store.note.text).toBe('from elsewhere');
  });
});
