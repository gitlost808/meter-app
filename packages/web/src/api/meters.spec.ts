import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMeter, deleteMeter, listMeterStats } from './meters';

describe('meters api', () => {
  beforeEach(() => {
    vi.spyOn(window, 'fetch');
  });

  it('loads meter stats', async () => {
    vi.mocked(window.fetch).mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            id: 1,
            name: 'Strom 1',
            meterTypeId: 2,
            firstValue: 10,
            firstValueDate: '2024-01-01T00:00:00.000Z',
            lastValue: 20,
            lastValueDate: '2024-02-01T00:00:00.000Z',
            totalValues: 3,
          },
        ]),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    await expect(listMeterStats()).resolves.toEqual([
      {
        id: 1,
        name: 'Strom 1',
        meterTypeId: 2,
        firstValue: 10,
        firstValueDate: '2024-01-01T00:00:00.000Z',
        lastValue: 20,
        lastValueDate: '2024-02-01T00:00:00.000Z',
        totalValues: 3,
      },
    ]);
    expect(window.fetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/meter-stats',
      expect.objectContaining({
        body: undefined,
        headers: expect.any(Headers),
      }),
    );
  });

  it('creates a meter with a json body', async () => {
    vi.mocked(window.fetch).mockResolvedValue(
      new Response(JSON.stringify({ id: 3, name: 'Gas 1', meterTypeId: 4 }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await createMeter({ name: 'Gas 1', meterTypeId: 4 });

    expect(window.fetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/meters',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: 'Gas 1', meterTypeId: 4 }),
      }),
    );
  });

  it('handles delete responses without a body', async () => {
    vi.mocked(window.fetch).mockResolvedValue(new Response(null, { status: 204 }));

    await expect(deleteMeter(7)).resolves.toBeUndefined();
    expect(window.fetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/meters/7',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });
});
