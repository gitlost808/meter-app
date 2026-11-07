import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { JwtStrategy } from './auth/jwt.strategy';
import { WriteAccessGuard } from './auth/write-access.guard';
import { HealthController } from './health/health.controller';
import { MeterTypesModule } from './meter-types/meter-types.module';
import { MeterStatsModule } from './meter-stats/meter-stats.module';
import { MetersModule } from './meters/meters.module';
import { NotesModule } from './notes/notes.module';
import { PrismaModule } from './prisma/prisma.module';
import { ReportsModule } from './reports/reports.module';
import { UnitsModule } from './units/units.module';
import { ValueEntriesModule } from './value-entries/value-entries.module';
import { ValuesModule } from './values/values.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    UnitsModule,
    MeterTypesModule,
    MeterStatsModule,
    MetersModule,
    ValuesModule,
    ValueEntriesModule,
    NotesModule,
    ReportsModule,
  ],
  controllers: [HealthController],
  providers: [
    JwtStrategy,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: WriteAccessGuard,
    },
  ],
})
export class AppModule {}
