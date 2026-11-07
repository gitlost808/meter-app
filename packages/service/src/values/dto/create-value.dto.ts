import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsNumber } from 'class-validator';

export class CreateValueDto {
  @ApiProperty({ example: 1245.67 })
  @Type(() => Number)
  @IsNumber()
  value!: number;

  @ApiProperty({ example: '2026-03-05T12:00:00.000Z' })
  @IsDateString()
  timestamp!: string;

  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  meterId!: number;
}
