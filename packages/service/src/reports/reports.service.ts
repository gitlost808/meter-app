import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type ReportRow = {
  id: number;
  timestamp: Date;
  meterId: number | null;
  meterTypeId: number | null;
  rawValue: number | null;
  value: number | null;
  dateDiff: number | null;
  delta: number | null;
  deltaYear: number | null;
  deltaLast4Avg: number | null;
  deltaYearAvg: number | null;
};

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async findByMeterType(
    meterTypeId: number,
    from?: string,
    to?: string,
  ): Promise<ReportRow[]> {
    const conditions: Prisma.Sql[] = [Prisma.sql`meter_type_id = ${meterTypeId}`];

    if (from) {
      conditions.push(Prisma.sql`"timestamp" >= ${new Date(from)}`);
    }

    if (to) {
      conditions.push(Prisma.sql`"timestamp" <= ${new Date(to)}`);
    }

    const whereClause = Prisma.sql`WHERE ${Prisma.join(
      conditions,
      ' AND ',
    )}`;

    // Same order as the window functions of v_value_stats: at a meter change the old meter's final
    // reading (earlier meter_first_date) comes before the new meter's first reading at the same
    // timestamp, and the value id breaks any remaining tie.
    return this.prisma.$queryRaw<ReportRow[]>(Prisma.sql`
      SELECT
        id,
        "timestamp",
        meter_id AS "meterId",
        meter_type_id AS "meterTypeId",
        raw_value AS "rawValue",
        value,
        date_diff AS "dateDiff",
        delta,
        delta_year AS "deltaYear",
        delta_last4_avg AS "deltaLast4Avg",
        delta_year_avg AS "deltaYearAvg"
      FROM v_value_stats
      ${whereClause}
      ORDER BY "timestamp" ASC, meter_first_date ASC, id ASC
    `);
  }
}
