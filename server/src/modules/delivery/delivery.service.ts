import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DeliveryOrder } from './entities/delivery-order.entity';
import { DeliveryItem } from './entities/delivery-item.entity';
import { AfterSaleRecord } from './entities/after-sale-record.entity';
import { Contract } from '../contracts/entities/contract.entity';
import { Inventory } from '../inventory/entities/inventory.entity';
import { InventoryLog } from '../inventory/entities/inventory-log.entity';
import { CreateDeliveryDto } from './dto/create-delivery.dto';
import { AfterSaleDto } from './dto/after-sale.dto';
import { ContractStatus, assertTransition } from '../contracts/contract-state-machine';

@Injectable()
export class DeliveryService {
  constructor(
    @InjectRepository(DeliveryOrder) private deliveryRepo: Repository<DeliveryOrder>,
    @InjectRepository(DeliveryItem) private itemRepo: Repository<DeliveryItem>,
    @InjectRepository(AfterSaleRecord) private afterSaleRepo: Repository<AfterSaleRecord>,
    @InjectRepository(Contract) private contractRepo: Repository<Contract>,
    @InjectRepository(Inventory) private invRepo: Repository<Inventory>,
    @InjectRepository(InventoryLog) private invLogRepo: Repository<InventoryLog>,
  ) {}

  async findAll(): Promise<DeliveryOrder[]> {
    return this.deliveryRepo.find({
      relations: ['items', 'items.product'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: number): Promise<DeliveryOrder> {
    const order = await this.deliveryRepo.findOne({
      where: { id },
      relations: ['items', 'items.product'],
    });
    if (!order) throw new NotFoundException('发货单不存在');
    return order;
  }

  async getAfterSaleRecords(contractId: number): Promise<AfterSaleRecord[]> {
    return this.afterSaleRepo.find({
      where: { contract_id: contractId },
      order: { createdAt: 'DESC' },
    });
  }

  // 创建发货单（从有库存的合同直接发货，或质检通过后发货）
  async create(contractId: number, dto: CreateDeliveryDto, userId: number): Promise<DeliveryOrder> {
    const contract = await this.contractRepo.findOneBy({ id: contractId });
    if (!contract) throw new NotFoundException('合同不存在');

    // 检查库存是否充足
    for (const item of dto.items) {
      const inv = await this.invRepo.findOne({ where: { product_id: item.product_id } });
      if (!inv || inv.quantity < item.quantity) {
        throw new BadRequestException(`产品 ${item.product_id} 库存不足（需要 ${item.quantity}，现有 ${inv?.quantity ?? 0}）`);
      }
    }

    const delivery = this.deliveryRepo.create({
      contract_id: contractId,
      logistics_company: dto.logistics_company,
      tracking_no: dto.tracking_no,
      shipped_by: userId,
      shipped_at: new Date(),
      status: 'shipped',
    });
    delivery.items = dto.items.map(item => this.itemRepo.create(item));
    const saved = await this.deliveryRepo.save(delivery);

    // 扣减库存
    for (const item of dto.items) {
      const inv = await this.invRepo.findOne({ where: { product_id: item.product_id } });
      if (inv) {
        const before = inv.quantity;
        inv.quantity -= item.quantity;
        await this.invRepo.save(inv);
        await this.invLogRepo.save({
          product_id: item.product_id,
          change_type: 'outbound',
          quantity_before: before,
          quantity_change: -item.quantity,
          quantity_after: inv.quantity,
          reference_type: 'contract',
          reference_id: contractId,
          operator_id: userId,
        });
      }
    }

    // 更新合同状态
    assertTransition(contract.status, ContractStatus.SHIPPED);
    contract.status = ContractStatus.SHIPPED;
    contract.delivery_at = new Date();
    await this.contractRepo.save(contract);

    return saved;
  }

  // 记录售后装机
  async recordAfterSale(contractId: number, dto: AfterSaleDto, userId: number): Promise<AfterSaleRecord> {
    const contract = await this.contractRepo.findOneBy({ id: contractId });
    if (!contract || contract.status !== 'shipped') throw new BadRequestException('合同状态不正确');

    const record = await this.afterSaleRepo.save({
      contract_id: contractId,
      test_date: dto.test_date,
      test_result: dto.test_result,
      tester_id: userId,
      remark: dto.remark,
    });

    // 合同 → installing
    assertTransition(contract.status, ContractStatus.INSTALLING);
    contract.status = ContractStatus.INSTALLING;
    contract.after_sale_at = new Date();
    await this.contractRepo.save(contract);

    return record;
  }
}
