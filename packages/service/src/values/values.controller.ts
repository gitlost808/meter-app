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
} from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { CreateValueDto } from './dto/create-value.dto';
import { UpdateValueDto } from './dto/update-value.dto';
import { ONE_VALUE_PER_DAY_CONFLICT } from './one-value-per-day';
import { ValuesService } from './values.service';

@ApiTags('values')
@Controller('values')
export class ValuesController {
  constructor(private readonly valuesService: ValuesService) {}

  @Get()
  @ApiOperation({ summary: 'List values (latest first)' })
  findAll() {
    return this.valuesService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a value by ID' })
  @ApiParam({ name: 'id', type: Number })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.valuesService.findOne(id);
  }

  @Get(':id/meter')
  @ApiOperation({ summary: 'Get the meter belonging to a value' })
  @ApiParam({ name: 'id', type: Number })
  findMeter(@Param('id', ParseIntPipe) id: number) {
    return this.valuesService.findMeter(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a value' })
  @ApiCreatedResponse({ description: 'The created value' })
  @ApiConflictResponse({ description: ONE_VALUE_PER_DAY_CONFLICT })
  create(@Body() dto: CreateValueDto) {
    return this.valuesService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a value' })
  @ApiOkResponse({ description: 'The updated value' })
  @ApiConflictResponse({ description: ONE_VALUE_PER_DAY_CONFLICT })
  @ApiParam({ name: 'id', type: Number })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateValueDto) {
    return this.valuesService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a value' })
  @ApiParam({ name: 'id', type: Number })
  async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.valuesService.remove(id);
  }
}
