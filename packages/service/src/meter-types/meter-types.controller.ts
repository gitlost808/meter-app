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
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { CreateMeterForMeterTypeDto } from '../meters/dto/create-meter-for-meter-type.dto';
import { CreateMeterTypeDto } from './dto/create-meter-type.dto';
import { UpdateMeterTypeDto } from './dto/update-meter-type.dto';
import { MeterTypesService } from './meter-types.service';

@ApiTags('meter-types')
@Controller('meter-types')
export class MeterTypesController {
  constructor(private readonly meterTypesService: MeterTypesService) {}

  @Get()
  @ApiOperation({ summary: 'List meter types' })
  findAll() {
    return this.meterTypesService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a meter type by ID' })
  @ApiParam({ name: 'id', type: Number })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.meterTypesService.findOne(id);
  }

  @Get(':id/unit')
  @ApiOperation({ summary: 'Get the unit belonging to a meter type' })
  @ApiParam({ name: 'id', type: Number })
  findUnit(@Param('id', ParseIntPipe) id: number) {
    return this.meterTypesService.findUnit(id);
  }

  @Get(':id/meters')
  @ApiOperation({ summary: 'List meters belonging to a meter type' })
  @ApiParam({ name: 'id', type: Number })
  findMeters(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: PaginationQueryDto,
  ) {
    return this.meterTypesService.findMeters(id, query);
  }

  @Post()
  @ApiOperation({ summary: 'Create a meter type' })
  create(@Body() dto: CreateMeterTypeDto) {
    return this.meterTypesService.create(dto);
  }

  @Post(':id/meters')
  @ApiOperation({ summary: 'Create a meter for a meter type' })
  @ApiParam({ name: 'id', type: Number })
  createMeter(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateMeterForMeterTypeDto,
  ) {
    return this.meterTypesService.createMeter(id, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a meter type' })
  @ApiParam({ name: 'id', type: Number })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateMeterTypeDto) {
    return this.meterTypesService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a meter type' })
  @ApiParam({ name: 'id', type: Number })
  async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.meterTypesService.remove(id);
  }
}
