import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Note, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateNoteDto } from './dto/create-note.dto';
import { ListNotesQueryDto } from './dto/list-notes-query.dto';
import { UpdateNoteDto } from './dto/update-note.dto';

@Injectable()
export class NotesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll({ from, to }: ListNotesQueryDto = {}): Promise<Note[]> {
    if (from && to && new Date(from) > new Date(to)) {
      throw new BadRequestException('from must not be after to');
    }

    const where: Prisma.NoteWhereInput = {};

    if (from || to) {
      where.timestamp = {};
      if (from) {
        where.timestamp.gte = new Date(from);
      }
      if (to) {
        where.timestamp.lte = new Date(to);
      }
    }

    return this.prisma.note.findMany({
      where,
      orderBy: { timestamp: 'asc' },
      take: 500,
    });
  }

  async findOne(id: number): Promise<Note> {
    const note = await this.prisma.note.findUnique({ where: { id } });
    if (!note) {
      throw new NotFoundException(`Note ${id} not found`);
    }
    return note;
  }

  create(dto: CreateNoteDto): Promise<Note> {
    return this.prisma.note.create({
      data: {
        text: dto.text,
        timestamp: new Date(dto.timestamp),
      },
    });
  }

  async update(id: number, dto: UpdateNoteDto): Promise<Note> {
    await this.findOne(id);
    return this.prisma.note.update({
      where: { id },
      data: {
        text: dto.text,
        timestamp: dto.timestamp ? new Date(dto.timestamp) : undefined,
      },
    });
  }

  async remove(id: number): Promise<void> {
    await this.findOne(id);
    await this.prisma.note.delete({ where: { id } });
  }
}
