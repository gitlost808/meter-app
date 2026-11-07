import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';
import { ApiError } from '@/api/client';
import { useStore } from '@/stores/store';
import { useNotify } from './useNotify';

describe('useNotify', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('shows success messages', () => {
    useNotify().success('Zählerstände gespeichert.');

    expect(useStore().snackbars).toEqual([{ text: 'Zählerstände gespeichert.', color: 'success', show: true }]);
  });

  it('shows neutral notices without a color', () => {
    useNotify().info('Keine Zählerstände zum Speichern.');

    expect(useStore().snackbars).toEqual([{ text: 'Keine Zählerstände zum Speichern.', show: true }]);
  });

  it('shows errors with what failed and a readable reason', () => {
    useNotify().error('Speichern fehlgeschlagen', new ApiError('x', 404, '/api/value-entries', { message: 'Meter 10 not found' }));

    expect(useStore().snackbars).toEqual([
      { text: 'Speichern fehlgeschlagen: Meter 10 not found', color: 'error', show: true },
    ]);
  });
});
