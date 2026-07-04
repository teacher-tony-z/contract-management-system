import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Contract } from './entities/contract.entity';
import { ContractItem } from './entities/contract-item.entity';
import { ContractOperation } from './entities/contract-operation.entity';
import { ContractAttachment } from './entities/contract-attachment.entity';
import { ContractVersion } from './entities/contract-version.entity';
import { CreateContractDto } from './dto/create-contract.dto';
import { AuditContractDto } from './dto/audit-contract.dto';
import { ChangeContractDto } from './dto/change-contract.dto';

@Injectable()
export class ContractsService {
  constructor(
    @InjectRepository(Contract) private contractRepo: Repository<Contract>,
    @InjectRepository(ContractItem) private itemRepo: Repository<ContractItem>,
    @InjectRepository(ContractOperation) private opRepo: Repository<ContractOperation>,
    @InjectRepository(ContractAttachment) private attRepo: Repository<ContractAttachment>,
    @InjectRepository(ContractVersion) private verRepo: Repository<ContractVersion>,
    private eventEmitter: EventEmitter2,
  ) {}

  // 生成合同号: HT + YYYYMMDD + 4位序号
  private async generateContractNo(): Promise<string> {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = `HT${dateStr}`;
    const last = await this.contractRepo.findOne({
      where: { contract_no: Like(`${prefix}%`) },
      order: { contract_no: 'DESC' },
    });
    const seq = last ? String(Number(last.contract_no.slice(-4)) + 1).padStart(4, '0') : '0001';
    return `${prefix}${seq}`;
  }

  // 创建合同
  async create(dto: CreateContractDto, userId: number): Promise<Contract> {
    const contractNo = await this.generateContractNo();
    const contract = this.contractRepo.create({
      contract_no: contractNo,
      ...dto,
      status: 'draft',
      submitter_id: userId,
    });
    contract.items = dto.items.map(item => this.itemRepo.create(item));
    return this.contractRepo.save(contract);
  }

  // 角色过滤列表（按角色优先级：管理员 > 财务 > 生产 > 质检 > 销售）
  async findAll(user: any): Promise<Contract[]> {
    const qb = this.contractRepo.createQueryBuilder('c')
      .leftJoinAndSelect('c.items', 'items')
      .leftJoinAndSelect('c.items.product', 'product')
      .leftJoinAndSelect('c.submitter', 'submitter')
      .orderBy('c.createdAt', 'DESC');

    // 按角色优先级决定过滤条件
    if (user.roles.includes('管理员')) {
      // 管理员看到全部
    } else if (user.roles.includes('财务')) {
      qb.where("c.status IN ('pending', 'approved', 'returned')");
    } else if (user.roles.includes('生产')) {
      qb.where("c.status IN ('approved', 'production', 'shipped', 'installing')");
    } else if (user.roles.includes('质检')) {
      qb.where("c.status IN ('production', 'shipped')");
    } else if (user.roles.includes('销售')) {
      qb.where('c.submitter_id = :uid', { uid: user.id });
    }
    // 无匹配角色时返回空列表
    return qb.getMany();
  }

  // 查询单个合同
  async findOne(id: number): Promise<Contract> {
    const contract = await this.contractRepo.findOne({
      where: { id },
      relations: ['items', 'items.product', 'submitter', 'attachments', 'operations'],
    });
    if (!contract) throw new NotFoundException('合同不存在');
    return contract;
  }

  // 更新合同（草稿状态）
  async update(id: number, dto: CreateContractDto, userId: number): Promise<Contract> {
    const contract = await this.contractRepo.findOne({ where: { id }, relations: ['items'] });
    if (!contract) throw new NotFoundException('合同不存在');
    if (contract.status !== 'draft') throw new BadRequestException('只能编辑草稿状态的合同');

    // 移除旧条目
    if (contract.items?.length) await this.itemRepo.remove(contract.items);

    // 更新字段
    contract.customer_name = dto.customer_name;
    contract.customer_phone = (dto.customer_phone ?? '') as string;
    contract.customer_address = (dto.customer_address ?? '') as string;
    contract.items = dto.items.map(item => this.itemRepo.create(item));

    return this.contractRepo.save(contract);
  }

  // 删除合同（草稿状态）
  async remove(id: number): Promise<void> {
    const contract = await this.contractRepo.findOne({ where: { id }, relations: ['items'] });
    if (!contract) throw new NotFoundException('合同不存在');
    if (contract.status !== 'draft') throw new BadRequestException('只能删除草稿状态的合同');

    if (contract.items?.length) await this.itemRepo.remove(contract.items);
    await this.contractRepo.remove(contract);
  }

  // 提交审核：draft → pending
  async submit(id: number, userId: number): Promise<Contract> {
    const contract = await this.contractRepo.findOneBy({ id });
    if (!contract || contract.status !== 'draft') throw new BadRequestException('合同状态不正确');
    contract.status = 'pending';
    contract.submit_at = new Date();
    await this.contractRepo.save(contract);
    await this.logOperation(id, userId, 'submit');
    return contract;
  }

  // 审核：pending → approved 或 returned
  async audit(id: number, userId: number, dto: AuditContractDto): Promise<Contract> {
    const contract = await this.contractRepo.findOneBy({ id });
    if (!contract || contract.status !== 'pending') throw new BadRequestException('合同状态不正确');
    if (dto.action === 'pass') {
      contract.status = 'approved';
      contract.reviewer_id = userId;
      contract.review_at = new Date();
      contract.review_remark = ''; // 清除上次退回原因
      await this.contractRepo.save(contract);
      await this.logOperation(id, userId, 'audit_pass', dto.remark);
      // 触发事件：生产模块监听
      this.eventEmitter.emit('contract.approved', { contractId: id });
    } else {
      contract.status = 'returned';
      contract.review_remark = dto.remark || '';
      await this.contractRepo.save(contract);
      await this.logOperation(id, userId, 'audit_reject', dto.remark);
    }
    return contract;
  }

  // 变更合同（生成新合同，原合同作废）— 使用事务保证数据一致性
  async change(id: number, userId: number, dto: ChangeContractDto): Promise<Contract> {
    const original = await this.contractRepo.findOne({
      where: { id },
      relations: ['items'],
    });
    if (!original) throw new NotFoundException('合同不存在');

    // 使用事务包装多个写操作
    const queryRunner = this.contractRepo.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      // 原合同作废
      original.status = 'cancelled';
      original.is_latest = false;
      await queryRunner.manager.save(original);

      // 创建新合同
      const newContract = this.contractRepo.create({
        customer_name: dto.customer_name,
        customer_phone: dto.customer_phone,
        customer_address: dto.customer_address,
        status: 'draft',
        submitter_id: userId,
      });
      newContract.contract_no = await this.generateContractNo();
      newContract.items = dto.items.map(item => this.itemRepo.create(item));
      const saved = await queryRunner.manager.save(newContract);

      // 记录版本关联
      await queryRunner.manager.save(ContractVersion, {
        original_id: id,
        new_id: saved.id,
        change_reason: dto.change_reason,
        changed_by: userId,
      });

      await queryRunner.manager.save(ContractOperation, {
        contract_id: id,
        operator_id: userId,
        action: 'change',
        remark: dto.change_reason,
      });

      await queryRunner.commitTransaction();
      return saved;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  // 交付确认：installing → delivered
  async complete(id: number, userId: number): Promise<Contract> {
    const contract = await this.contractRepo.findOneBy({ id });
    if (!contract || contract.status !== 'installing') throw new BadRequestException('合同状态不正确');
    contract.status = 'delivered';
    contract.delivered_by = userId;
    await this.contractRepo.save(contract);
    await this.logOperation(id, userId, 'complete');
    return contract;
  }

  // 终止合同：管理员操作
  async terminate(id: number, userId: number): Promise<Contract> {
    const contract = await this.contractRepo.findOneBy({ id });
    if (!contract || ['delivered', 'cancelled'].includes(contract.status)) {
      throw new BadRequestException('该合同无法终止');
    }
    contract.status = 'cancelled';
    contract.is_latest = false;
    await this.contractRepo.save(contract);
    await this.logOperation(id, userId, 'terminate');
    this.eventEmitter.emit('contract.terminated', { contractId: id });
    return contract;
  }

  // 记录操作日志
  private async logOperation(contractId: number, userId: number, action: string, remark?: string) {
    await this.opRepo.save({ contract_id: contractId, operator_id: userId, action, remark });
  }

  // 获取操作记录
  async getOperations(contractId: number): Promise<ContractOperation[]> {
    return this.opRepo.find({
      where: { contract_id: contractId },
      order: { createdAt: 'DESC' },
    });
  }
}
