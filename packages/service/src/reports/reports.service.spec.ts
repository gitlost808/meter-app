import type { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { ReportsService } from './reports.service';

describe('ReportsService', () => {
  it('orders rows like the windows of v_value_stats, so a meter change has a fixed order', async () => {
    const prisma = {
      $queryRaw: vi.fn().mockResolvedValue([]),
    };
    const service = new ReportsService(prisma as never);

    await service.findByMeterType(2);

    const [query] = prisma.$queryRaw.mock.calls[0] as [Prisma.Sql];
    const sql = query.text.replace(/\s+/g, ' ');

    expect(sql).toContain('FROM v_value_stats');
    expect(sql).toContain('WHERE meter_type_id = $1');
    // At a shared timestamp the old meter's final reading (earlier meter_first_date) comes first;
    // the value id breaks any remaining tie. A bare ORDER BY "timestamp" leaves that order undefined.
    expect(sql).toMatch(/ORDER BY "timestamp" ASC, meter_first_date ASC, id ASC\s*$/);
    expect(query.values).toEqual([2]);
  });
});
