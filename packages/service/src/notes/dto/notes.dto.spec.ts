import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { ListNotesQueryDto } from './list-notes-query.dto';
import { UpdateNoteDto } from './update-note.dto';

// Same options as the global ValidationPipe in main.ts.
async function invalidProperties(cls: new () => object, plain: unknown): Promise<string[]> {
  const errors = await validate(plainToInstance(cls, plain), { whitelist: true, forbidNonWhitelisted: true });
  return errors.map((error) => error.property);
}

const timestamp = '2026-03-05T12:00:00.000Z';

describe('ListNotesQueryDto', () => {
  it('accepts no filters, one bound or both bounds', async () => {
    expect(await invalidProperties(ListNotesQueryDto, {})).toEqual([]);
    expect(await invalidProperties(ListNotesQueryDto, { from: timestamp })).toEqual([]);
    expect(await invalidProperties(ListNotesQueryDto, { from: '2026-01-01', to: timestamp })).toEqual([]);
  });

  it('rejects malformed dates and unknown parameters', async () => {
    expect(await invalidProperties(ListNotesQueryDto, { from: 'abc', to: 'yesterday' })).toEqual(['from', 'to']);
    expect(await invalidProperties(ListNotesQueryDto, { page: '1' })).toEqual(['page']);
  });
});

describe('UpdateNoteDto', () => {
  it('accepts partial updates', async () => {
    expect(await invalidProperties(UpdateNoteDto, {})).toEqual([]);
    expect(await invalidProperties(UpdateNoteDto, { text: 'Edited' })).toEqual([]);
    expect(await invalidProperties(UpdateNoteDto, { timestamp })).toEqual([]);
    expect(await invalidProperties(UpdateNoteDto, { text: 'Edited', timestamp })).toEqual([]);
  });

  it('rejects null for text and timestamp', async () => {
    expect(await invalidProperties(UpdateNoteDto, { text: null })).toEqual(['text']);
    expect(await invalidProperties(UpdateNoteDto, { timestamp: null })).toEqual(['timestamp']);
  });

  it('keeps the create validation rules', async () => {
    expect(await invalidProperties(UpdateNoteDto, { text: '', timestamp: 'yesterday' })).toEqual(['text', 'timestamp']);
    expect(await invalidProperties(UpdateNoteDto, { text: 'x'.repeat(2001) })).toEqual(['text']);
  });
});
