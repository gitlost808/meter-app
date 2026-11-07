import { Module } from '@nestjs/common';
import { MeterStatsController } from './meter-stats.controller';
import { MeterStatsService } from './meter-stats.service';

@Module({
  controllers: [MeterStatsController],
  providers: [MeterStatsService],
})
export class MeterStatsModule {}
