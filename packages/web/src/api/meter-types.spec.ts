import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createMeterType,
  deleteMeterType,
  listMeterTypes,
} from './meter-types';

describe('meter-types api', () => {
  beforeEach(() => {
    vi.spyOn(window, 'fetch');
  });

  it('loads meter types', async () => {
    vi.mocked(window.fetch).mockResolvedValue(
      new Response(JSON.stringify([{ id: 1, name: 'Strom', unitId: 2 }]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await expect(listMeterTypes()).resolves.toEqual([
      { id: 1, name: 'Strom', unitId: 2 },
    ]);
    expect(window.fetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/meter-types',
      expect.objectContaining({
        body: undefined,
        headers: expect.any(Headers),
      }),
    );
  });

  it('creates a meter type with a json body', async () => {
    vi.mocked(window.fetch).mockResolvedValue(
      new Response(JSON.stringify({ id: 3, name: 'Gas', unitId: 4 }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await createMeterType({ name: 'Gas', unitId: 4 });

    expect(window.fetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/meter-types',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: 'Gas', unitId: 4 }),
      }),
    );
  });

  it('handles delete responses without a body', async () => {
    vi.mocked(window.fetch).mockResolvedValue(new Response(null, { status: 204 }));

    await expect(deleteMeterType(7)).resolves.toBeUndefined();
    expect(window.fetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/meter-types/7',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });
});
