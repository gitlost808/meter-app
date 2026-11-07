import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createNote, deleteNote, listNotes, updateNote } from './notes';

describe('notes api', () => {
  beforeEach(() => {
    vi.spyOn(window, 'fetch');
  });

  it('loads and hydrates notes', async () => {
    vi.mocked(window.fetch).mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            id: 1,
            text: 'Check done',
            timestamp: '2024-01-01T00:00:00.000Z',
          },
        ]),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    const notes = await listNotes('2024-01-01T00:00:00.000Z', '2024-12-31T00:00:00.000Z');

    expect(notes[0]?.timestamp).toBeInstanceOf(Date);
    expect(window.fetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/notes?from=2024-01-01T00%3A00%3A00.000Z&to=2024-12-31T00%3A00%3A00.000Z',
      expect.objectContaining({
        body: undefined,
        headers: expect.any(Headers),
      }),
    );
  });

  it('creates and updates notes', async () => {
    vi.mocked(window.fetch)
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 2,
            text: 'Created',
            timestamp: '2024-02-01T00:00:00.000Z',
          }),
          {
            status: 201,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 2,
            text: 'Updated',
            timestamp: '2024-02-02T00:00:00.000Z',
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      );

    await createNote({
      text: 'Created',
      timestamp: '2024-02-01T00:00:00.000Z',
    });
    await updateNote(2, {
      text: 'Updated',
    });

    expect(window.fetch).toHaveBeenNthCalledWith(
      1,
      'http://localhost:3000/api/notes',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          text: 'Created',
          timestamp: '2024-02-01T00:00:00.000Z',
        }),
      }),
    );
    expect(window.fetch).toHaveBeenNthCalledWith(
      2,
      'http://localhost:3000/api/notes/2',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({
          text: 'Updated',
        }),
      }),
    );
  });

  it('handles delete responses without a body', async () => {
    vi.mocked(window.fetch).mockResolvedValue(new Response(null, { status: 204 }));

    await expect(deleteNote(7)).resolves.toBeUndefined();
    expect(window.fetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/notes/7',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });
});
