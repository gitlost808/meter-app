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
import { CreateMeterTypeForUnitDto } from '../meter-types/dto/create-meter-type-for-unit.dto';
import { CreateUnitDto } from './dto/create-unit.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';
import { UnitsService } from './units.service';

@ApiTags('units')
@Controller('units')
export class UnitsController {
  constructor(private readonly unitsService: UnitsService) {}

  @Get()
  @ApiOperation({ summary: 'List units' })
  findAll() {
    return this.unitsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a unit by ID' })
  @ApiParam({ name: 'id', type: Number })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.unitsService.findOne(id);
  }

  @Get(':id/meter-types')
  @ApiOperation({ summary: 'List meter types belonging to a unit' })
  @ApiParam({ name: 'id', type: Number })
  findMeterTypes(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: PaginationQueryDto,
  ) {
    return this.unitsService.findMeterTypes(id, query);
  }

  @Post()
  @ApiOperation({ summary: 'Create a unit' })
  create(@Body() dto: CreateUnitDto) {
    return this.unitsService.create(dto);
  }

  @Post(':id/meter-types')
  @ApiOperation({ summary: 'Create a meter type for a unit' })
  @ApiParam({ name: 'id', type: Number })
  createMeterType(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateMeterTypeForUnitDto,
  ) {
    return this.unitsService.createMeterType(id, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a unit' })
  @ApiParam({ name: 'id', type: Number })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateUnitDto) {
    return this.unitsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a unit' })
  @ApiParam({ name: 'id', type: Number })
  async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.unitsService.remove(id);
  }
}
