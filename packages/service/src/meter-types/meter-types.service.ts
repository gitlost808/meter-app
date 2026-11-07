import { Injectable, NotFoundException } from '@nestjs/common';
import { Meter, MeterType, Unit } from '@prisma/client';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { CreateMeterForMeterTypeDto } from '../meters/dto/create-meter-for-meter-type.dto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMeterTypeDto } from './dto/create-meter-type.dto';
import { UpdateMeterTypeDto } from './dto/update-meter-type.dto';

@Injectable()
export class MeterTypesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(): Promise<MeterType[]> {
    return this.prisma.meterType.findMany({ orderBy: { id: 'asc' } });
  }

  async findOne(id: number): Promise<MeterType> {
    const meterType = await this.prisma.meterType.findUnique({ where: { id } });
    if (!meterType) {
      throw new NotFoundException(`MeterType ${id} not found`);
    }
    return meterType;
  }

  async findUnit(id: number): Promise<Unit> {
    const meterType = await this.prisma.meterType.findUnique({
      where: { id },
      include: { unit: true },
    });
    if (!meterType) {
      throw new NotFoundException(`MeterType ${id} not found`);
    }
    if (!meterType.unit) {
      throw new NotFoundException(`Unit for MeterType ${id} not found`);
    }
    return meterType.unit;
  }

  async findMeters(
    id: number,
    query: PaginationQueryDto,
  ): Promise<Meter[]> {
    await this.findOne(id);
    return this.prisma.meter.findMany({
      where: { meterTypeId: id },
      orderBy: { id: 'asc' },
      skip: query.skip,
      take: query.take,
    });
  }

  async create(dto: CreateMeterTypeDto): Promise<MeterType> {
    await this.ensureUnitExists(dto.unitId);
    return this.prisma.meterType.create({
      data: {
        name: dto.name,
        unitId: dto.unitId,
      },
    });
  }

  async createMeter(
    id: number,
    dto: CreateMeterForMeterTypeDto,
  ): Promise<Meter> {
    await this.findOne(id);
    return this.prisma.meter.create({
      data: {
        name: dto.name,
        meterTypeId: id,
      },
    });
  }

  async update(id: number, dto: UpdateMeterTypeDto): Promise<MeterType> {
    await this.findOne(id);
    if (dto.unitId !== undefined) {
      await this.ensureUnitExists(dto.unitId);
    }
    return this.prisma.meterType.update({
      where: { id },
      data: {
        name: dto.name,
        unitId: dto.unitId,
      },
    });
  }

  async remove(id: number): Promise<void> {
    await this.findOne(id);
    await this.prisma.meterType.delete({ where: { id } });
  }

  private async ensureUnitExists(unitId: number): Promise<void> {
    const unit = await this.prisma.unit.findUnique({ where: { id: unitId } });
    if (!unit) {
      throw new NotFoundException(`Unit ${unitId} not found`);
    }
  }
}
