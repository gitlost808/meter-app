import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type MeterStatRow = {
  id: number;
  name: string;
  meterTypeId: number | null;
  firstValue: number | null;
  firstValueDate: Date | null;
  lastValue: number | null;
  lastValueDate: Date | null;
  totalValues: number | null;
};

@Injectable()
export class MeterStatsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(): Promise<MeterStatRow[]> {
    return this.prisma.$queryRaw<MeterStatRow[]>`
      SELECT
        id,
        name,
        meter_type_id AS "meterTypeId",
        first_value AS "firstValue",
        first_value_date AS "firstValueDate",
        last_value AS "lastValue",
        last_value_date AS "lastValueDate",
        total_values::int AS "totalValues"
      FROM v_meter_stats
      ORDER BY id ASC
    `;
  }
}
