import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiConflictResponse, ApiNoContentResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ONE_VALUE_PER_DAY_CONFLICT } from '../values/one-value-per-day';
import { SaveValueEntriesDto } from './dto/save-value-entries.dto';
import { ValueEntriesService } from './value-entries.service';

@ApiTags('value-entries')
@Controller('value-entries')
export class ValueEntriesController {
  constructor(private readonly valueEntriesService: ValueEntriesService) {}

  @Post()
  @HttpCode(204)
  @ApiOperation({ summary: 'Save the values of one day for several meter types and the note of that day in a single transaction' })
  @ApiNoContentResponse({ description: 'All writes were stored' })
  @ApiConflictResponse({ description: `${ONE_VALUE_PER_DAY_CONFLICT}; nothing of the request is stored` })
  async save(@Body() dto: SaveValueEntriesDto): Promise<void> {
    await this.valueEntriesService.save(dto);
  }
}
