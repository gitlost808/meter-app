import { PartialType } from '@nestjs/swagger';
import { CreateMeterTypeDto } from './create-meter-type.dto';

export class UpdateMeterTypeDto extends PartialType(CreateMeterTypeDto) {}
