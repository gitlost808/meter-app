import { OmitType } from '@nestjs/swagger';
import { CreateMeterTypeDto } from './create-meter-type.dto';

export class CreateMeterTypeForUnitDto extends OmitType(CreateMeterTypeDto, [
  'unitId',
] as const) {}
