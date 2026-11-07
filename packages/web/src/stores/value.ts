import { startOfToday } from "date-fns";
import type { MeterType } from '@/api/meter-types';
import type { ReportRow } from '@/api/reports';

export type ValueFormState = {
  meterTypeId: number;
  originalValue?: ReportRow;
  originalNewMeterValue?: ReportRow;
  value?: number | null;
  newMeterValue?: number | null;
  newMeter: boolean;
};

export type NoteFormState = {
  /** Entry timestamp the note state belongs to; undefined until the first note load. */
  timestamp?: string;
  /** The loaded note of that day; undefined when the day has no note. */
  originalNote?: { id: number; text: string };
  text: string | null;
};

type ValueStoreState = {
  selectedDate: Date;
  inputValues: Record<number, ValueFormState>;
  note: NoteFormState;
};

function createValueFormState(
  meterTypeId: number,
  existing?: Partial<ValueFormState>,
): ValueFormState {
  return {
    meterTypeId,
    originalValue: existing?.originalValue,
    originalNewMeterValue: existing?.originalNewMeterValue,
    value: existing?.value,
    newMeterValue: existing?.newMeterValue,
    newMeter: existing?.newMeter ?? false,
  };
}

export const useValueStore = defineStore("value", {
  state: (): ValueStoreState => ({
    selectedDate: startOfToday(),
    inputValues: {},
    note: { text: '' },
  }),
  actions: {
    initializeInputValues(meterTypes: MeterType[]) {
      meterTypes.forEach((meterType) => {
        const meterTypeId = meterType.id;
        this.inputValues[meterTypeId] = createValueFormState(
          meterTypeId,
          this.inputValues[meterTypeId],
        );
      });
    },
    /**
     * Takes over the loaded note of the day at `timestamp`. The text is replaced
     * when the day changed or the text was not edited, so a background refetch
     * does not discard unsaved typing.
     */
    applyLoadedNote(timestamp: string, note: { id: number; text: string } | undefined) {
      const edited = this.note.timestamp === timestamp &&
        (this.note.text ?? '') !== (this.note.originalNote?.text ?? '');

      this.note.timestamp = timestamp;
      this.note.originalNote = note ? { id: note.id, text: note.text } : undefined;
      if (!edited) {
        this.note.text = note?.text ?? '';
      }
    },
  },
});
