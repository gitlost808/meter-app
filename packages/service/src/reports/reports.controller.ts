import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ReportsService } from './reports.service';

@ApiTags('reports')
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get(':meterTypeId')
  @ApiOperation({ summary: 'Get value report rows for a meter type (from v_value_stats)' })
  @ApiParam({ name: 'meterTypeId', type: Number })
  @ApiQuery({ name: 'from', required: false, type: String, description: 'ISO timestamp lower bound' })
  @ApiQuery({ name: 'to', required: false, type: String, description: 'ISO timestamp upper bound' })
  findByMeterType(
    @Param('meterTypeId', ParseIntPipe) meterTypeId: number,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.reportsService.findByMeterType(meterTypeId, from, to);
  }
}
