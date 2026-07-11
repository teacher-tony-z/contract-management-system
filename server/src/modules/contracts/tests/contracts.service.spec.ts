import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ContractsService } from '../contracts.service';
import { Contract } from '../entities/contract.entity';
import { ContractItem } from '../entities/contract-item.entity';
import { ContractOperation } from '../entities/contract-operation.entity';
import { ContractAttachment } from '../entities/contract-attachment.entity';
import { ContractVersion } from '../entities/contract-version.entity';
import {
  createMockRepo,
  createMockQueryRunner,
  createMockEventEmitter,
} from '../../../test-utils/mock-factory';

describe('ContractsService', () => {
  let service: ContractsService;
  let contractRepo: ReturnType<typeof createMockRepo>;
  let itemRepo: ReturnType<typeof createMockRepo>;
  let opRepo: ReturnType<typeof createMockRepo>;
  let attRepo: ReturnType<typeof createMockRepo>;
  let verRepo: ReturnType<typeof createMockRepo>;
  let eventEmitter: ReturnType<typeof createMockEventEmitter>;

  const defaultItems = () => [{ product_id: 1, quantity: 2, remark: '测试产品' }];

  // 工厂函数：每次返回新对象，避免测试间相互污染
  const contract = (status: string, overrides = {}) => ({
    id: 1, contract_no: 'HT202607110001', customer_name: '测试客户',
    customer_phone: '13800138000', customer_address: '',
    status, submitter_id: 1, is_latest: true,
    submit_at: status !== 'draft' ? new Date() : undefined,
    reviewer_id: status === 'approved' || status === 'returned' ? 1 : undefined,
    review_at: status === 'approved' || status === 'returned' ? new Date() : undefined,
    review_remark: status === 'returned' ? '资料不全' : '',
    delivery_at: status === 'shipped' || status === 'installing' || status === 'delivered' ? new Date() : undefined,
    after_sale_at: status === 'installing' || status === 'delivered' ? new Date() : undefined,
    delivered_by: status === 'delivered' ? 1 : undefined,
    items: [{ id: 1, product_id: 1, quantity: 2, remark: '测试产品' }],
    ...overrides,
  });

  const mockUser = { id: 1, roles: ['管理员'], permissions: ['system:admin'] };

  function mockQueryBuilderChain(returnValue: any[]) {
    const qb = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue(returnValue),
    };
    contractRepo.createQueryBuilder.mockReturnValue(qb);
    return qb;
  }

  beforeEach(async () => {
    contractRepo = createMockRepo();
    itemRepo = createMockRepo();
    opRepo = createMockRepo();
    attRepo = createMockRepo();
    verRepo = createMockRepo();
    eventEmitter = createMockEventEmitter();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContractsService,
        { provide: getRepositoryToken(Contract), useValue: contractRepo },
        { provide: getRepositoryToken(ContractItem), useValue: itemRepo },
        { provide: getRepositoryToken(ContractOperation), useValue: opRepo },
        { provide: getRepositoryToken(ContractAttachment), useValue: attRepo },
        { provide: getRepositoryToken(ContractVersion), useValue: verRepo },
        { provide: EventEmitter2, useValue: eventEmitter },
      ],
    }).compile();

    service = module.get<ContractsService>(ContractsService);
  });

  // ============================
  //  create
  // ============================
  describe('create', () => {
    it('应创建草稿合同，生成合同号，状态为 draft', async () => {
      contractRepo.findOne.mockResolvedValue(null); // 无已有合同号 → 0001
      contractRepo.create.mockImplementation((data) => data);
      contractRepo.save.mockImplementation((obj) => Promise.resolve(obj));
      itemRepo.create.mockImplementation((data) => data as any);

      const result = await service.create({
        customer_name: '测试客户',
        items: defaultItems(),
      }, 1);

      expect(result.status).toBe('draft');
      expect(result.contract_no).toMatch(/^HT\d{8}\d{4}$/);
      expect(contractRepo.save).toHaveBeenCalled();
    });

    it('合同号序号应递增', async () => {
      contractRepo.findOne.mockResolvedValue({ contract_no: 'HT202607110005' });
      contractRepo.create.mockImplementation((data) => data);
      contractRepo.save.mockImplementation((obj) => Promise.resolve(obj));
      itemRepo.create.mockImplementation((data) => data as any);

      const result = await service.create({ customer_name: '客户', items: defaultItems() }, 1);

      expect(contractRepo.findOne).toHaveBeenCalled();
      expect(result.contract_no).toBe('HT202607110006');
    });
  });

  // ============================
  //  findAll
  // ============================
  describe('findAll', () => {
    it('管理员应看到所有合同', async () => {
      const qb = mockQueryBuilderChain([contract('draft')]);
      await service.findAll({ ...mockUser, roles: ['管理员'] });
      expect(qb.where).not.toHaveBeenCalled();
    });

    it('财务应看到 pending/approved/returned', async () => {
      const qb = mockQueryBuilderChain([contract('pending')]);
      await service.findAll({ ...mockUser, roles: ['财务'] });
      expect(qb.where).toHaveBeenCalledWith(
        expect.stringContaining('pending'),
      );
    });

    it('生产应看到 approved/production/shipped/installing', async () => {
      const qb = mockQueryBuilderChain([contract('approved')]);
      await service.findAll({ ...mockUser, roles: ['生产'] });
      expect(qb.where).toHaveBeenCalledWith(
        expect.stringContaining('approved'),
      );
    });

    it('质检应看到 production/shipped', async () => {
      const qb = mockQueryBuilderChain([contract('shipped')]);
      await service.findAll({ ...mockUser, roles: ['质检'] });
      expect(qb.where).toHaveBeenCalledWith(
        expect.stringContaining('production'),
      );
    });

    it('销售只能看到自己的合同', async () => {
      const qb = mockQueryBuilderChain([contract('draft')]);
      await service.findAll({ id: 2, roles: ['销售'] });
      expect(qb.where).toHaveBeenCalledWith(
        'c.submitter_id = :uid',
        { uid: 2 },
      );
    });

    it('应支持按合同号/客户名/状态搜索过滤', async () => {
      const qb = mockQueryBuilderChain([contract('draft')]);
      await service.findAll(
        { ...mockUser, roles: ['管理员'] },
        { contract_no: 'HT001', customer_name: '客户', status: 'draft' },
      );
      expect(qb.andWhere).toHaveBeenCalledTimes(3);
    });
  });

  // ============================
  //  findOne
  // ============================
  describe('findOne', () => {
    it('应返回合同含关联关系', async () => {
      const c = contract('draft');
      contractRepo.findOne.mockResolvedValue(c);
      const result = await service.findOne(1);
      expect(result).toEqual(c);
    });

    it('不存在应抛 NotFoundException', async () => {
      contractRepo.findOne.mockResolvedValue(null);
      await expect(service.findOne(99)).rejects.toThrow(NotFoundException);
    });
  });

  // ============================
  //  update
  // ============================
  describe('update', () => {
    it('应更新草稿合同的字段和条目', async () => {
      const c = contract('draft');
      contractRepo.findOne.mockResolvedValue(c);
      itemRepo.remove.mockResolvedValue([]);
      itemRepo.create.mockImplementation((data) => data as any);
      contractRepo.save.mockResolvedValue({ ...c, customer_name: '新客户' });

      const result = await service.update(1, {
        customer_name: '新客户',
        items: [{ product_id: 2, quantity: 3 }],
      }, 1);

      expect(result.customer_name).toBe('新客户');
      expect(itemRepo.remove).toHaveBeenCalled();
      expect(contractRepo.save).toHaveBeenCalled();
    });

    it('非 draft 状态应抛 BadRequestException', async () => {
      contractRepo.findOne.mockResolvedValue(contract('pending'));
      await expect(
        service.update(1, { customer_name: 'a', items: [] }, 1),
      ).rejects.toThrow(BadRequestException);
    });

    it('不存在应抛 NotFoundException', async () => {
      contractRepo.findOne.mockResolvedValue(null);
      await expect(
        service.update(99, { customer_name: 'a', items: [] }, 1),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ============================
  //  remove
  // ============================
  describe('remove', () => {
    it('应删除草稿合同及其条目', async () => {
      const c = contract('draft');
      contractRepo.findOne.mockResolvedValue(c);
      itemRepo.remove.mockResolvedValue([]);
      contractRepo.remove.mockResolvedValue(c);

      await service.remove(1);

      expect(itemRepo.remove).toHaveBeenCalled();
      expect(contractRepo.remove).toHaveBeenCalled();
    });

    it('非 draft 状态应抛 BadRequestException', async () => {
      contractRepo.findOne.mockResolvedValue(contract('pending'));
      await expect(service.remove(1)).rejects.toThrow(BadRequestException);
    });
  });

  // ============================
  //  submit
  // ============================
  describe('submit', () => {
    it('应将 draft→pending，记录提交时间和操作日志', async () => {
      const draft = contract('draft');
      contractRepo.findOneBy.mockResolvedValue(draft);
      contractRepo.save.mockResolvedValue({ ...draft, status: 'pending', submit_at: new Date() });
      opRepo.save.mockResolvedValue({});

      const result = await service.submit(1, 1);

      expect(result.status).toBe('pending');
      expect(result.submit_at).toBeDefined();
      expect(opRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ contract_id: 1, action: 'submit' }),
      );
    });

    it('非 draft 状态应抛 BadRequestException', async () => {
      contractRepo.findOneBy.mockResolvedValue(contract('pending'));
      await expect(service.submit(1, 1)).rejects.toThrow(BadRequestException);
    });

    it('不存在应抛 BadRequestException', async () => {
      contractRepo.findOneBy.mockResolvedValue(null);
      await expect(service.submit(99, 1)).rejects.toThrow(BadRequestException);
    });
  });

  // ============================
  //  audit (通过)
  // ============================
  describe('audit (通过)', () => {
    it('应将 pending→approved，记录审核人和事件', async () => {
      const pending = contract('pending');
      contractRepo.findOneBy.mockResolvedValue(pending);
      const approved = { ...pending, status: 'approved', reviewer_id: 1, review_at: new Date(), review_remark: '' };
      contractRepo.save.mockResolvedValue(approved);
      opRepo.save.mockResolvedValue({});

      const result = await service.audit(1, 1, { action: 'pass' });

      expect(result.status).toBe('approved');
      expect(result.reviewer_id).toBe(1);
      expect(result.review_at).toBeDefined();
      expect(eventEmitter.emit).toHaveBeenCalledWith('contract.approved', { contractId: 1 });
      expect(opRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'audit_pass' }),
      );
    });

    it('通过时应清除退回原因', async () => {
      const returned = contract('returned');
      contractRepo.findOneBy.mockResolvedValue(returned);

      // 调用时 returned.status 是 'pending' — 不对！returned 工厂函数返回 status='returned'
      // 但 audit 方法要求 status 必须为 'pending'，所以此处需要手动构造
      const pendingWithRemark = contract('pending', { review_remark: '资料不全' });
      contractRepo.findOneBy.mockResolvedValue(pendingWithRemark);
      contractRepo.save.mockResolvedValue({ ...pendingWithRemark, status: 'approved', review_remark: '' });
      opRepo.save.mockResolvedValue({});

      const result = await service.audit(1, 1, { action: 'pass' });

      expect(result.review_remark).toBe('');
    });
  });

  // ============================
  //  audit (驳回)
  // ============================
  describe('audit (驳回)', () => {
    it('应将 pending→returned，记录退回原因，不触发事件', async () => {
      const pending = contract('pending');
      contractRepo.findOneBy.mockResolvedValue(pending);
      contractRepo.save.mockResolvedValue({ ...pending, status: 'returned', review_remark: '资料不全' });
      opRepo.save.mockResolvedValue({});

      const result = await service.audit(1, 1, { action: 'reject', remark: '资料不全' });

      expect(result.status).toBe('returned');
      expect(result.review_remark).toBe('资料不全');
      expect(eventEmitter.emit).not.toHaveBeenCalled();
      expect(opRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'audit_reject', remark: '资料不全' }),
      );
    });
  });

  // ============================
  //  audit (异常)
  // ============================
  describe('audit (异常)', () => {
    it('非 pending 状态应抛 BadRequestException', async () => {
      contractRepo.findOneBy.mockResolvedValue(contract('draft'));
      await expect(
        service.audit(1, 1, { action: 'pass' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ============================
  //  change (事务)
  // ============================
  describe('change', () => {
    it('应作废原合同，创建新合同，记录版本关联（事务成功）', async () => {
      const mockQr = createMockQueryRunner();
      const draft = contract('draft');
      contractRepo.findOne.mockResolvedValue(draft);
      contractRepo.manager.connection.createQueryRunner.mockReturnValue(mockQr);

      mockQr.manager.save
        .mockResolvedValueOnce({})   // original saved
        .mockResolvedValueOnce({ id: 2, contract_no: 'HT202607110002' }) // new contract saved
        .mockResolvedValueOnce({})   // ContractVersion saved
        .mockResolvedValueOnce({});  // ContractOperation saved

      contractRepo.create.mockReturnValue({
        ...draft, id: 2, contract_no: 'HT202607110002',
      });

      const result = await service.change(1, 1, {
        change_reason: '客户变更需求',
        customer_name: '新客户',
        items: [{ product_id: 1, quantity: 5 }],
      });

      expect(mockQr.manager.save).toHaveBeenNthCalledWith(1,
        expect.objectContaining({ id: 1, status: 'cancelled', is_latest: false }),
      );
      expect(result.contract_no).toBe('HT202607110002');
      expect(mockQr.manager.save).toHaveBeenNthCalledWith(3,
        ContractVersion,
        expect.objectContaining({
          original_id: 1, new_id: 2, change_reason: '客户变更需求', changed_by: 1,
        }),
      );
      expect(mockQr.commitTransaction).toHaveBeenCalled();
    });

    it('异常时应回滚事务', async () => {
      const mockQr = createMockQueryRunner();
      contractRepo.findOne.mockResolvedValue(contract('draft'));
      contractRepo.manager.connection.createQueryRunner.mockReturnValue(mockQr);
      mockQr.manager.save.mockRejectedValue(new Error('DB error'));

      await expect(
        service.change(1, 1, {
          change_reason: '变更', customer_name: 'a', items: [],
        }),
      ).rejects.toThrow('DB error');

      expect(mockQr.rollbackTransaction).toHaveBeenCalled();
    });

    it('不存在应抛 NotFoundException', async () => {
      contractRepo.findOne.mockResolvedValue(null);
      await expect(
        service.change(99, 1, { change_reason: 'r', customer_name: 'a', items: [] }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ============================
  //  complete
  // ============================
  describe('complete', () => {
    it('应将 installing→delivered', async () => {
      const installing = contract('installing');
      contractRepo.findOneBy.mockResolvedValue(installing);
      const delivered = { ...installing, status: 'delivered', delivered_by: 1 };
      contractRepo.save.mockResolvedValue(delivered);
      opRepo.save.mockResolvedValue({});

      const result = await service.complete(1, 1);

      expect(result.status).toBe('delivered');
      expect(result.delivered_by).toBe(1);
      expect(opRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'complete' }),
      );
    });

    it('非 installing 状态应抛 BadRequestException', async () => {
      contractRepo.findOneBy.mockResolvedValue(contract('draft'));
      await expect(service.complete(1, 1)).rejects.toThrow(BadRequestException);
    });
  });

  // ============================
  //  terminate
  // ============================
  describe('terminate', () => {
    it('应将 draft→cancelled 并设 is_latest=false', async () => {
      const draft = contract('draft');
      contractRepo.findOneBy.mockResolvedValue(draft);
      contractRepo.save.mockResolvedValue({ ...draft, status: 'cancelled', is_latest: false });
      opRepo.save.mockResolvedValue({});

      const result = await service.terminate(1, 1);

      expect(result.status).toBe('cancelled');
      expect(result.is_latest).toBe(false);
      expect(eventEmitter.emit).toHaveBeenCalledWith('contract.terminated', { contractId: 1 });
    });

    it('已 delivered 的合同应抛 BadRequestException', async () => {
      contractRepo.findOneBy.mockResolvedValue(contract('delivered'));
      await expect(service.terminate(1, 1)).rejects.toThrow(BadRequestException);
    });

    it('已 cancelled 的合同应抛 BadRequestException', async () => {
      contractRepo.findOneBy.mockResolvedValue(contract('cancelled'));
      await expect(service.terminate(1, 1)).rejects.toThrow(BadRequestException);
    });
  });

  // ============================
  //  getOperations
  // ============================
  describe('getOperations', () => {
    it('应返回操作记录（按时间倒序）', async () => {
      const ops = [
        { id: 2, contract_id: 1, action: 'audit_pass', createdAt: new Date('2026-07-11') },
        { id: 1, contract_id: 1, action: 'submit', createdAt: new Date('2026-07-10') },
      ];
      opRepo.find.mockResolvedValue(ops);

      const result = await service.getOperations(1);

      expect(result).toEqual(ops);
      expect(opRepo.find).toHaveBeenCalledWith({
        where: { contract_id: 1 },
        order: { createdAt: 'DESC' },
      });
    });
  });
});
