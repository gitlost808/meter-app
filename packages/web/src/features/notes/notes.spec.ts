import { describe, expect, it } from 'vitest';
import type { Note } from '@/api/notes';
import {
  NOTE_TEXT_MAX_LENGTH,
  buildNoteInput,
  filterNoteRows,
  isFutureNoteDate,
  toNoteDate,
  toNoteRows,
  validateNoteText,
} from './notes';

const dateFormat = 'dd.MM.yyyy';
const dateApiSendFormat = "yyyy-MM-dd'T'00:00:00.000'Z'";
const today = new Date(2026, 9, 16);

function createNote(overrides: Partial<Note> = {}): Note {
  return {
    id: 1,
    text: 'Zähler abgelesen',
    timestamp: new Date('2026-03-05T00:00:00.000Z'),
    ...overrides,
  };
}

describe('toNoteDate', () => {
  it('reads the stored UTC calendar day as a local date', () => {
    expect(toNoteDate(new Date('2026-03-05T00:00:00.000Z'))).toEqual(new Date(2026, 2, 5));
    expect(toNoteDate(new Date('2026-03-05T23:30:00.000Z'))).toEqual(new Date(2026, 2, 5));
  });
});

describe('toNoteRows', () => {
  it('sorts newest first and breaks ties by id', () => {
    const notes = [
      createNote({ id: 1, timestamp: new Date('2024-01-10T00:00:00.000Z') }),
      createNote({ id: 2, timestamp: new Date('2026-03-05T00:00:00.000Z') }),
      createNote({ id: 3, timestamp: new Date('2025-07-01T00:00:00.000Z') }),
      createNote({ id: 4, timestamp: new Date('2026-03-05T00:00:00.000Z') }),
    ];

    expect(toNoteRows(notes, dateFormat).map((row) => row.id)).toEqual([4, 2, 3, 1]);
  });

  it('does not mutate the query data', () => {
    const notes = [createNote({ id: 1 }), createNote({ id: 2, timestamp: new Date('2027-01-01T00:00:00.000Z') })];

    toNoteRows(notes, dateFormat);

    expect(notes.map((note) => note.id)).toEqual([1, 2]);
  });

  it('formats the date for display', () => {
    const [row] = toNoteRows([createNote()], dateFormat);

    expect(row.dateText).toBe('05.03.2026');
    expect(row.date).toEqual(new Date(2026, 2, 5));
  });
});

describe('filterNoteRows', () => {
  const rows = toNoteRows([
    createNote({ id: 1, text: 'Heizung gewartet', timestamp: new Date('2025-11-02T00:00:00.000Z') }),
    createNote({ id: 2, text: 'Neuer Wasserzähler', timestamp: new Date('2026-03-05T00:00:00.000Z') }),
  ], dateFormat);

  it('returns all rows for an empty search', () => {
    expect(filterNoteRows(rows, '')).toBe(rows);
    expect(filterNoteRows(rows, '   ')).toBe(rows);
    expect(filterNoteRows(rows, null)).toBe(rows);
  });

  it('matches the text case-insensitively', () => {
    expect(filterNoteRows(rows, '  wasserZÄHLER ').map((row) => row.id)).toEqual([2]);
  });

  it('matches the formatted date', () => {
    expect(filterNoteRows(rows, '02.11.').map((row) => row.id)).toEqual([1]);
    expect(filterNoteRows(rows, '2026').map((row) => row.id)).toEqual([2]);
  });
});

describe('validateNoteText', () => {
  it('requires non-blank text', () => {
    expect(validateNoteText('')).toBe('Text ist erforderlich.');
    expect(validateNoteText('  \n ')).toBe('Text ist erforderlich.');
    expect(validateNoteText(null)).toBe('Text ist erforderlich.');
  });

  it('limits the trimmed text to the backend maximum', () => {
    expect(validateNoteText(` ${'x'.repeat(NOTE_TEXT_MAX_LENGTH)} `)).toBe(true);
    expect(validateNoteText('x'.repeat(NOTE_TEXT_MAX_LENGTH + 1))).toBe('Höchstens 2000 Zeichen.');
  });
});

describe('isFutureNoteDate', () => {
  it('allows today and past days only', () => {
    expect(isFutureNoteDate(new Date(2026, 9, 15), today)).toBe(false);
    expect(isFutureNoteDate(new Date(2026, 9, 16, 18, 0), today)).toBe(false);
    expect(isFutureNoteDate(new Date(2026, 9, 17), today)).toBe(true);
  });
});

describe('buildNoteInput', () => {
  it('sends the picked day at UTC midnight and trims the text', () => {
    expect(buildNoteInput(new Date(2026, 2, 5), '  Zähler getauscht \n', dateApiSendFormat, today)).toEqual({
      timestamp: '2026-03-05T00:00:00.000Z',
      text: 'Zähler getauscht',
    });
  });

  it('round-trips a stored timestamp', () => {
    const stored = new Date('2025-12-31T00:00:00.000Z');

    expect(buildNoteInput(toNoteDate(stored), 'Silvester', dateApiSendFormat, today).timestamp)
      .toBe('2025-12-31T00:00:00.000Z');
  });

  it('rejects a missing or future date', () => {
    expect(() => buildNoteInput(null, 'Text', dateApiSendFormat, today)).toThrow('Datum ist erforderlich.');
    expect(() => buildNoteInput(new Date(2026, 9, 17), 'Text', dateApiSendFormat, today))
      .toThrow('Das Datum darf nicht in der Zukunft liegen.');
  });

  it('rejects blank or too long text', () => {
    expect(() => buildNoteInput(today, '   ', dateApiSendFormat, today)).toThrow('Text ist erforderlich.');
    expect(() => buildNoteInput(today, 'x'.repeat(NOTE_TEXT_MAX_LENGTH + 1), dateApiSendFormat, today))
      .toThrow('Höchstens 2000 Zeichen.');
  });
});
