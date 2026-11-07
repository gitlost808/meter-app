import { beforeEach, describe, expect, it, vi } from 'vitest';
import { listReportRows } from './reports';

describe('reports api', () => {
  beforeEach(() => {
    vi.spyOn(window, 'fetch');
  });

  it('loads and hydrates report rows', async () => {
    vi.mocked(window.fetch).mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            id: 1,
            timestamp: '2024-01-01T00:00:00.000Z',
            meterId: 3,
            meterTypeId: 2,
            rawValue: 123,
            value: 123,
            dateDiff: 30,
            delta: 10,
            deltaYear: 120,
            deltaLast4Avg: 118,
            deltaYearAvg: 121,
          },
        ]),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    const rows = await listReportRows(2);

    expect(rows).toHaveLength(1);
    expect(rows[0]?.timestamp).toBeInstanceOf(Date);
    expect(rows[0]?.meterTypeId).toBe(2);
    expect(window.fetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/reports/2',
      expect.objectContaining({
        body: undefined,
        headers: expect.any(Headers),
      }),
    );
  });
});
