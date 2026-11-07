import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { rethrowOneValuePerDay } from './one-value-per-day';

// Error shapes as Prisma reports them with the pg driver adapter.
function uniqueViolation(index: string) {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: 'test',
    meta: {
      driverAdapterError: {
        name: 'DriverAdapterError',
        cause: { originalCode: '23505', kind: 'UniqueConstraintViolation', constraint: { index }, table: 't_value' },
      },
      modelName: 'Value',
    },
  });
}

const timestamp = new Date('2024-06-01T18:30:00.000Z');

describe('rethrowOneValuePerDay', () => {
  it('turns a violation of the one-reading-per-day index into 409 with meter and UTC day', () => {
    expect(() => rethrowOneValuePerDay(uniqueViolation('ux_t_value_meter_day'), 3, timestamp))
      .toThrow(new ConflictException('Meter 3 already has a reading on 2024-06-01'));
  });

  it('rethrows other errors unchanged', () => {
    const primaryKey = uniqueViolation('t_value_pkey');
    const other = new Error('connection lost');

    expect(() => rethrowOneValuePerDay(primaryKey, 3, timestamp)).toThrow(primaryKey);
    expect(() => rethrowOneValuePerDay(other, 3, timestamp)).toThrow(other);
  });
});
