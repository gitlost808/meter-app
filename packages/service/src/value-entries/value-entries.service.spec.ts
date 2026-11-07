import { BadRequestException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SaveValueEntriesDto } from './dto/save-value-entries.dto';
import { ValueEntriesService } from './value-entries.service';

const TIMESTAMP = '2026-10-16T00:00:00.000Z';

function createPrisma() {
  const tx = {
    value: {
      findUnique: vi.fn(),
      create: vi.fn().mockResolvedValue({ id: 100 }),
      update: vi.fn().mockResolvedValue({ id: 100 }),
    },
    meter: {
      findUnique: vi.fn(),
      create: vi.fn().mockResolvedValue({ id: 50 }),
    },
    meterType: {
      findUnique: vi.fn().mockResolvedValue({ id: 1, name: 'gas' }),
    },
    note: {
      findUnique: vi.fn(),
      create: vi.fn().mockResolvedValue({ id: 4 }),
      update: vi.fn().mockResolvedValue({ id: 4 }),
      delete: vi.fn().mockResolvedValue({ id: 4 }),
    },
  };
  const prisma = {
    $transaction: vi.fn(async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx)),
  };
  return { prisma, tx, service: new ValueEntriesService(prisma as never) };
}

function dto(entries: SaveValueEntriesDto['entries'], note?: SaveValueEntriesDto['note']): SaveValueEntriesDto {
  return { timestamp: TIMESTAMP, entries, note };
}

describe('ValueEntriesService', () => {
  let ctx: ReturnType<typeof createPrisma>;

  beforeEach(() => {
    ctx = createPrisma();
  });

  it('runs all writes inside one transaction', async () => {
    ctx.tx.meter.findUnique.mockResolvedValue({ id: 10, meterTypeId: 1 });
    ctx.tx.value.findUnique.mockResolvedValue({ id: 7, meter: { id: 20, meterTypeId: 2 } });

    await ctx.service.save(dto([
      { meterTypeId: 1, value: { kind: 'create', meterId: 10, value: 130 } },
      { meterTypeId: 2, value: { kind: 'update', valueId: 7, value: 5 } },
    ]));

    expect(ctx.prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(ctx.tx.value.create).toHaveBeenCalledExactlyOnceWith({
      data: { value: 130, timestamp: new Date(TIMESTAMP), meterId: 10 },
    });
    expect(ctx.tx.value.update).toHaveBeenCalledExactlyOnceWith({ where: { id: 7 }, data: { value: 5 } });
  });

  it('leaves an existing value unchanged when no value is sent', async () => {
    ctx.tx.value.findUnique.mockResolvedValue({ id: 7, meter: { id: 10, meterTypeId: 1 } });

    await ctx.service.save(dto([{ meterTypeId: 1, value: { kind: 'update', valueId: 7 } }]));

    expect(ctx.tx.value.update).not.toHaveBeenCalled();
  });

  it('creates the new meter and its first value on a meter change', async () => {
    ctx.tx.meter.findUnique.mockResolvedValue({ id: 10, meterTypeId: 1 });

    await ctx.service.save(dto([{
      meterTypeId: 1,
      value: { kind: 'create', meterId: 10, value: 140 },
      newMeter: { kind: 'create', meterName: 'gas 2026-10-16', value: 3 },
    }]));

    expect(ctx.tx.meter.create).toHaveBeenCalledExactlyOnceWith({ data: { name: 'gas 2026-10-16', meterTypeId: 1 } });
    expect(ctx.tx.value.create).toHaveBeenNthCalledWith(1, {
      data: { value: 140, timestamp: new Date(TIMESTAMP), meterId: 10 },
    });
    expect(ctx.tx.value.create).toHaveBeenNthCalledWith(2, {
      data: { value: 3, timestamp: new Date(TIMESTAMP), meterId: 50 },
    });
  });

  it('updates the first value of an already saved new meter', async () => {
    ctx.tx.value.findUnique.mockResolvedValue({ id: 8, meter: { id: 50, meterTypeId: 1 } });

    await ctx.service.save(dto([{ meterTypeId: 1, newMeter: { kind: 'update', valueId: 8, value: 4 } }]));

    expect(ctx.tx.meter.create).not.toHaveBeenCalled();
    expect(ctx.tx.value.update).toHaveBeenCalledExactlyOnceWith({ where: { id: 8 }, data: { value: 4 } });
  });

  it('rejects duplicate meter types before starting the transaction', async () => {
    await expect(ctx.service.save(dto([
      { meterTypeId: 1, value: { kind: 'create', meterId: 10, value: 1 } },
      { meterTypeId: 1, value: { kind: 'create', meterId: 10, value: 2 } },
    ]))).rejects.toThrow(new BadRequestException('Meter type 1 appears more than once'));

    expect(ctx.prisma.$transaction).not.toHaveBeenCalled();
  });

  describe('errors abort the whole transaction', () => {
    it('stops at a value that does not exist', async () => {
      ctx.tx.value.findUnique.mockResolvedValue(null);

      await expect(ctx.service.save(dto([
        { meterTypeId: 1, value: { kind: 'update', valueId: 7, value: 5 } },
        { meterTypeId: 2, value: { kind: 'create', meterId: 20, value: 6 } },
      ]))).rejects.toThrow(NotFoundException);

      expect(ctx.tx.value.create).not.toHaveBeenCalled();
    });

    it('rejects a value of another meter type', async () => {
      ctx.tx.value.findUnique.mockResolvedValue({ id: 7, meter: { id: 20, meterTypeId: 2 } });

      await expect(ctx.service.save(dto([{ meterTypeId: 1, value: { kind: 'update', valueId: 7, value: 5 } }])))
        .rejects.toThrow(new BadRequestException('Value 7 does not belong to meter type 1'));
      expect(ctx.tx.value.update).not.toHaveBeenCalled();
    });

    it('rejects a missing meter and a meter of another type', async () => {
      ctx.tx.meter.findUnique.mockResolvedValueOnce(null);
      await expect(ctx.service.save(dto([{ meterTypeId: 1, value: { kind: 'create', meterId: 10, value: 1 } }])))
        .rejects.toThrow(new NotFoundException('Meter 10 not found'));

      ctx.tx.meter.findUnique.mockResolvedValueOnce({ id: 10, meterTypeId: 2 });
      await expect(ctx.service.save(dto([{ meterTypeId: 1, value: { kind: 'create', meterId: 10, value: 1 } }])))
        .rejects.toThrow(new BadRequestException('Meter 10 does not belong to meter type 1'));

      expect(ctx.tx.value.create).not.toHaveBeenCalled();
    });

    it('rejects a meter change for a missing meter type', async () => {
      ctx.tx.meterType.findUnique.mockResolvedValue(null);

      await expect(ctx.service.save(dto([{ meterTypeId: 9, newMeter: { kind: 'create', meterName: 'x', value: 1 } }])))
        .rejects.toThrow(new NotFoundException('Meter type 9 not found'));
      expect(ctx.tx.meter.create).not.toHaveBeenCalled();
    });

    it('rejects writes missing the fields their kind requires', async () => {
      await expect(ctx.service.save(dto([{ meterTypeId: 1, value: { kind: 'create', meterId: 10 } }])))
        .rejects.toThrow(new BadRequestException('value.value is required'));
      await expect(ctx.service.save(dto([{ meterTypeId: 1, newMeter: { kind: 'create', value: 1 } }])))
        .rejects.toThrow(new BadRequestException('newMeter.meterName is required'));
    });

    it('propagates write errors out of the transaction', async () => {
      ctx.tx.meter.findUnique.mockResolvedValue({ id: 10, meterTypeId: 1 });
      ctx.tx.value.create.mockRejectedValue(new Error('connection lost'));

      await expect(ctx.service.save(dto([{ meterTypeId: 1, value: { kind: 'create', meterId: 10, value: 1 } }])))
        .rejects.toThrow('connection lost');
    });
  });

  describe('note', () => {
    const noteOfDay = { id: 4, timestamp: new Date(TIMESTAMP), text: 'old' };

    it('creates the note with the entry timestamp in the same transaction as the values', async () => {
      ctx.tx.meter.findUnique.mockResolvedValue({ id: 10, meterTypeId: 1 });

      await ctx.service.save(dto(
        [{ meterTypeId: 1, value: { kind: 'create', meterId: 10, value: 130 } }],
        { kind: 'create', text: 'Yearly meter check done' },
      ));

      expect(ctx.prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(ctx.tx.value.create).toHaveBeenCalledOnce();
      expect(ctx.tx.note.create).toHaveBeenCalledExactlyOnceWith({
        data: { text: 'Yearly meter check done', timestamp: new Date(TIMESTAMP) },
      });
    });

    it('saves a note without any value entries', async () => {
      await ctx.service.save(dto([], { kind: 'create', text: 'only a note' }));

      expect(ctx.prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(ctx.tx.note.create).toHaveBeenCalledOnce();
      expect(ctx.tx.value.create).not.toHaveBeenCalled();
    });

    it('updates the text of a note of the same day', async () => {
      ctx.tx.note.findUnique.mockResolvedValue(noteOfDay);

      await ctx.service.save(dto([], { kind: 'update', noteId: 4, text: 'edited' }));

      expect(ctx.tx.note.findUnique).toHaveBeenCalledExactlyOnceWith({ where: { id: 4 } });
      expect(ctx.tx.note.update).toHaveBeenCalledExactlyOnceWith({ where: { id: 4 }, data: { text: 'edited' } });
    });

    it('deletes a note of the same day', async () => {
      ctx.tx.note.findUnique.mockResolvedValue(noteOfDay);

      await ctx.service.save(dto([], { kind: 'delete', noteId: 4 }));

      expect(ctx.tx.note.delete).toHaveBeenCalledExactlyOnceWith({ where: { id: 4 } });
      expect(ctx.tx.note.update).not.toHaveBeenCalled();
    });

    it('rejects a note that does not exist', async () => {
      ctx.tx.note.findUnique.mockResolvedValue(null);

      await expect(ctx.service.save(dto([], { kind: 'update', noteId: 4, text: 'edited' })))
        .rejects.toThrow(new NotFoundException('Note 4 not found'));
      await expect(ctx.service.save(dto([], { kind: 'delete', noteId: 4 })))
        .rejects.toThrow(new NotFoundException('Note 4 not found'));
      expect(ctx.tx.note.update).not.toHaveBeenCalled();
      expect(ctx.tx.note.delete).not.toHaveBeenCalled();
    });

    it('rejects a note of another day', async () => {
      ctx.tx.note.findUnique.mockResolvedValue({ ...noteOfDay, timestamp: new Date('2026-10-15T00:00:00.000Z') });

      await expect(ctx.service.save(dto([], { kind: 'update', noteId: 4, text: 'edited' })))
        .rejects.toThrow(new BadRequestException(`Note 4 does not belong to ${TIMESTAMP}`));
      await expect(ctx.service.save(dto([], { kind: 'delete', noteId: 4 })))
        .rejects.toThrow(new BadRequestException(`Note 4 does not belong to ${TIMESTAMP}`));
      expect(ctx.tx.note.update).not.toHaveBeenCalled();
      expect(ctx.tx.note.delete).not.toHaveBeenCalled();
    });

    it('rejects note writes missing the fields their kind requires', async () => {
      await expect(ctx.service.save(dto([], { kind: 'create' })))
        .rejects.toThrow(new BadRequestException('note.text is required'));
      await expect(ctx.service.save(dto([], { kind: 'delete' })))
        .rejects.toThrow(new BadRequestException('note.noteId is required'));
    });

    it('fails the whole transaction when the note write fails after the values', async () => {
      ctx.tx.meter.findUnique.mockResolvedValue({ id: 10, meterTypeId: 1 });
      ctx.tx.note.findUnique.mockResolvedValue(null);

      await expect(ctx.service.save(dto(
        [{ meterTypeId: 1, value: { kind: 'create', meterId: 10, value: 130 } }],
        { kind: 'delete', noteId: 4 },
      ))).rejects.toThrow(NotFoundException);

      // The value write ran inside the same transaction callback, so Prisma rolls it back.
      expect(ctx.prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(ctx.tx.value.create).toHaveBeenCalledOnce();
    });

    it('writes no note when a value write fails', async () => {
      ctx.tx.value.findUnique.mockResolvedValue(null);

      await expect(ctx.service.save(dto(
        [{ meterTypeId: 1, value: { kind: 'update', valueId: 7, value: 5 } }],
        { kind: 'create', text: 'Yearly meter check done' },
      ))).rejects.toThrow(NotFoundException);

      expect(ctx.tx.note.create).not.toHaveBeenCalled();
    });
  });
});
