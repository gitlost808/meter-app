import { describe, expect, it, vi } from 'vitest';
import { UnitsService } from './units.service';

describe('UnitsService', () => {
  it('lists meter types for a unit with pagination', async () => {
    const prisma = {
      unit: { findUnique: vi.fn().mockResolvedValue({ id: 3, name: 'Power', suffix: 'kWh' }) },
      meterType: { findMany: vi.fn().mockResolvedValue([]) },
    };
    const service = new UnitsService(prisma as never);

    await service.findMeterTypes(3, { skip: 2, take: 10 });

    expect(prisma.meterType.findMany).toHaveBeenCalledWith({
      where: { unitId: 3 },
      orderBy: { id: 'asc' },
      skip: 2,
      take: 10,
    });
  });
});
