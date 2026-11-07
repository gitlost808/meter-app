import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { MeterStatsService } from './meter-stats.service';

@ApiTags('meter-stats')
@Controller('meter-stats')
export class MeterStatsController {
  constructor(private readonly meterStatsService: MeterStatsService) {}

  @Get()
  @ApiOperation({ summary: 'List meter stats from v_meter_stats' })
  findAll() {
    return this.meterStatsService.findAll();
  }
}
