import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductionOrder } from './entities/production-order.entity';
import { ProductionItem } from './entities/production-item.entity';
import { ProductionLog } from './entities/production-log.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ProductionOrder, ProductionItem, ProductionLog])],
  exports: [TypeOrmModule],
})
export class ProductionModule {}
