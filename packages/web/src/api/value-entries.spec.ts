import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from './client';
import { saveValueEntries } from './value-entries';

const input = {
  timestamp: '2026-10-16T00:00:00.000Z',
  entries: [
    { meterTypeId: 1, value: { kind: 'create' as const, meterId: 10, value: 130 } },
    { meterTypeId: 2, newMeter: { kind: 'create' as const, meterName: 'water 2026-10-16', value: 0 } },
  ],
};

describe('value entries api', () => {
  beforeEach(() => {
    vi.spyOn(window, 'fetch');
  });

  it('posts the whole value entry in one request', async () => {
    vi.mocked(window.fetch).mockResolvedValue(new Response(null, { status: 204 }));

    await expect(saveValueEntries(input)).resolves.toBeUndefined();
    expect(window.fetch).toHaveBeenCalledExactlyOnceWith(
      'http://localhost:3000/api/value-entries',
      expect.objectContaining({ method: 'POST', body: JSON.stringify(input) }),
    );
  });

  it('rejects with the server status when the transaction fails', async () => {
    vi.mocked(window.fetch).mockResolvedValue(
      new Response(JSON.stringify({ message: 'Meter 10 not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await expect(saveValueEntries(input)).rejects.toMatchObject({
      name: 'ApiError',
      status: 404,
      details: { message: 'Meter 10 not found' },
    } satisfies Partial<ApiError>);
  });
});
