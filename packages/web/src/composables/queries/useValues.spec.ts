import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { createApp, effectScope, type EffectScope } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReportRow } from '@/api/reports';
import { saveValueEntries } from '@/api/value-entries';
import type { ValueFormState } from '@/stores/value';
import { metersQueryKey } from './useMeters';
import { notesQueryKey } from './useNotes';
import {
  type SaveValueEntryInput,
  useIsSavingValueEntries,
  useSaveValueEntriesMutation,
} from './useValues';

vi.mock('@/api/value-entries', () => ({
  saveValueEntries: vi.fn(),
}));

const DATE_API_SEND_FORMAT = "yyyy-MM-dd'T'00:00:00.000'Z'";
// Local midnight, so the formatted timestamp doesn't depend on the test machine's timezone.
const SELECTED_DATE = new Date(2026, 9, 15);
const SELECTED_TIMESTAMP = '2026-10-15T00:00:00.000Z';

function createReportRow(overrides: Partial<ReportRow> = {}): ReportRow {
  return {
    id: 1,
    timestamp: SELECTED_DATE,
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

function createFormState(overrides: Partial<ValueFormState> = {}): ValueFormState {
  return {
    meterTypeId: 1,
    originalValue: undefined,
    originalNewMeterValue: undefined,
    value: undefined,
    newMeterValue: undefined,
    newMeter: false,
    ...overrides,
  };
}

function createInput(overrides: Partial<SaveValueEntryInput> = {}): SaveValueEntryInput {
  return {
    selectedDate: SELECTED_DATE,
    dateApiSendFormat: DATE_API_SEND_FORMAT,
    latestMeterIdsByMeterType: { 1: 10 },
    defaultMeterNamesByMeterType: { 1: 'gas 2026-10-15' },
    inputValues: { 1: createFormState() },
    ...overrides,
  };
}

let scope: EffectScope | undefined;

function setup() {
  const queryClient = new QueryClient();
  const app = createApp({ render: () => null });
  app.use(VueQueryPlugin, { queryClient });

  scope = effectScope();
  const composables = app.runWithContext(() => scope!.run(() => ({
    mutation: useSaveValueEntriesMutation(),
    isSaving: useIsSavingValueEntries(),
  }))!);

  return { queryClient, ...composables };
}

function expectSavedEntries(entries: unknown[]) {
  expect(saveValueEntries).toHaveBeenCalledExactlyOnceWith({ timestamp: SELECTED_TIMESTAMP, entries });
}

describe('useSaveValueEntriesMutation', () => {
  beforeEach(() => {
    vi.mocked(saveValueEntries).mockReset().mockResolvedValue(undefined);
  });

  afterEach(() => {
    scope?.stop();
  });

  it('updates an existing value for the selected day', async () => {
    const { mutation } = setup();

    await mutation.mutateAsync(createInput({
      inputValues: {
        1: createFormState({ originalValue: createReportRow({ id: 7 }), value: 120 }),
      },
    }));

    expectSavedEntries([{ meterTypeId: 1, value: { kind: 'update', valueId: 7, value: 120 } }]);
  });

  it('sends no value when an existing value is cleared', async () => {
    const { mutation } = setup();

    await mutation.mutateAsync(createInput({
      inputValues: {
        1: createFormState({ originalValue: createReportRow({ id: 7 }), value: null }),
      },
    }));

    expectSavedEntries([{ meterTypeId: 1, value: { kind: 'update', valueId: 7, value: undefined } }]);
  });

  it('creates a new value on the latest meter of the meter type', async () => {
    const { mutation } = setup();

    await mutation.mutateAsync(createInput({
      inputValues: { 1: createFormState({ value: 130 }) },
    }));

    expectSavedEntries([{ meterTypeId: 1, value: { kind: 'create', meterId: 10, value: 130 } }]);
  });

  it('leaves out meter types without an entered or existing value', async () => {
    const { mutation } = setup();

    await mutation.mutateAsync(createInput({
      inputValues: {
        1: createFormState({ value: 130 }),
        2: createFormState({ meterTypeId: 2, value: null }),
      },
    }));

    expectSavedEntries([{ meterTypeId: 1, value: { kind: 'create', meterId: 10, value: 130 } }]);
  });

  it('sends no request when there is nothing to save', async () => {
    const { mutation } = setup();

    const result = await mutation.mutateAsync(createInput({
      inputValues: {
        1: createFormState({ value: undefined }),
        2: createFormState({ meterTypeId: 2, value: null }),
      },
      note: { originalNote: { id: 4, text: 'kept' }, text: 'kept' },
    }));

    expect(saveValueEntries).not.toHaveBeenCalled();
    expect(result).toEqual({ meterTypes: 0 });
  });

  it('resolves to the number of saved meter types', async () => {
    const { mutation } = setup();

    const result = await mutation.mutateAsync(createInput({
      latestMeterIdsByMeterType: { 1: 10, 2: 20 },
      inputValues: {
        1: createFormState({ value: 130 }),
        2: createFormState({ meterTypeId: 2, value: 5 }),
        3: createFormState({ meterTypeId: 3, value: null }),
      },
    }));

    expect(result).toEqual({ meterTypes: 2, note: undefined });
  });

  it('names the meter type in validation errors', async () => {
    const { mutation } = setup();

    await expect(mutation.mutateAsync(createInput({
      latestMeterIdsByMeterType: {},
      meterTypeNames: { 1: 'gas' },
      inputValues: { 1: createFormState({ value: 130 }) },
    }))).rejects.toThrow('Für „gas“ gibt es keinen aktiven Zähler.');

    await expect(mutation.mutateAsync(createInput({
      meterTypeNames: { 1: 'gas' },
      inputValues: { 1: createFormState({ newMeter: true, newMeterValue: null }) },
    }))).rejects.toThrow('Für den neuen Zähler bei „gas“ fehlt der Zählerstand.');
  });

  it('saves every meter type in one request', async () => {
    const { mutation } = setup();

    await mutation.mutateAsync(createInput({
      latestMeterIdsByMeterType: { 1: 10, 2: 20 },
      inputValues: {
        1: createFormState({ value: 130 }),
        2: createFormState({ meterTypeId: 2, originalValue: createReportRow({ id: 8 }), value: 5 }),
      },
    }));

    expectSavedEntries([
      { meterTypeId: 1, value: { kind: 'create', meterId: 10, value: 130 } },
      { meterTypeId: 2, value: { kind: 'update', valueId: 8, value: 5 } },
    ]);
  });

  it('fails when a new value has no active meter', async () => {
    const { mutation } = setup();

    await expect(mutation.mutateAsync(createInput({
      latestMeterIdsByMeterType: {},
      inputValues: { 1: createFormState({ value: 130 }) },
    }))).rejects.toThrow('Für „Zählerart 1“ gibt es keinen aktiven Zähler.');

    expect(saveValueEntries).not.toHaveBeenCalled();
  });

  describe('meter change', () => {
    it('creates a new meter with the default name and its first value', async () => {
      const { mutation } = setup();

      await mutation.mutateAsync(createInput({
        inputValues: { 1: createFormState({ value: 140, newMeter: true, newMeterValue: 3 }) },
      }));

      expectSavedEntries([{
        meterTypeId: 1,
        // final reading of the old meter, then the new meter with its first reading
        value: { kind: 'create', meterId: 10, value: 140 },
        newMeter: { kind: 'create', meterName: 'gas 2026-10-15', value: 3 },
      }]);
    });

    it('falls back to a generated meter name', async () => {
      const { mutation } = setup();

      await mutation.mutateAsync(createInput({
        defaultMeterNamesByMeterType: {},
        inputValues: { 1: createFormState({ newMeter: true, newMeterValue: 3 }) },
      }));

      expectSavedEntries([{
        meterTypeId: 1,
        newMeter: { kind: 'create', meterName: 'Zähler 1 2026-10-15', value: 3 },
      }]);
    });

    it('updates both values when the meter change was already saved', async () => {
      const { mutation } = setup();

      await mutation.mutateAsync(createInput({
        inputValues: {
          1: createFormState({
            originalValue: createReportRow({ id: 7 }),
            value: 140,
            newMeter: true,
            originalNewMeterValue: createReportRow({ id: 8, meterId: 50 }),
            newMeterValue: 4,
          }),
        },
      }));

      expectSavedEntries([{
        meterTypeId: 1,
        value: { kind: 'update', valueId: 7, value: 140 },
        newMeter: { kind: 'update', valueId: 8, value: 4 },
      }]);
    });

    it('fails without a value for the new meter', async () => {
      const { mutation } = setup();

      await expect(mutation.mutateAsync(createInput({
        inputValues: { 1: createFormState({ newMeter: true, newMeterValue: null }) },
      }))).rejects.toThrow('Für den neuen Zähler bei „Zählerart 1“ fehlt der Zählerstand.');

      expect(saveValueEntries).not.toHaveBeenCalled();
    });

    it('fails without an active meter to replace', async () => {
      const { mutation } = setup();

      await expect(mutation.mutateAsync(createInput({
        latestMeterIdsByMeterType: {},
        inputValues: { 1: createFormState({ newMeter: true, newMeterValue: 3 }) },
      }))).rejects.toThrow('Für „Zählerart 1“ gibt es keinen aktiven Zähler.');

      expect(saveValueEntries).not.toHaveBeenCalled();
    });
  });

  describe('validation before sending', () => {
    it('sends nothing when a meter change lacks the new meter value', async () => {
      const { mutation } = setup();

      await expect(mutation.mutateAsync(createInput({
        // final reading of the old meter is valid on its own, but must not be saved without the new meter
        inputValues: { 1: createFormState({ value: 140, newMeter: true, newMeterValue: null }) },
      }))).rejects.toThrow('Für den neuen Zähler bei „Zählerart 1“ fehlt der Zählerstand.');

      expect(saveValueEntries).not.toHaveBeenCalled();
    });

    it('sends nothing for valid meter types when another one is invalid', async () => {
      const { mutation } = setup();

      await expect(mutation.mutateAsync(createInput({
        latestMeterIdsByMeterType: { 1: 10 },
        inputValues: {
          1: createFormState({ originalValue: createReportRow({ id: 7 }), value: 120 }),
          2: createFormState({ meterTypeId: 2, value: 5 }),
        },
      }))).rejects.toThrow('Für „Zählerart 2“ gibt es keinen aktiven Zähler.');

      expect(saveValueEntries).not.toHaveBeenCalled();
    });
  });

  describe('note', () => {
    function expectSavedNote(note: unknown, entries: unknown[] = []) {
      expect(saveValueEntries).toHaveBeenCalledExactlyOnceWith({ timestamp: SELECTED_TIMESTAMP, entries, note });
    }

    it('creates a note when the day has none', async () => {
      const { mutation } = setup();

      const result = await mutation.mutateAsync(createInput({ note: { text: '  Yearly meter check done\n' } }));

      expectSavedNote({ kind: 'create', text: 'Yearly meter check done' });
      expect(result).toEqual({ meterTypes: 0, note: 'create' });
    });

    it('updates the loaded note when its text changed', async () => {
      const { mutation } = setup();

      await mutation.mutateAsync(createInput({ note: { originalNote: { id: 4, text: 'old' }, text: 'new' } }));

      expectSavedNote({ kind: 'update', noteId: 4, text: 'new' });
    });

    it('deletes the loaded note when its text is cleared or blank', async () => {
      const { mutation } = setup();

      await mutation.mutateAsync(createInput({ note: { originalNote: { id: 4, text: 'old' }, text: null } }));
      expectSavedNote({ kind: 'delete', noteId: 4 });

      vi.mocked(saveValueEntries).mockClear();
      const result = await mutation.mutateAsync(createInput({ note: { originalNote: { id: 4, text: 'old' }, text: '  ' } }));
      expectSavedNote({ kind: 'delete', noteId: 4 });
      expect(result).toEqual({ meterTypes: 0, note: 'delete' });
    });

    it('omits an unchanged or empty note', async () => {
      const { mutation } = setup();

      await mutation.mutateAsync(createInput({
        inputValues: { 1: createFormState({ value: 130 }) },
        note: { originalNote: { id: 4, text: 'same\n' }, text: 'same ' },
      }));
      expectSavedEntries([{ meterTypeId: 1, value: { kind: 'create', meterId: 10, value: 130 } }]);

      vi.mocked(saveValueEntries).mockClear();
      const result = await mutation.mutateAsync(createInput({ note: { text: ' ' } }));
      expect(saveValueEntries).not.toHaveBeenCalled();
      expect(result).toEqual({ meterTypes: 0 });
    });

    it('saves the note with the values in one request', async () => {
      const { mutation } = setup();

      const result = await mutation.mutateAsync(createInput({
        inputValues: { 1: createFormState({ value: 130 }) },
        note: { text: 'checked' },
      }));

      expectSavedNote(
        { kind: 'create', text: 'checked' },
        [{ meterTypeId: 1, value: { kind: 'create', meterId: 10, value: 130 } }],
      );
      expect(result).toEqual({ meterTypes: 1, note: 'create' });
    });

    it('rejects a note longer than 2000 characters', async () => {
      const { mutation } = setup();

      await expect(mutation.mutateAsync(createInput({ note: { text: 'x'.repeat(2001) } })))
        .rejects.toThrow('Die Notiz darf höchstens 2000 Zeichen lang sein.');
      expect(saveValueEntries).not.toHaveBeenCalled();
    });
  });

  it('invalidates reports, meter stats and notes after saving', async () => {
    const { mutation, queryClient } = setup();
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');

    await mutation.mutateAsync(createInput({ inputValues: { 1: createFormState({ value: 130 }) } }));

    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['reports'] });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: metersQueryKey });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: notesQueryKey });
  });

  it('still invalidates queries when the save request fails', async () => {
    const { mutation, queryClient } = setup();
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');
    vi.mocked(saveValueEntries).mockRejectedValue(new Error('network down'));

    await expect(mutation.mutateAsync(createInput({
      inputValues: { 1: createFormState({ value: 130 }) },
    }))).rejects.toThrow('network down');

    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['reports'] });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: metersQueryKey });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: notesQueryKey });
  });
});

describe('useIsSavingValueEntries', () => {
  afterEach(() => {
    scope?.stop();
  });

  it('is true only while a save is in flight', async () => {
    const { mutation, isSaving } = setup();
    let resolveSave!: () => void;
    vi.mocked(saveValueEntries).mockReset().mockReturnValue(new Promise<void>((resolve) => {
      resolveSave = resolve;
    }));

    expect(isSaving.value).toBe(false);

    const saving = mutation.mutateAsync(createInput({ inputValues: { 1: createFormState({ value: 130 }) } }));
    await vi.waitFor(() => expect(isSaving.value).toBe(true));

    resolveSave();
    await saving;
    await vi.waitFor(() => expect(isSaving.value).toBe(false));
  });
});
