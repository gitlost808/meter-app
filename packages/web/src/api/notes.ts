import { apiRequest } from './client';
import type { components } from '@shared-api';

export type Note = {
  id: number;
  text: string;
  timestamp: Date;
};

type NoteResponse = Omit<Note, 'timestamp'> & {
  timestamp: string;
};

function hydrateNote(note: NoteResponse): Note {
  return {
    ...note,
    timestamp: new Date(note.timestamp),
  };
}

export type CreateNoteInput = components['schemas']['CreateNoteDto'];
export type UpdateNoteInput = components['schemas']['UpdateNoteDto'];

export async function listNotes(from?: string, to?: string): Promise<Note[]> {
  const notes = await apiRequest<NoteResponse[]>('/api/notes', {
    query: { from, to },
  });
  return notes.map(hydrateNote);
}

export async function createNote(input: CreateNoteInput): Promise<Note> {
  const note = await apiRequest<NoteResponse>('/api/notes', {
    method: 'POST',
    body: input,
  });
  return hydrateNote(note);
}

export async function updateNote(id: number, input: UpdateNoteInput): Promise<Note> {
  const note = await apiRequest<NoteResponse>(`/api/notes/${id}`, {
    method: 'PATCH',
    body: input,
  });
  return hydrateNote(note);
}

export function deleteNote(id: number): Promise<void> {
  return apiRequest<void>(`/api/notes/${id}`, {
    method: 'DELETE',
  });
}
