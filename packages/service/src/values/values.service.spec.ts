import { describe, expect, it, vi } from 'vitest';
import { ValuesService } from './values.service';

describe('ValuesService', () => {
  it('loads the owning meter for a value', async () => {
    const prisma = {
      value: {
        findUnique: vi.fn().mockResolvedValue({
          id: 7,
          meterId: 2,
          meter: { id: 2, name: 'Main', meterTypeId: 1 },
        }),
      },
      meter: { findUnique: vi.fn() },
    };
    const service = new ValuesService(prisma as never);

    const result = await service.findMeter(7);

    expect(result).toEqual({ id: 2, name: 'Main', meterTypeId: 1 });
  });
});
