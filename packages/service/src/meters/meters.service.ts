import { Injectable, NotFoundException } from '@nestjs/common';
import { Meter, MeterType, Prisma, Value } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateValueForMeterDto } from '../values/dto/create-value-for-meter.dto';
import { rethrowOneValuePerDay } from '../values/one-value-per-day';
import { ValueListQueryDto } from '../values/dto/value-list-query.dto';
import { CreateMeterDto } from './dto/create-meter.dto';
import { UpdateMeterDto } from './dto/update-meter.dto';

@Injectable()
export class MetersService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(): Promise<Meter[]> {
    return this.prisma.meter.findMany({ orderBy: { id: 'asc' } });
  }

  async findOne(id: number): Promise<Meter> {
    const meter = await this.prisma.meter.findUnique({ where: { id } });
    if (!meter) {
      throw new NotFoundException(`Meter ${id} not found`);
    }
    return meter;
  }

  async findMeterType(id: number): Promise<MeterType> {
    const meter = await this.prisma.meter.findUnique({
      where: { id },
      include: { meterType: true },
    });
    if (!meter) {
      throw new NotFoundException(`Meter ${id} not found`);
    }
    if (!meter.meterType) {
      throw new NotFoundException(`MeterType for Meter ${id} not found`);
    }
    return meter.meterType;
  }

  async findValues(id: number, query: ValueListQueryDto): Promise<Value[]> {
    await this.findOne(id);

    const where: Prisma.ValueWhereInput = {
      meterId: id,
    };

    if (query.from || query.to) {
      where.timestamp = {};
      if (query.from) {
        where.timestamp.gte = new Date(query.from);
      }
      if (query.to) {
        where.timestamp.lte = new Date(query.to);
      }
    }

    return this.prisma.value.findMany({
      where,
      orderBy: [{ timestamp: 'asc' }, { id: 'asc' }],
      skip: query.skip,
      take: query.take,
    });
  }

  async create(dto: CreateMeterDto): Promise<Meter> {
    await this.ensureMeterTypeExists(dto.meterTypeId);
    return this.prisma.meter.create({
      data: {
        name: dto.name,
        meterTypeId: dto.meterTypeId,
      },
    });
  }

  async createValue(id: number, dto: CreateValueForMeterDto): Promise<Value> {
    await this.findOne(id);
    const timestamp = new Date(dto.timestamp);
    return this.prisma.value
      .create({
        data: {
          value: dto.value,
          timestamp,
          meterId: id,
        },
      })
      .catch((error: unknown) => rethrowOneValuePerDay(error, id, timestamp));
  }

  async update(id: number, dto: UpdateMeterDto): Promise<Meter> {
    await this.findOne(id);
    if (dto.meterTypeId !== undefined) {
      await this.ensureMeterTypeExists(dto.meterTypeId);
    }

    return this.prisma.meter.update({
      where: { id },
      data: {
        name: dto.name,
        meterTypeId: dto.meterTypeId,
      },
    });
  }

  async remove(id: number): Promise<void> {
    await this.findOne(id);
    await this.prisma.meter.delete({ where: { id } });
  }

  private async ensureMeterTypeExists(meterTypeId: number): Promise<void> {
    const meterType = await this.prisma.meterType.findUnique({ where: { id: meterTypeId } });
    if (!meterType) {
      throw new NotFoundException(`MeterType ${meterTypeId} not found`);
    }
  }
}
