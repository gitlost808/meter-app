import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { rethrowOneValuePerDay } from '../values/one-value-per-day';
import {
  NewMeterWriteDto,
  NoteWriteDto,
  SaveValueEntriesDto,
  ValueEntryDto,
  ValueWriteDto,
} from './dto/save-value-entries.dto';

type Tx = Prisma.TransactionClient;

function required<T>(value: T | undefined, field: string): T {
  if (value === undefined) {
    throw new BadRequestException(`${field} is required`);
  }
  return value;
}

@Injectable()
export class ValueEntriesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Saves all meter types and the note of one value entry in a single
   * transaction, so either every write is stored or none is.
   */
  async save(dto: SaveValueEntriesDto): Promise<void> {
    this.assertUniqueMeterTypes(dto.entries);
    const timestamp = new Date(dto.timestamp);

    await this.prisma.$transaction(async (tx) => {
      for (const entry of dto.entries) {
        if (entry.value) {
          await this.writeValue(tx, entry.meterTypeId, entry.value, timestamp);
        }
        if (entry.newMeter) {
          await this.writeNewMeter(tx, entry.meterTypeId, entry.newMeter, timestamp);
        }
      }
      if (dto.note) {
        await this.writeNote(tx, dto.note, timestamp);
      }
    });
  }

  private assertUniqueMeterTypes(entries: ValueEntryDto[]): void {
    const seen = new Set<number>();
    for (const { meterTypeId } of entries) {
      if (seen.has(meterTypeId)) {
        throw new BadRequestException(`Meter type ${meterTypeId} appears more than once`);
      }
      seen.add(meterTypeId);
    }
  }

  private async writeValue(
    tx: Tx,
    meterTypeId: number,
    write: ValueWriteDto,
    timestamp: Date,
  ): Promise<void> {
    if (write.kind === 'update') {
      await this.updateValueOfMeterType(tx, meterTypeId, required(write.valueId, 'value.valueId'), write.value);
      return;
    }

    const meterId = required(write.meterId, 'value.meterId');
    const value = required(write.value, 'value.value');
    await this.assertMeterOfMeterType(tx, meterId, meterTypeId);
    // A conflict aborts the transaction, so earlier writes of this request are rolled back.
    await tx.value
      .create({ data: { value, timestamp, meterId } })
      .catch((error: unknown) => rethrowOneValuePerDay(error, meterId, timestamp));
  }

  private async writeNewMeter(
    tx: Tx,
    meterTypeId: number,
    write: NewMeterWriteDto,
    timestamp: Date,
  ): Promise<void> {
    if (write.kind === 'update') {
      await this.updateValueOfMeterType(tx, meterTypeId, required(write.valueId, 'newMeter.valueId'), write.value);
      return;
    }

    const meterName = required(write.meterName, 'newMeter.meterName');
    const value = required(write.value, 'newMeter.value');
    const meterType = await tx.meterType.findUnique({ where: { id: meterTypeId } });
    if (!meterType) {
      throw new NotFoundException(`Meter type ${meterTypeId} not found`);
    }

    const meter = await tx.meter.create({ data: { name: meterName, meterTypeId } });
    await tx.value.create({ data: { value, timestamp, meterId: meter.id } });
  }

  private async writeNote(tx: Tx, write: NoteWriteDto, timestamp: Date): Promise<void> {
    if (write.kind === 'create') {
      const text = required(write.text, 'note.text');
      await tx.note.create({ data: { text, timestamp } });
      return;
    }

    const noteId = required(write.noteId, 'note.noteId');
    const existing = await tx.note.findUnique({ where: { id: noteId } });
    if (!existing) {
      throw new NotFoundException(`Note ${noteId} not found`);
    }
    if (existing.timestamp.getTime() !== timestamp.getTime()) {
      throw new BadRequestException(`Note ${noteId} does not belong to ${timestamp.toISOString()}`);
    }

    if (write.kind === 'update') {
      await tx.note.update({ where: { id: noteId }, data: { text: required(write.text, 'note.text') } });
      return;
    }
    await tx.note.delete({ where: { id: noteId } });
  }

  private async updateValueOfMeterType(
    tx: Tx,
    meterTypeId: number,
    valueId: number,
    value: number | undefined,
  ): Promise<void> {
    const existing = await tx.value.findUnique({
      where: { id: valueId },
      include: { meter: true },
    });
    if (!existing) {
      throw new NotFoundException(`Value ${valueId} not found`);
    }
    if (existing.meter?.meterTypeId !== meterTypeId) {
      throw new BadRequestException(`Value ${valueId} does not belong to meter type ${meterTypeId}`);
    }

    // An omitted value leaves the stored value unchanged.
    if (value !== undefined) {
      await tx.value.update({ where: { id: valueId }, data: { value } });
    }
  }

  private async assertMeterOfMeterType(tx: Tx, meterId: number, meterTypeId: number): Promise<void> {
    const meter = await tx.meter.findUnique({ where: { id: meterId } });
    if (!meter) {
      throw new NotFoundException(`Meter ${meterId} not found`);
    }
    if (meter.meterTypeId !== meterTypeId) {
      throw new BadRequestException(`Meter ${meterId} does not belong to meter type ${meterTypeId}`);
    }
  }
}
