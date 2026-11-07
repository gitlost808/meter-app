import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateBy,
  ValidateIf,
  ValidateNested,
  type ValidationArguments,
} from 'class-validator';

const WRITE_KINDS = ['update', 'create'] as const;
type WriteKind = (typeof WRITE_KINDS)[number];

export class ValueWriteDto {
  @ApiProperty({ enum: WRITE_KINDS, description: 'Update a value of the selected day or create a new one' })
  @IsIn(WRITE_KINDS)
  kind!: WriteKind;

  @ApiPropertyOptional({ example: 12, description: 'Required for kind "update"' })
  @ValidateIf((o: ValueWriteDto) => o.kind === 'update')
  @Type(() => Number)
  @IsInt()
  valueId?: number;

  @ApiPropertyOptional({ example: 3, description: 'Required for kind "create"' })
  @ValidateIf((o: ValueWriteDto) => o.kind === 'create')
  @Type(() => Number)
  @IsInt()
  meterId?: number;

  @ApiPropertyOptional({
    example: 1245.67,
    description: 'Required for kind "create"; for "update", an omitted value leaves the stored value unchanged',
  })
  @ValidateIf((o: ValueWriteDto) => o.kind === 'create' || o.value !== undefined)
  @Type(() => Number)
  @IsNumber()
  value?: number;
}

export class NewMeterWriteDto {
  @ApiProperty({
    enum: WRITE_KINDS,
    description: 'Update the first value of an already created new meter, or create the new meter with its first value',
  })
  @IsIn(WRITE_KINDS)
  kind!: WriteKind;

  @ApiPropertyOptional({ example: 13, description: 'Required for kind "update"' })
  @ValidateIf((o: NewMeterWriteDto) => o.kind === 'update')
  @Type(() => Number)
  @IsInt()
  valueId?: number;

  @ApiPropertyOptional({ example: 'Electricity 2026-10-16', description: 'Required for kind "create"' })
  @ValidateIf((o: NewMeterWriteDto) => o.kind === 'create')
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  meterName?: string;

  @ApiPropertyOptional({
    example: 0.5,
    description: 'Required for kind "create"; for "update", an omitted value leaves the stored value unchanged',
  })
  @ValidateIf((o: NewMeterWriteDto) => o.kind === 'create' || o.value !== undefined)
  @Type(() => Number)
  @IsNumber()
  value?: number;
}

const NOTE_WRITE_KINDS = ['create', 'update', 'delete'] as const;
type NoteWriteKind = (typeof NOTE_WRITE_KINDS)[number];

export class NoteWriteDto {
  @ApiProperty({
    enum: NOTE_WRITE_KINDS,
    description: 'Create the note of the entry, or update or delete an existing note of the same day',
  })
  @IsIn(NOTE_WRITE_KINDS)
  kind!: NoteWriteKind;

  @ApiPropertyOptional({ example: 4, description: 'Required for kinds "update" and "delete"' })
  @ValidateIf((o: NoteWriteDto) => o.kind === 'update' || o.kind === 'delete')
  @Type(() => Number)
  @IsInt()
  noteId?: number;

  @ApiPropertyOptional({
    example: 'Yearly meter check done',
    maxLength: 2000,
    description: 'Required for kinds "create" and "update"; ignored for "delete"',
  })
  @ValidateIf((o: NoteWriteDto) => o.kind === 'create' || o.kind === 'update')
  @IsString()
  @Matches(/\S/, { message: 'text must not be blank' })
  @MaxLength(2000)
  text?: string;
}

/** Requires at least one entry unless the request saves a note. */
function IsNotEmptyWithoutNote(): PropertyDecorator {
  return ValidateBy({
    name: 'isNotEmptyWithoutNote',
    validator: {
      validate: (entries: unknown, args?: ValidationArguments) =>
        !Array.isArray(entries) ||
        entries.length > 0 ||
        (args?.object as SaveValueEntriesDto | undefined)?.note != null,
      defaultMessage: () => 'entries must contain at least one element when no note is sent',
    },
  });
}

export class ValueEntryDto {
  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  meterTypeId!: number;

  @ApiPropertyOptional({ type: () => ValueWriteDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ValueWriteDto)
  value?: ValueWriteDto;

  @ApiPropertyOptional({ type: () => NewMeterWriteDto, description: 'Meter change: replace the meter of this type' })
  @IsOptional()
  @ValidateNested()
  @Type(() => NewMeterWriteDto)
  newMeter?: NewMeterWriteDto;
}

export class SaveValueEntriesDto {
  @ApiProperty({ example: '2026-10-16T00:00:00.000Z', description: 'Timestamp for all created values and the created note' })
  @IsDateString()
  timestamp!: string;

  @ApiProperty({
    type: () => [ValueEntryDto],
    description: 'May be empty when the request only saves a note',
  })
  @IsArray()
  @IsNotEmptyWithoutNote()
  @ValidateNested({ each: true })
  @Type(() => ValueEntryDto)
  entries!: ValueEntryDto[];

  @ApiPropertyOptional({
    type: () => NoteWriteDto,
    description: 'The note of the entry; saved with the entry timestamp in the same transaction',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => NoteWriteDto)
  note?: NoteWriteDto;
}
