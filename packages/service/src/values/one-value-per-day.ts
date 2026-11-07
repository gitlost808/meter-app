import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

/**
 * Unique index on t_value (meter_id, UTC day) from docker/db/sql/app/04_unique_value_per_day.sql:
 * readings are daily values, so a meter has at most one reading per day.
 */
export const ONE_VALUE_PER_DAY_INDEX = 'ux_t_value_meter_day';

/** Swagger description of the 409 response of endpoints that write readings. */
export const ONE_VALUE_PER_DAY_CONFLICT = 'The meter already has a reading on that day (one reading per meter and UTC day)';

function isOneValuePerDayViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002' &&
    // With the pg driver adapter, Prisma names the violated index in
    // meta.driverAdapterError.cause.constraint.index; other unique violations pass through.
    JSON.stringify(error.meta ?? {}).includes(`"${ONE_VALUE_PER_DAY_INDEX}"`)
  );
}

/**
 * Rethrows a violation of the one-reading-per-day rule as 409 Conflict; any other error unchanged.
 */
export function rethrowOneValuePerDay(error: unknown, meterId: number | null, timestamp: Date): never {
  if (isOneValuePerDayViolation(error)) {
    const day = timestamp.toISOString().slice(0, 10);
    throw new ConflictException(`Meter ${meterId} already has a reading on ${day}`);
  }
  throw error;
}
