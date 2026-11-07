import { Module } from '@nestjs/common';
import { ValueEntriesController } from './value-entries.controller';
import { ValueEntriesService } from './value-entries.service';

@Module({
  controllers: [ValueEntriesController],
  providers: [ValueEntriesService],
})
export class ValueEntriesModule {}
