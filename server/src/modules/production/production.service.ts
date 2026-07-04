import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { ProductionOrder } from './entities/production-order.entity';
import { ProductionItem } from './entities/production-item.entity';
import { ProductionLog } from './entities/production-log.entity';
import { Contract } from '../contracts/entities/contract.entity';
import { Inventory } from '../inventory/entities/inventory.entity';
import { InventoryLog } from '../inventory/entities/inventory-log.entity';

@Injectable()
export class ProductionService {
  constructor(
    @InjectRepository(ProductionOrder) private orderRepo: Repository<ProductionOrder>,
    @InjectRepository(ProductionItem) private itemRepo: Repository<ProductionItem>,
    @InjectRepository(ProductionLog) private logRepo: Repository<ProductionLog>,
    @InjectRepository(Contract) private contractRepo: Repository<Contract>,
    @InjectRepository(Inventory) private invRepo: Repository<Inventory>,
    @InjectRepository(InventoryLog) private invLogRepo: Repository<InventoryLog>,
    private eventEmitter: EventEmitter2,
  ) {}

  async findAll(user: any): Promise<ProductionOrder[]> {
    const qb = this.orderRepo.createQueryBuilder('o')
      .leftJoinAndSelect('o.items', 'items')
      .leftJoinAndSelect('items.product', 'product')
      .orderBy('o.createdAt', 'DESC');
    if (user.roles?.includes('质检')) {
      qb.where("o.status = 'completed'");
    }
    return qb.getMany();
  }

  async findOne(id: number): Promise<ProductionOrder> {
    const order = await this.orderRepo.findOne({
      where: { id },
      relations: ['items', 'items.product'],
    });
    if (!order) throw new NotFoundException('工单不存在');
    return order;
  }

  // 监听合同审核通过
  @OnEvent('contract.approved')
  async handleContractApproved(payload: { contractId: number }) {
    // 实际生产中，生产部门手动创建工单，这里先不做自动创建
    console.log(`合同 ${payload.contractId} 已审批通过，等待生产部门处理`);
  }

  // 监听 QC 通过 — 自动增加库存
  @OnEvent('qc.passed')
  async handleQCPassed(payload: { orderId: number; contractId: number }) {
    const items = await this.itemRepo.find({ where: { order_id: payload.orderId } });
    for (const item of items) {
      let inv = await this.invRepo.findOne({ where: { product_id: item.product_id } });
      if (!inv) {
        inv = this.invRepo.create({ product_id: item.product_id, quantity: 0 });
      }
      const before = inv.quantity;
      inv.quantity += item.quantity;
      await this.invRepo.save(inv);
      await this.invLogRepo.save({
        product_id: item.product_id,
        change_type: 'produce',
        quantity_before: before,
        quantity_change: item.quantity,
        quantity_after: inv.quantity,
        reference_type: 'production',
        reference_id: payload.orderId,
        operator_id: 0, // 系统操作
      });
    }
  }

  // 创建工单
  async create(contractId: number, userId: number): Promise<ProductionOrder> {
    const contract = await this.contractRepo.findOne({
      where: { id: contractId },
      relations: ['items'],
    });
    if (!contract) throw new NotFoundException('合同不存在');
    // 更新合同状态为 production
    contract.status = 'production';
    await this.contractRepo.save(contract);

    const order = this.orderRepo.create({
      contract_id: contractId,
      status: 'pending',
      operator_id: userId,
    });
    order.items = contract.items.map(item =>
      this.itemRepo.create({ product_id: item.product_id, quantity: item.quantity })
    );
    const saved = await this.orderRepo.save(order);
    await this.logOp(saved.id, userId, 'create');
    return saved;
  }

  // 开始生产
  async start(id: number, userId: number): Promise<ProductionOrder> {
    const order = await this.orderRepo.findOneBy({ id });
    if (!order || order.status !== 'pending') throw new BadRequestException('工单状态不正确');
    order.status = 'in_progress';
    order.started_at = new Date();
    await this.orderRepo.save(order);
    await this.logOp(id, userId, 'start');
    return order;
  }

  // 生产完成
  async complete(id: number, userId: number): Promise<ProductionOrder> {
    const order = await this.orderRepo.findOneBy({ id });
    if (!order || order.status !== 'in_progress') throw new BadRequestException('工单状态不正确');
    order.status = 'completed';
    order.completed_at = new Date();
    await this.orderRepo.save(order);
    await this.logOp(id, userId, 'complete');
    this.eventEmitter.emit('production.completed', { orderId: id, contractId: order.contract_id });
    return order;
  }

  // 质检通过
  async qcPass(id: number, userId: number, remark?: string): Promise<ProductionOrder> {
    const order = await this.orderRepo.findOne({
      where: { id },
      relations: ['items'],
    });
    if (!order || order.status !== 'completed') throw new BadRequestException('工单状态不正确');
    // 更新所有生产项质检状态
    for (const item of order.items) {
      item.qc_status = 'pass';
      item.qc_operator_id = userId;
      item.qc_at = new Date();
      item.qc_remark = remark ?? null as any;
    }
    await this.itemRepo.save(order.items);
    await this.logOp(id, userId, 'qc_pass', remark);
    this.eventEmitter.emit('qc.passed', { orderId: id, contractId: order.contract_id });
    return order;
  }

  // 质检退回
  async qcReject(id: number, userId: number, remark: string): Promise<ProductionOrder> {
    const order = await this.orderRepo.findOne({
      where: { id },
      relations: ['items'],
    });
    if (!order || order.status !== 'completed') throw new BadRequestException('工单状态不正确');
    // 更新所有生产项质检状态为 reject
    for (const item of order.items) {
      item.qc_status = 'reject';
      item.qc_operator_id = userId;
      item.qc_at = new Date();
      item.qc_remark = remark;
    }
    await this.itemRepo.save(order.items);
    order.status = 'in_progress'; // 退回生产
    await this.orderRepo.save(order);
    await this.logOp(id, userId, 'qc_reject', remark);
    this.eventEmitter.emit('qc.rejected', { orderId: id, contractId: order.contract_id });
    return order;
  }

  private async logOp(orderId: number, userId: number, action: string, remark?: string) {
    await this.logRepo.save({ order_id: orderId, operator_id: userId, action, remark });
  }
}
