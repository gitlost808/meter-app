import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app.setup';
import { PrismaService } from '../../src/prisma/prisma.service';
import { requireTestDatabaseUrl } from './database';

export type IntegrationContext = {
  app: NestFastifyApplication;
  prisma: PrismaService;
};

/** Boots the real AppModule on Fastify with the production prefix and validation, auth disabled. */
export async function createIntegrationApp(): Promise<IntegrationContext> {
  requireTestDatabaseUrl();
  process.env.METER_APP_AUTH_DISABLED = 'true';

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter(), {
    logger: ['error'],
  });
  configureApp(app);
  await app.init();
  await app.getHttpAdapter().getInstance().ready();

  return { app, prisma: app.get(PrismaService) };
}

/** Empties every table and restarts the id sequences, so each test starts from the same state. */
export async function resetTables(prisma: PrismaService): Promise<void> {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE t_value, t_meter, t_meter_type, t_unit, t_note RESTART IDENTITY CASCADE',
  );
}

/** Creates a unit and one meter type per name, returning the meter type ids by name. */
export async function createMeterTypes<const N extends string>(
  prisma: PrismaService,
  names: readonly N[],
): Promise<Record<N, number>> {
  const unit = await prisma.unit.create({ data: { name: 'unit', suffix: 'u' } });
  const ids = {} as Record<N, number>;
  for (const name of names) {
    const meterType = await prisma.meterType.create({ data: { name, unitId: unit.id } });
    ids[name] = meterType.id;
  }
  return ids;
}

/** Creates a meter with readings given as [ISO timestamp, value] pairs. */
export async function createMeter(
  prisma: PrismaService,
  meterTypeId: number,
  name: string,
  readings: ReadonlyArray<readonly [string, number]> = [],
): Promise<{ meterId: number; valueIds: number[] }> {
  const meter = await prisma.meter.create({ data: { name, meterTypeId } });
  const valueIds: number[] = [];
  for (const [timestamp, value] of readings) {
    const created = await prisma.value.create({
      data: { meterId: meter.id, timestamp: new Date(timestamp), value },
    });
    valueIds.push(created.id);
  }
  return { meterId: meter.id, valueIds };
}
