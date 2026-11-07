import { useIsMutating, useMutation, useQueryClient } from '@tanstack/vue-query';
import { format } from 'date-fns';
import { type NoteWriteInput, saveValueEntries } from '@/api/value-entries';
import { deleteValue } from '@/api/values';
import type { NoteFormState, ValueFormState } from '@/stores/value';
import { metersQueryKey } from './useMeters';
import { notesQueryKey } from './useNotes';

export const NOTE_MAX_LENGTH = 2000;

export type SaveValueEntryInput = {
  selectedDate: Date;
  dateApiSendFormat: string;
  latestMeterIdsByMeterType: Record<number, number | undefined>;
  defaultMeterNamesByMeterType: Record<number, string | undefined>;
  inputValues: Record<number, ValueFormState>;
  /** The note of the selected day; omitted or unchanged means no note write. */
  note?: Pick<NoteFormState, 'originalNote' | 'text'>;
  /** Used in error messages; falls back to the meter type id. */
  meterTypeNames?: Record<number, string | undefined>;
};

export type SaveValueEntryResult = {
  /** Number of saved meter types (0 when no value changed). */
  meterTypes: number;
  /** The note write that was saved, if any. */
  note?: NoteWriteInput['kind'];
};

type ValueWrite =
  | { kind: 'update'; valueId: number; value: number | undefined }
  | { kind: 'create'; meterId: number; value: number };

type NewMeterWrite =
  | { kind: 'update'; valueId: number; value: number | undefined }
  | { kind: 'create'; meterName: string; value: number };

// Matches the server's ValueEntryDto (POST /api/value-entries).
type ValueEntryWrites = {
  meterTypeId: number;
  value?: ValueWrite;
  newMeter?: NewMeterWrite;
};

// Checks every entry on the client for immediate feedback; the server
// validates again and saves all entries in one transaction.
function planValueEntryWrites({
  selectedDate,
  latestMeterIdsByMeterType,
  defaultMeterNamesByMeterType,
  inputValues,
  meterTypeNames = {},
}: SaveValueEntryInput): ValueEntryWrites[] {
  const plannedEntries = Object.entries(inputValues).map(([meterTypeIdKey, inputValue]) => {
    const meterTypeId = Number(meterTypeIdKey);
    const meterId = latestMeterIdsByMeterType[meterTypeId];
    const meterTypeName = meterTypeNames[meterTypeId] ?? `Zählerart ${meterTypeId}`;
    const writes: ValueEntryWrites = { meterTypeId };

    if (inputValue.originalValue) {
      writes.value = {
        kind: 'update',
        valueId: inputValue.originalValue.id,
        value: inputValue.value ?? undefined,
      };
    } else if (inputValue.value != null) {
      if (meterId == null) {
        throw new Error(`Für „${meterTypeName}“ gibt es keinen aktiven Zähler.`);
      }

      writes.value = { kind: 'create', meterId, value: inputValue.value };
    }

    if (inputValue.newMeter) {
      if (inputValue.originalNewMeterValue) {
        writes.newMeter = {
          kind: 'update',
          valueId: inputValue.originalNewMeterValue.id,
          value: inputValue.newMeterValue ?? undefined,
        };
      } else {
        if (meterId == null) {
          throw new Error(`Für „${meterTypeName}“ gibt es keinen aktiven Zähler.`);
        }

        if (inputValue.newMeterValue == null) {
          throw new Error(`Für den neuen Zähler bei „${meterTypeName}“ fehlt der Zählerstand.`);
        }

        writes.newMeter = {
          kind: 'create',
          meterName:
            defaultMeterNamesByMeterType[meterTypeId] ??
            `Zähler ${meterTypeId} ${format(selectedDate, 'yyyy-MM-dd')}`,
          value: inputValue.newMeterValue,
        };
      }
    }

    return writes;
  });

  return plannedEntries.filter((entry) => entry.value || entry.newMeter);
}

// Surrounding whitespace is not stored; a blank note deletes the loaded one.
function planNoteWrite(note: SaveValueEntryInput['note']): NoteWriteInput | undefined {
  if (!note) {
    return undefined;
  }

  const text = note.text?.trim() ?? '';
  const { originalNote } = note;
  if (text.length > NOTE_MAX_LENGTH) {
    throw new Error(`Die Notiz darf höchstens ${NOTE_MAX_LENGTH} Zeichen lang sein.`);
  }

  if (!originalNote) {
    return text ? { kind: 'create', text } : undefined;
  }
  if (!text) {
    return { kind: 'delete', noteId: originalNote.id };
  }
  return text === originalNote.text.trim() ? undefined : { kind: 'update', noteId: originalNote.id, text };
}

export const saveValueEntriesMutationKey = ['values', 'save-entries'] as const;

export function useIsSavingValueEntries() {
  const savingCount = useIsMutating({ mutationKey: saveValueEntriesMutationKey });

  return computed(() => savingCount.value > 0);
}

export function useSaveValueEntriesMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: saveValueEntriesMutationKey,
    /** Sends no request when there is nothing to save. */
    mutationFn: async (input: SaveValueEntryInput): Promise<SaveValueEntryResult> => {
      const entries = planValueEntryWrites(input);
      const note = planNoteWrite(input.note);
      if (entries.length === 0 && !note) {
        return { meterTypes: 0 };
      }

      await saveValueEntries({
        timestamp: format(input.selectedDate, input.dateApiSendFormat),
        entries,
        ...(note && { note }),
      });
      return { meterTypes: entries.length, note: note?.kind };
    },
    // Also refresh after a failure: the save may have reached the server even if
    // its response got lost.
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ['reports'] });
      await queryClient.invalidateQueries({ queryKey: metersQueryKey });
      await queryClient.invalidateQueries({ queryKey: notesQueryKey });
    },
  });
}

export function useDeleteValueMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteValue,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['reports'] });
      await queryClient.invalidateQueries({ queryKey: metersQueryKey });
    },
  });
}
