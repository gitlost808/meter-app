import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createUnit, deleteUnit, listUnits } from './units';

describe('units api', () => {
  beforeEach(() => {
    vi.spyOn(window, 'fetch');
  });

  it('loads units', async () => {
    vi.mocked(window.fetch).mockResolvedValue(
      new Response(JSON.stringify([{ id: 1, name: 'Strom', suffix: 'kWh' }]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await expect(listUnits()).resolves.toEqual([
      { id: 1, name: 'Strom', suffix: 'kWh' },
    ]);
    expect(window.fetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/units',
      expect.objectContaining({
        body: undefined,
        headers: expect.any(Headers),
      }),
    );
  });

  it('creates a unit with a json body', async () => {
    vi.mocked(window.fetch).mockResolvedValue(
      new Response(JSON.stringify({ id: 3, name: 'Gas', suffix: 'm3' }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await createUnit({ name: 'Gas', suffix: 'm3' });

    expect(window.fetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/units',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: 'Gas', suffix: 'm3' }),
      }),
    );
  });

  it('handles delete responses without a body', async () => {
    vi.mocked(window.fetch).mockResolvedValue(new Response(null, { status: 204 }));

    await expect(deleteUnit(7)).resolves.toBeUndefined();
    expect(window.fetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/units/7',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });
});
