import type { components } from '@shared-api';
import { apiRequest } from './client';

export type SaveValueEntriesInput = components['schemas']['SaveValueEntriesDto'];
export type ValueEntryInput = components['schemas']['ValueEntryDto'];
export type NoteWriteInput = components['schemas']['NoteWriteDto'];

/** Saves all meter types and the note of one value entry in a single server-side transaction. */
export function saveValueEntries(input: SaveValueEntriesInput): Promise<void> {
  return apiRequest<void>('/api/value-entries', {
    method: 'POST',
    body: input,
  });
}
