import { Injectable, NotFoundException } from '@nestjs/common';
import { MeterType, Unit } from '@prisma/client';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { CreateMeterTypeForUnitDto } from '../meter-types/dto/create-meter-type-for-unit.dto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUnitDto } from './dto/create-unit.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';

@Injectable()
export class UnitsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(): Promise<Unit[]> {
    return this.prisma.unit.findMany({ orderBy: { id: 'asc' } });
  }

  async findOne(id: number): Promise<Unit> {
    const unit = await this.prisma.unit.findUnique({ where: { id } });
    if (!unit) {
      throw new NotFoundException(`Unit ${id} not found`);
    }
    return unit;
  }

  async findMeterTypes(
    id: number,
    query: PaginationQueryDto,
  ): Promise<MeterType[]> {
    await this.findOne(id);
    return this.prisma.meterType.findMany({
      where: { unitId: id },
      orderBy: { id: 'asc' },
      skip: query.skip,
      take: query.take,
    });
  }

  create(dto: CreateUnitDto): Promise<Unit> {
    return this.prisma.unit.create({ data: dto });
  }

  async createMeterType(
    id: number,
    dto: CreateMeterTypeForUnitDto,
  ): Promise<MeterType> {
    await this.findOne(id);
    return this.prisma.meterType.create({
      data: {
        name: dto.name,
        unitId: id,
      },
    });
  }

  async update(id: number, dto: UpdateUnitDto): Promise<Unit> {
    await this.findOne(id);
    return this.prisma.unit.update({ where: { id }, data: dto });
  }

  async remove(id: number): Promise<void> {
    await this.findOne(id);
    await this.prisma.unit.delete({ where: { id } });
  }
}
