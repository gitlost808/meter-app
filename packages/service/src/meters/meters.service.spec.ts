import { describe, expect, it, vi } from 'vitest';
import { MetersService } from './meters.service';

describe('MetersService', () => {
  it('lists values for a meter with an explicit time range', async () => {
    const prisma = {
      meter: {
        findUnique: vi.fn().mockResolvedValue({ id: 2, name: 'Main', meterTypeId: 1 }),
      },
      value: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      meterType: { findUnique: vi.fn() },
    };
    const service = new MetersService(prisma as never);

    await service.findValues(2, {
      from: '2026-01-01T00:00:00.000Z',
      to: '2026-12-31T23:59:59.999Z',
      skip: 5,
      take: 20,
    });

    expect(prisma.value.findMany).toHaveBeenCalledWith({
      where: {
        meterId: 2,
        timestamp: {
          gte: new Date('2026-01-01T00:00:00.000Z'),
          lte: new Date('2026-12-31T23:59:59.999Z'),
        },
      },
      orderBy: [{ timestamp: 'asc' }, { id: 'asc' }],
      skip: 5,
      take: 20,
    });
  });
});
