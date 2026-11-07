import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { SaveValueEntriesDto } from './save-value-entries.dto';

// Same options as the global ValidationPipe in app.setup.ts.
async function errorsFor(body: unknown): Promise<string[]> {
  const dto = plainToInstance(SaveValueEntriesDto, body);
  const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
  const paths: string[] = [];
  const collect = (list: typeof errors, prefix: string) => {
    for (const error of list) {
      const path = prefix ? `${prefix}.${error.property}` : error.property;
      if (error.constraints) {
        paths.push(path);
      }
      collect(error.children ?? [], path);
    }
  };
  collect(errors, '');
  return paths;
}

const timestamp = '2026-10-16T00:00:00.000Z';

describe('SaveValueEntriesDto', () => {
  it('accepts every write kind', async () => {
    expect(await errorsFor({
      timestamp,
      entries: [
        { meterTypeId: 1, value: { kind: 'update', valueId: 7 } },
        { meterTypeId: 2, value: { kind: 'create', meterId: 3, value: 1.5 } },
        {
          meterTypeId: 3,
          value: { kind: 'update', valueId: 8, value: 2 },
          newMeter: { kind: 'create', meterName: 'new', value: 0 },
        },
        { meterTypeId: 4, newMeter: { kind: 'update', valueId: 9, value: 1 } },
      ],
    })).toEqual([]);
  });

  it('requires the fields of the chosen kind', async () => {
    expect(await errorsFor({
      timestamp,
      entries: [
        { meterTypeId: 1, value: { kind: 'update' } },
        { meterTypeId: 2, value: { kind: 'create', value: 1 } },
        { meterTypeId: 3, value: { kind: 'create', meterId: 3 } },
        { meterTypeId: 4, newMeter: { kind: 'create', value: 1 } },
        { meterTypeId: 5, newMeter: { kind: 'create', meterName: 'x' } },
      ],
    })).toEqual([
      'entries.0.value.valueId',
      'entries.1.value.meterId',
      'entries.2.value.value',
      'entries.3.newMeter.meterName',
      'entries.4.newMeter.value',
    ]);
  });

  it('rejects unknown kinds, unknown fields, empty and malformed requests', async () => {
    expect(await errorsFor({ timestamp, entries: [{ meterTypeId: 1, value: { kind: 'delete', valueId: 1 } }] }))
      .toEqual(['entries.0.value.kind']);
    expect(await errorsFor({ timestamp, entries: [{ meterTypeId: 1, extra: true }] }))
      .toEqual(['entries.0.extra']);
    expect(await errorsFor({ timestamp, entries: [] })).toEqual(['entries']);
    expect(await errorsFor({ timestamp: 'yesterday', entries: [{ meterTypeId: 1 }] })).toEqual(['timestamp']);
  });

  describe('note', () => {
    it('accepts every note write kind, with or without entries', async () => {
      expect(await errorsFor({
        timestamp,
        entries: [{ meterTypeId: 1, value: { kind: 'update', valueId: 7 } }],
        note: { kind: 'create', text: 'Yearly meter check done' },
      })).toEqual([]);
      expect(await errorsFor({ timestamp, entries: [], note: { kind: 'update', noteId: 4, text: 'Edited' } }))
        .toEqual([]);
      expect(await errorsFor({ timestamp, entries: [], note: { kind: 'delete', noteId: 4 } })).toEqual([]);
    });

    it('requires the fields of the chosen kind', async () => {
      expect(await errorsFor({ timestamp, entries: [], note: { kind: 'create' } })).toEqual(['note.text']);
      expect(await errorsFor({ timestamp, entries: [], note: { kind: 'update', text: 'x' } })).toEqual(['note.noteId']);
      expect(await errorsFor({ timestamp, entries: [], note: { kind: 'update', noteId: 4 } })).toEqual(['note.text']);
      expect(await errorsFor({ timestamp, entries: [], note: { kind: 'delete' } })).toEqual(['note.noteId']);
    });

    it('rejects blank, too long and unknown notes', async () => {
      expect(await errorsFor({ timestamp, entries: [], note: { kind: 'create', text: '' } })).toEqual(['note.text']);
      expect(await errorsFor({ timestamp, entries: [], note: { kind: 'create', text: ' \n ' } })).toEqual(['note.text']);
      expect(await errorsFor({ timestamp, entries: [], note: { kind: 'create', text: 'x'.repeat(2001) } }))
        .toEqual(['note.text']);
      expect(await errorsFor({ timestamp, entries: [], note: { kind: 'create', text: 'x'.repeat(2000) } }))
        .toEqual([]);
      expect(await errorsFor({ timestamp, entries: [], note: { kind: 'upsert', text: 'x' } })).toEqual(['note.kind']);
      expect(await errorsFor({ timestamp, entries: [], note: { kind: 'create', text: 'x', timestamp } }))
        .toEqual(['note.timestamp']);
    });

    it('requires at least one entry or a note', async () => {
      expect(await errorsFor({ timestamp, entries: [] })).toEqual(['entries']);
      expect(await errorsFor({ timestamp, entries: [], note: null })).toEqual(['entries']);
      expect(await errorsFor({ timestamp, note: { kind: 'delete', noteId: 4 } })).toEqual(['entries']);
    });
  });
});
