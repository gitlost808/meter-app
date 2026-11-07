import { Module } from '@nestjs/common';
import { ValuesController } from './values.controller';
import { ValuesService } from './values.service';

@Module({
  controllers: [ValuesController],
  providers: [ValuesService],
})
export class ValuesModule {}
