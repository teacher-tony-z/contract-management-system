import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeliveryController } from './delivery.controller';
import { DeliveryService } from './delivery.service';
import { DeliveryOrder } from './entities/delivery-order.entity';
import { DeliveryItem } from './entities/delivery-item.entity';
import { AfterSaleRecord } from './entities/after-sale-record.entity';
import { Contract } from '../contracts/entities/contract.entity';
import { Inventory } from '../inventory/entities/inventory.entity';
import { InventoryLog } from '../inventory/entities/inventory-log.entity';

@Module({
  imports: [TypeOrmModule.forFeature([DeliveryOrder, DeliveryItem, AfterSaleRecord, Contract, Inventory, InventoryLog])],
  controllers: [DeliveryController],
  providers: [DeliveryService],
  exports: [DeliveryService],
})
export class DeliveryModule {}
