import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductionController } from './production.controller';
import { ProductionService } from './production.service';
import { ProductionOrder } from './entities/production-order.entity';
import { ProductionItem } from './entities/production-item.entity';
import { ProductionLog } from './entities/production-log.entity';
import { Contract } from '../contracts/entities/contract.entity';
import { Inventory } from '../inventory/entities/inventory.entity';
import { InventoryLog } from '../inventory/entities/inventory-log.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ProductionOrder, ProductionItem, ProductionLog, Contract, Inventory, InventoryLog])],
  controllers: [ProductionController],
  providers: [ProductionService],
  exports: [ProductionService],
})
export class ProductionModule {}
