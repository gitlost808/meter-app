import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiConflictResponse, ApiCreatedResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { ONE_VALUE_PER_DAY_CONFLICT } from '../values/one-value-per-day';
import { CreateValueForMeterDto } from '../values/dto/create-value-for-meter.dto';
import { ValueListQueryDto } from '../values/dto/value-list-query.dto';
import { CreateMeterDto } from './dto/create-meter.dto';
import { UpdateMeterDto } from './dto/update-meter.dto';
import { MetersService } from './meters.service';

@ApiTags('meters')
@Controller('meters')
export class MetersController {
  constructor(private readonly metersService: MetersService) {}

  @Get()
  @ApiOperation({ summary: 'List meters' })
  findAll() {
    return this.metersService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a meter by ID' })
  @ApiParam({ name: 'id', type: Number })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.metersService.findOne(id);
  }

  @Get(':id/meter-type')
  @ApiOperation({ summary: 'Get the meter type belonging to a meter' })
  @ApiParam({ name: 'id', type: Number })
  findMeterType(@Param('id', ParseIntPipe) id: number) {
    return this.metersService.findMeterType(id);
  }

  @Get(':id/values')
  @ApiOperation({ summary: 'List values belonging to a meter' })
  @ApiParam({ name: 'id', type: Number })
  findValues(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: ValueListQueryDto,
  ) {
    return this.metersService.findValues(id, query);
  }

  @Post()
  @ApiOperation({ summary: 'Create a meter' })
  create(@Body() dto: CreateMeterDto) {
    return this.metersService.create(dto);
  }

  @Post(':id/values')
  @ApiOperation({ summary: 'Create a value for a meter' })
  @ApiCreatedResponse({ description: 'The created value' })
  @ApiConflictResponse({ description: ONE_VALUE_PER_DAY_CONFLICT })
  @ApiParam({ name: 'id', type: Number })
  createValue(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateValueForMeterDto,
  ) {
    return this.metersService.createValue(id, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a meter' })
  @ApiParam({ name: 'id', type: Number })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateMeterDto) {
    return this.metersService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a meter' })
  @ApiParam({ name: 'id', type: Number })
  async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.metersService.remove(id);
  }
}
