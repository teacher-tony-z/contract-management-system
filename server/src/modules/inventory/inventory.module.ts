import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Inventory } from './entities/inventory.entity';
import { InventoryLog } from './entities/inventory-log.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Inventory, InventoryLog])],
  exports: [TypeOrmModule],
})
export class InventoryModule {}
