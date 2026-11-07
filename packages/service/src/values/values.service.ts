import { Injectable, NotFoundException } from '@nestjs/common';
import { Meter, Value } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateValueDto } from './dto/create-value.dto';
import { UpdateValueDto } from './dto/update-value.dto';
import { rethrowOneValuePerDay } from './one-value-per-day';

@Injectable()
export class ValuesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(): Promise<Value[]> {
    return this.prisma.value.findMany({
      orderBy: [{ timestamp: 'desc' }, { id: 'desc' }],
      take: 200,
    });
  }

  async findOne(id: number): Promise<Value> {
    const value = await this.prisma.value.findUnique({ where: { id } });
    if (!value) {
      throw new NotFoundException(`Value ${id} not found`);
    }
    return value;
  }

  async findMeter(id: number): Promise<Meter> {
    const value = await this.prisma.value.findUnique({
      where: { id },
      include: { meter: true },
    });
    if (!value) {
      throw new NotFoundException(`Value ${id} not found`);
    }
    if (!value.meter) {
      throw new NotFoundException(`Meter for Value ${id} not found`);
    }
    return value.meter;
  }

  async create(dto: CreateValueDto): Promise<Value> {
    await this.ensureMeterExists(dto.meterId);
    const timestamp = new Date(dto.timestamp);
    return this.prisma.value
      .create({
        data: {
          value: dto.value,
          timestamp,
          meterId: dto.meterId,
        },
      })
      .catch((error: unknown) => rethrowOneValuePerDay(error, dto.meterId, timestamp));
  }

  async update(id: number, dto: UpdateValueDto): Promise<Value> {
    const existing = await this.findOne(id);
    if (dto.meterId !== undefined) {
      await this.ensureMeterExists(dto.meterId);
    }

    const timestamp = dto.timestamp ? new Date(dto.timestamp) : undefined;
    return this.prisma.value
      .update({
        where: { id },
        data: {
          value: dto.value,
          timestamp,
          meterId: dto.meterId,
        },
      })
      .catch((error: unknown) =>
        rethrowOneValuePerDay(error, dto.meterId ?? existing.meterId, timestamp ?? existing.timestamp),
      );
  }

  async remove(id: number): Promise<void> {
    await this.findOne(id);
    await this.prisma.value.delete({ where: { id } });
  }

  private async ensureMeterExists(meterId: number): Promise<void> {
    const meter = await this.prisma.meter.findUnique({ where: { id: meterId } });
    if (!meter) {
      throw new NotFoundException(`Meter ${meterId} not found`);
    }
  }
}
