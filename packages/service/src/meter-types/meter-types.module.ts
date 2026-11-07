import { Module } from '@nestjs/common';
import { MeterTypesController } from './meter-types.controller';
import { MeterTypesService } from './meter-types.service';

@Module({
  controllers: [MeterTypesController],
  providers: [MeterTypesService],
})
export class MeterTypesModule {}
