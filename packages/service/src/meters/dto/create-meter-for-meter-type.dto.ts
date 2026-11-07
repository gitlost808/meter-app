import { OmitType } from '@nestjs/swagger';
import { CreateMeterDto } from './create-meter.dto';

export class CreateMeterForMeterTypeDto extends OmitType(CreateMeterDto, [
  'meterTypeId',
] as const) {}
