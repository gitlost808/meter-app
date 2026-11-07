import { OmitType } from '@nestjs/swagger';
import { CreateValueDto } from './create-value.dto';

export class CreateValueForMeterDto extends OmitType(CreateValueDto, [
  'meterId',
] as const) {}
