import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Inventory } from './entities/inventory.entity';
import { InventoryLog } from './entities/inventory-log.entity';
import { AdjustDto } from './dto/adjust.dto';

@Injectable()
export class InventoryService {
  constructor(
    @InjectRepository(Inventory) private invRepo: Repository<Inventory>,
    @InjectRepository(InventoryLog) private logRepo: Repository<InventoryLog>,
  ) {}

  findAll() {
    return this.invRepo.find({ relations: ['product'], order: { updatedAt: 'DESC' } });
  }

  findOne(productId: number) {
    return this.invRepo.findOne({ where: { product_id: productId }, relations: ['product'] });
  }

  async adjust(productId: number, dto: AdjustDto, userId: number) {
    let inv = await this.invRepo.findOne({ where: { product_id: productId } });
    if (!inv) {
      inv = this.invRepo.create({ product_id: productId, quantity: 0 });
    }
    const before = inv.quantity;
    inv.quantity = Math.max(0, inv.quantity + dto.quantity);
    await this.invRepo.save(inv);
    await this.logRepo.save({
      product_id: productId,
      change_type: 'inbound',
      quantity_before: before,
      quantity_change: dto.quantity,
      quantity_after: inv.quantity,
      reference_type: 'manual',
      operator_id: userId,
    });
    return inv;
  }

  async getLogs(productId?: number) {
    const where: any = {};
    if (productId) where.product_id = productId;
    return this.logRepo.find({ where, order: { createdAt: 'DESC' }, take: 100 });
  }
}
