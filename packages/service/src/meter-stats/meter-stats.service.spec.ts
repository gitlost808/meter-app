import { describe, expect, it, vi } from 'vitest';
import { MeterStatsService } from './meter-stats.service';

describe('MeterStatsService', () => {
  it('casts total_values to int so the response stays JSON-serializable', async () => {
    const prisma = {
      $queryRaw: vi.fn().mockResolvedValue([]),
    };
    const service = new MeterStatsService(prisma as never);

    await service.findAll();

    const [queryParts] = prisma.$queryRaw.mock.calls[0] as [string[]];
    const query = queryParts.join('');

    expect(query).toContain('FROM v_meter_stats');
    expect(query).toContain('total_values::int AS "totalValues"');
  });
});
