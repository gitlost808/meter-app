import { BadRequestException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotesService } from './notes.service';

const FROM = '2026-01-01T00:00:00.000Z';
const TO = '2026-12-31T23:59:59.999Z';
const NOTE = { id: 7, text: 'Yearly meter check done', timestamp: new Date('2026-03-05T12:00:00.000Z') };
const NOTE_INPUT = { text: 'Pump replaced', timestamp: '2026-03-05T12:00:00.000Z' };
const EDITED_TIMESTAMP = '2026-04-01T00:00:00.000Z';

function createPrisma(existing: typeof NOTE | null = NOTE) {
  return {
    note: {
      findMany: vi.fn().mockResolvedValue([NOTE]),
      findUnique: vi.fn().mockResolvedValue(existing),
      create: vi.fn().mockResolvedValue(NOTE),
      update: vi.fn().mockResolvedValue(NOTE),
      delete: vi.fn().mockResolvedValue(NOTE),
    },
  };
}

describe('NotesService', () => {
  let prisma: ReturnType<typeof createPrisma>;
  let service: NotesService;

  beforeEach(() => {
    prisma = createPrisma();
    service = new NotesService(prisma as never);
  });

  describe('findAll', () => {
    it('lists all notes in chronological order without filters', async () => {
      await expect(service.findAll()).resolves.toEqual([NOTE]);

      expect(prisma.note.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { timestamp: 'asc' },
        take: 500,
      });
    });

    it('filters by an inclusive from/to range', async () => {
      await service.findAll({ from: FROM, to: TO });

      expect(prisma.note.findMany).toHaveBeenCalledWith({
        where: {
          timestamp: {
            gte: new Date(FROM),
            lte: new Date(TO),
          },
        },
        orderBy: { timestamp: 'asc' },
        take: 500,
      });
    });

    it('supports an open-ended range', async () => {
      await service.findAll({ from: FROM });
      await service.findAll({ to: TO });

      expect(prisma.note.findMany).toHaveBeenNthCalledWith(1, expect.objectContaining({
        where: { timestamp: { gte: new Date(FROM) } },
      }));
      expect(prisma.note.findMany).toHaveBeenNthCalledWith(2, expect.objectContaining({
        where: { timestamp: { lte: new Date(TO) } },
      }));
    });

    it('rejects a range whose from is after its to', async () => {
      await expect(service.findAll({ from: TO, to: FROM }))
        .rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.note.findMany).not.toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('returns the note', async () => {
      await expect(service.findOne(7)).resolves.toEqual(NOTE);
      expect(prisma.note.findUnique).toHaveBeenCalledWith({ where: { id: 7 } });
    });

    it('throws NotFoundException for an unknown note', async () => {
      prisma = createPrisma(null);
      service = new NotesService(prisma as never);

      await expect(service.findOne(99)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  it('creates a note with a parsed timestamp', async () => {
    await service.create(NOTE_INPUT);

    expect(prisma.note.create).toHaveBeenCalledWith({
      data: { text: NOTE_INPUT.text, timestamp: new Date(NOTE_INPUT.timestamp) },
    });
  });

  describe('update', () => {
    it('updates text and timestamp', async () => {
      await service.update(7, { text: 'Edited', timestamp: EDITED_TIMESTAMP });

      expect(prisma.note.update).toHaveBeenCalledWith({
        where: { id: 7 },
        data: { text: 'Edited', timestamp: new Date(EDITED_TIMESTAMP) },
      });
    });

    it('leaves omitted fields unchanged', async () => {
      await service.update(7, { text: 'Edited' });

      expect(prisma.note.update).toHaveBeenCalledWith({
        where: { id: 7 },
        data: { text: 'Edited', timestamp: undefined },
      });
    });

    it('throws NotFoundException for an unknown note without updating', async () => {
      prisma = createPrisma(null);
      service = new NotesService(prisma as never);

      await expect(service.update(99, { text: 'Edited' })).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.note.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('deletes the note', async () => {
      await service.remove(7);

      expect(prisma.note.delete).toHaveBeenCalledWith({ where: { id: 7 } });
    });

    it('throws NotFoundException for an unknown note without deleting', async () => {
      prisma = createPrisma(null);
      service = new NotesService(prisma as never);

      await expect(service.remove(99)).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.note.delete).not.toHaveBeenCalled();
    });
  });
});
