import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeliveryOrder } from './entities/delivery-order.entity';
import { DeliveryItem } from './entities/delivery-item.entity';
import { AfterSaleRecord } from './entities/after-sale-record.entity';

@Module({
  imports: [TypeOrmModule.forFeature([DeliveryOrder, DeliveryItem, AfterSaleRecord])],
  exports: [TypeOrmModule],
})
export class DeliveryModule {}
