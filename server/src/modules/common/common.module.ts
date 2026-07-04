import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OperationLog } from './entities/operation-log.entity';

@Module({
  imports: [TypeOrmModule.forFeature([OperationLog])],
  exports: [TypeOrmModule],
})
export class CommonModule {}
