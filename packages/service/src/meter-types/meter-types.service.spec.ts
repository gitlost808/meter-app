import { describe, expect, it, vi } from 'vitest';
import { MeterTypesService } from './meter-types.service';

describe('MeterTypesService', () => {
  it('creates a meter under a meter type', async () => {
    const prisma = {
      meterType: {
        findUnique: vi.fn().mockResolvedValue({ id: 4, name: 'Water', unitId: 1 }),
      },
      meter: {
        create: vi.fn().mockResolvedValue({ id: 9, name: 'Kitchen', meterTypeId: 4 }),
      },
      unit: { findUnique: vi.fn() },
    };
    const service = new MeterTypesService(prisma as never);

    await service.createMeter(4, { name: 'Kitchen' });

    expect(prisma.meter.create).toHaveBeenCalledWith({
      data: {
        name: 'Kitchen',
        meterTypeId: 4,
      },
    });
  });
});
