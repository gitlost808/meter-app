import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createValue, deleteValue, updateValue } from './values';

describe('values api', () => {
  beforeEach(() => {
    vi.spyOn(window, 'fetch');
  });

  it('creates and hydrates a value', async () => {
    vi.mocked(window.fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 1,
          value: 123,
          timestamp: '2024-01-01T00:00:00.000Z',
          meterId: 2,
        }),
        {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    const value = await createValue({
      value: 123,
      timestamp: '2024-01-01T00:00:00.000Z',
      meterId: 2,
    });

    expect(value.timestamp).toBeInstanceOf(Date);
    expect(window.fetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/values',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          value: 123,
          timestamp: '2024-01-01T00:00:00.000Z',
          meterId: 2,
        }),
      }),
    );
  });

  it('updates a value', async () => {
    vi.mocked(window.fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 3,
          value: 456,
          timestamp: '2024-01-02T00:00:00.000Z',
          meterId: 4,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    await updateValue(3, { value: 456 });

    expect(window.fetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/values/3',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ value: 456 }),
      }),
    );
  });

  it('handles delete responses without a body', async () => {
    vi.mocked(window.fetch).mockResolvedValue(new Response(null, { status: 204 }));

    await expect(deleteValue(7)).resolves.toBeUndefined();
    expect(window.fetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/values/7',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });
});
