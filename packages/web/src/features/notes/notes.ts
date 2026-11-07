import { format, isAfter, startOfDay, startOfToday } from 'date-fns';
import type { CreateNoteInput, Note } from '@/api/notes';

export const NOTE_TEXT_MAX_LENGTH = 2000;

export type NoteRow = Note & {
  /** The note's calendar day as a local date (see `toNoteDate`). */
  date: Date;
  /** `date` formatted for display and search. */
  dateText: string;
};

/**
 * Notes are stored like value entries: the picked calendar day at UTC midnight
 * (`yyyy-MM-dd'T'00:00:00.000'Z'`). Reading the UTC date parts back gives that
 * day as a local date, independent of the browser's time zone.
 */
export function toNoteDate(timestamp: Date): Date {
  return new Date(timestamp.getUTCFullYear(), timestamp.getUTCMonth(), timestamp.getUTCDate());
}

/** Newest first; notes on the same day keep a stable order (newest id first). */
export function toNoteRows(notes: Note[], dateFormat: string): NoteRow[] {
  return [...notes]
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime() || b.id - a.id)
    .map((note) => {
      const date = toNoteDate(note.timestamp);
      return { ...note, date, dateText: format(date, dateFormat) };
    });
}

/** Case-insensitive match on the text or the formatted date. */
export function filterNoteRows(rows: NoteRow[], search: string | null | undefined): NoteRow[] {
  const term = search?.trim().toLocaleLowerCase('de');
  if (!term) {
    return rows;
  }

  return rows.filter((row) => {
    return row.text.toLocaleLowerCase('de').includes(term) || row.dateText.includes(term);
  });
}

/** Returns an error message for the textarea, or `true` when the text is valid. */
export function validateNoteText(text: string | null | undefined): true | string {
  const trimmed = text?.trim() ?? '';
  if (!trimmed) {
    return 'Text ist erforderlich.';
  }
  if (trimmed.length > NOTE_TEXT_MAX_LENGTH) {
    return `Höchstens ${NOTE_TEXT_MAX_LENGTH} Zeichen.`;
  }
  return true;
}

export function isFutureNoteDate(date: Date, today: Date = startOfToday()): boolean {
  return isAfter(startOfDay(date), today);
}

/** Builds the API input; throws with a user-facing message when the form is invalid. */
export function buildNoteInput(
  date: Date | null | undefined,
  text: string | null | undefined,
  dateApiSendFormat: string,
  today: Date = startOfToday(),
): CreateNoteInput {
  if (!date) {
    throw new Error('Datum ist erforderlich.');
  }
  if (isFutureNoteDate(date, today)) {
    throw new Error('Das Datum darf nicht in der Zukunft liegen.');
  }

  const textValidation = validateNoteText(text);
  if (textValidation !== true) {
    throw new Error(textValidation);
  }

  return {
    timestamp: format(date, dateApiSendFormat),
    text: (text ?? '').trim(),
  };
}
