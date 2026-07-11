import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as fs from 'fs';
import * as path from 'path';
import { Contract } from './entities/contract.entity';
import { ContractItem } from './entities/contract-item.entity';
import { ContractOperation } from './entities/contract-operation.entity';
import { ContractAttachment } from './entities/contract-attachment.entity';
import { ContractVersion } from './entities/contract-version.entity';
import { CreateContractDto } from './dto/create-contract.dto';
import { AuditContractDto } from './dto/audit-contract.dto';
import { ChangeContractDto } from './dto/change-contract.dto';
import {
  assertTransition,
  assertEditable,
  assertTerminable,
  ContractStatus,
} from './contract-state-machine';
import { ContractEvents } from '../../common/events';

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

  // ========== 查询方法 ==========

  async findAll(user: any, filters?: { customer_name?: string; contract_no?: string; status?: string }): Promise<Contract[]> {
    const qb = this.contractRepo.createQueryBuilder('c')
      .leftJoinAndSelect('c.items', 'items')
      .leftJoinAndSelect('items.product', 'product')
      .leftJoinAndSelect('c.submitter', 'submitter')
      .orderBy('c.createdAt', 'DESC');

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

    if (filters?.contract_no) {
      qb.andWhere('c.contract_no LIKE :contractNo', { contractNo: `%${filters.contract_no}%` });
    }
    if (filters?.customer_name) {
      qb.andWhere('c.customer_name LIKE :customerName', { customerName: `%${filters.customer_name}%` });
    }
    if (filters?.status) {
      qb.andWhere('c.status = :status', { status: filters.status });
    }

    return qb.getMany();
  }

  async findOne(id: number): Promise<Contract> {
    const contract = await this.contractRepo.findOne({
      where: { id },
      relations: ['items', 'items.product', 'submitter', 'attachments', 'operations'],
      relationLoadStrategy: 'query',
    });
    if (!contract) throw new NotFoundException('合同不存在');
    return contract;
  }

  // ========== 写操作 ==========

  // 创建合同
  async create(dto: CreateContractDto, userId: number): Promise<Contract> {
    const contractNo = await this.generateContractNo();
    const contract = this.contractRepo.create({
      contract_no: contractNo,
      ...dto,
      status: ContractStatus.DRAFT,
      submitter_id: userId,
    });
    contract.items = dto.items.map(item => this.itemRepo.create(item));
    return this.contractRepo.save(contract);
  }

  // 更新合同（草稿状态）
  async update(id: number, dto: CreateContractDto, userId: number): Promise<Contract> {
    const contract = await this.contractRepo.findOne({ where: { id }, relations: ['items'] });
    if (!contract) throw new NotFoundException('合同不存在');
    assertEditable(contract.status);

    if (contract.items?.length) await this.itemRepo.remove(contract.items);

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
    assertEditable(contract.status);

    if (contract.items?.length) await this.itemRepo.remove(contract.items);
    await this.contractRepo.remove(contract);
  }

  // 提交审核：draft → pending / returned → pending
  async submit(id: number, userId: number): Promise<Contract> {
    const contract = await this.contractRepo.findOneBy({ id });
    if (!contract) throw new BadRequestException('合同状态不正确');

    assertTransition(contract.status, ContractStatus.PENDING);
    contract.status = ContractStatus.PENDING;
    contract.submit_at = new Date();
    await this.contractRepo.save(contract);
    await this.logOperation(id, userId, 'submit');
    return contract;
  }

  // 审核：pending → approved 或 returned
  async audit(id: number, userId: number, dto: AuditContractDto): Promise<Contract> {
    const contract = await this.contractRepo.findOneBy({ id });
    if (!contract) throw new BadRequestException('合同状态不正确');

    if (dto.action === 'pass') {
      assertTransition(contract.status, ContractStatus.APPROVED);
      contract.status = ContractStatus.APPROVED;
      contract.reviewer_id = userId;
      contract.review_at = new Date();
      contract.review_remark = '';
      await this.contractRepo.save(contract);
      await this.logOperation(id, userId, 'audit_pass', dto.remark);
      this.eventEmitter.emit(ContractEvents.APPROVED, { contractId: id });
    } else {
      assertTransition(contract.status, ContractStatus.RETURNED);
      contract.status = ContractStatus.RETURNED;
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

    // 变更可视为"强制终止原合同并创建新合同"，原合同只要不是终态都可变更
    assertTerminable(original.status);

    const queryRunner = this.contractRepo.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      original.status = ContractStatus.CANCELLED;
      original.is_latest = false;
      await queryRunner.manager.save(original);

      const newContract = this.contractRepo.create({
        customer_name: dto.customer_name,
        customer_phone: dto.customer_phone,
        customer_address: dto.customer_address,
        status: ContractStatus.DRAFT,
        submitter_id: userId,
      });
      newContract.contract_no = await this.generateContractNo();
      newContract.items = dto.items.map(item => this.itemRepo.create(item));
      const saved = await queryRunner.manager.save(newContract);

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
    if (!contract) throw new BadRequestException('合同状态不正确');
    assertTransition(contract.status, ContractStatus.DELIVERED);
    contract.status = ContractStatus.DELIVERED;
    contract.delivered_by = userId;
    await this.contractRepo.save(contract);
    await this.logOperation(id, userId, 'complete');
    return contract;
  }

  // 终止合同：管理员操作（任何非终态均可终止）
  async terminate(id: number, userId: number): Promise<Contract> {
    const contract = await this.contractRepo.findOneBy({ id });
    if (!contract) throw new BadRequestException('合同不存在');
    assertTerminable(contract.status);
    contract.status = ContractStatus.CANCELLED;
    contract.is_latest = false;
    await this.contractRepo.save(contract);
    await this.logOperation(id, userId, 'terminate');
    this.eventEmitter.emit(ContractEvents.TERMINATED, { contractId: id });
    return contract;
  }

  // ========== 操作日志 ==========

  private async logOperation(contractId: number, userId: number, action: string, remark?: string) {
    await this.opRepo.save({ contract_id: contractId, operator_id: userId, action, remark });
  }

  async getOperations(contractId: number): Promise<ContractOperation[]> {
    return this.opRepo.find({
      where: { contract_id: contractId },
      order: { createdAt: 'DESC' },
    });
  }

  // ========== 附件管理 ==========

  async uploadAttachment(contractId: number, file: any, userId: number): Promise<ContractAttachment> {
    const contract = await this.contractRepo.findOneBy({ id: contractId });
    if (!contract) throw new NotFoundException('合同不存在');

    const ext = path.extname(file.originalname);
    const savedName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
    const uploadDir = path.resolve(__dirname, '../../../uploads');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    const filePath = path.join(uploadDir, savedName);
    fs.writeFileSync(filePath, file.buffer);

    const attachment = this.attRepo.create({
      contract_id: contractId,
      file_name: file.originalname,
      file_path: savedName,
      uploader_id: userId,
    });
    const saved = await this.attRepo.save(attachment);
    await this.logOperation(contractId, userId, 'upload_attachment', file.originalname);
    return saved;
  }

  async getAttachments(contractId: number): Promise<ContractAttachment[]> {
    return this.attRepo.find({
      where: { contract_id: contractId },
      relations: ['uploader'],
      order: { createdAt: 'DESC' },
    });
  }

  async getAttachmentFile(id: number): Promise<{ file: Buffer; name: string; mime: string }> {
    const att = await this.attRepo.findOneBy({ id });
    if (!att) throw new NotFoundException('附件不存在');
    const uploadDir = path.resolve(__dirname, '../../../uploads');
    const filePath = path.join(uploadDir, att.file_path);
    if (!fs.existsSync(filePath)) throw new NotFoundException('文件已丢失');
    const ext = path.extname(att.file_name).toLowerCase();
    const mimeMap: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.zip': 'application/zip',
      '.rar': 'application/vnd.rar',
    };
    return {
      file: fs.readFileSync(filePath),
      name: att.file_name,
      mime: mimeMap[ext] || 'application/octet-stream',
    };
  }

  async deleteAttachment(id: number, userId: number): Promise<void> {
    const att = await this.attRepo.findOneBy({ id });
    if (!att) throw new NotFoundException('附件不存在');
    const uploadDir = path.resolve(__dirname, '../../../uploads');
    const filePath = path.join(uploadDir, att.file_path);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    await this.attRepo.remove(att);
    await this.logOperation(att.contract_id, userId, 'delete_attachment', att.file_name);
  }
}
