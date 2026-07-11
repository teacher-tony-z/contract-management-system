import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ProductionService } from '../production.service';
import { ProductionOrder } from '../entities/production-order.entity';
import { ProductionItem } from '../entities/production-item.entity';
import { ProductionLog } from '../entities/production-log.entity';
import { Contract } from '../../contracts/entities/contract.entity';
import { Inventory } from '../../inventory/entities/inventory.entity';
import { InventoryLog } from '../../inventory/entities/inventory-log.entity';
import { createMockRepo, createMockQueryBuilder, createMockEventEmitter } from '../../../test-utils/mock-factory';
import { EventEmitter2 } from '@nestjs/event-emitter';

describe('ProductionService', () => {
  let service: ProductionService;
  let orderRepo: ReturnType<typeof createMockRepo>;
  let itemRepo: ReturnType<typeof createMockRepo>;
  let logRepo: ReturnType<typeof createMockRepo>;
  let contractRepo: ReturnType<typeof createMockRepo>;
  let invRepo: ReturnType<typeof createMockRepo>;
  let invLogRepo: ReturnType<typeof createMockRepo>;
  let eventEmitter: ReturnType<typeof createMockEventEmitter>;

  // 工厂函数：每次调用返回新的对象，避免测试间相互污染
  const mockContract = () => ({
    id: 1, contract_no: 'HT202607110001', status: 'approved' as const,
    items: [{ product_id: 1, quantity: 2 }],
  });

  const mockOrder = (status: string, overrides = {}) => ({
    id: 1, contract_id: 1, status,
    started_at: status === 'in_progress' || status === 'completed' ? new Date() : undefined,
    completed_at: status === 'completed' ? new Date() : undefined,
    items: [
      { id: 1, product_id: 1, quantity: 2, qc_status: 'pending' as const },
    ],
    ...overrides,
  });

  function mockQueryBuilderChain(returnValue: any[]) {
    const qb = createMockQueryBuilder();
    qb.getMany.mockResolvedValue(returnValue);
    orderRepo.createQueryBuilder.mockReturnValue(qb);
    return qb;
  }

  beforeEach(async () => {
    orderRepo = createMockRepo();
    itemRepo = createMockRepo();
    logRepo = createMockRepo();
    contractRepo = createMockRepo();
    invRepo = createMockRepo();
    invLogRepo = createMockRepo();
    eventEmitter = createMockEventEmitter();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductionService,
        { provide: getRepositoryToken(ProductionOrder), useValue: orderRepo },
        { provide: getRepositoryToken(ProductionItem), useValue: itemRepo },
        { provide: getRepositoryToken(ProductionLog), useValue: logRepo },
        { provide: getRepositoryToken(Contract), useValue: contractRepo },
        { provide: getRepositoryToken(Inventory), useValue: invRepo },
        { provide: getRepositoryToken(InventoryLog), useValue: invLogRepo },
        { provide: EventEmitter2, useValue: eventEmitter },
      ],
    }).compile();

    service = module.get<ProductionService>(ProductionService);
  });

  // ============================
  //  findAll
  // ============================
  describe('findAll', () => {
    it('非质检角色应看到所有工单', async () => {
      const qb = mockQueryBuilderChain([mockOrder('pending')]);
      await service.findAll({ roles: ['生产'] });
      expect(qb.where).not.toHaveBeenCalled();
    });

    it('质检角色只能看到 completed 状态的工单', async () => {
      const qb = mockQueryBuilderChain([mockOrder('completed')]);
      await service.findAll({ roles: ['质检'] });
      expect(qb.where).toHaveBeenCalledWith("o.status = 'completed'");
    });
  });

  // ============================
  //  findOne
  // ============================
  describe('findOne', () => {
    it('应返回工单含关联', async () => {
      const order = mockOrder('pending');
      orderRepo.findOne.mockResolvedValue(order);
      expect(await service.findOne(1)).toEqual(order);
    });

    it('不存在应抛 NotFoundException', async () => {
      orderRepo.findOne.mockResolvedValue(null);
      await expect(service.findOne(99)).rejects.toThrow(NotFoundException);
    });
  });

  // ============================
  //  create
  // ============================
  describe('create', () => {
    it('应创建 pending 工单，合同状态变为 production', async () => {
      const contract = mockContract();
      contractRepo.findOne.mockResolvedValue(contract);
      contractRepo.save.mockResolvedValue({ ...contract, status: 'production' });
      const pending = mockOrder('pending');
      orderRepo.create.mockReturnValue(pending);
      orderRepo.save.mockResolvedValue(pending);
      itemRepo.create.mockImplementation((data) => data as any);
      logRepo.save.mockResolvedValue({});

      const result = await service.create(1, 1);

      expect(contractRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'production' }),
      );
      expect(result.status).toBe('pending');
      expect(logRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'create' }),
      );
    });

    it('合同不存在应抛 NotFoundException', async () => {
      contractRepo.findOne.mockResolvedValue(null);
      await expect(service.create(99, 1)).rejects.toThrow(NotFoundException);
    });
  });

  // ============================
  //  start
  // ============================
  describe('start', () => {
    it('应将 pending→in_progress', async () => {
      const pending = mockOrder('pending');
      const inProgress = mockOrder('in_progress');
      orderRepo.findOneBy.mockResolvedValue(pending);
      orderRepo.save.mockResolvedValue(inProgress);
      logRepo.save.mockResolvedValue({});

      const result = await service.start(1, 1);

      expect(result.status).toBe('in_progress');
      expect(result.started_at).toBeDefined();
    });

    it('非 pending 状态应抛 BadRequestException', async () => {
      orderRepo.findOneBy.mockResolvedValue(mockOrder('in_progress'));
      await expect(service.start(1, 1)).rejects.toThrow(BadRequestException);
    });
  });

  // ============================
  //  complete
  // ============================
  describe('complete', () => {
    it('应将 in_progress→completed，触发 production.completed 事件', async () => {
      const inProgress = mockOrder('in_progress');
      const completed = mockOrder('completed');
      orderRepo.findOneBy.mockResolvedValue(inProgress);
      orderRepo.save.mockResolvedValue(completed);
      logRepo.save.mockResolvedValue({});

      const result = await service.complete(1, 1);

      expect(result.status).toBe('completed');
      expect(result.completed_at).toBeDefined();
      expect(eventEmitter.emit).toHaveBeenCalledWith('production.completed', {
        orderId: 1, contractId: 1,
      });
    });

    it('非 in_progress 状态应抛 BadRequestException', async () => {
      orderRepo.findOneBy.mockResolvedValue(mockOrder('pending'));
      await expect(service.complete(1, 1)).rejects.toThrow(BadRequestException);
    });
  });

  // ============================
  //  qcPass
  // ============================
  describe('qcPass', () => {
    it('应将 completed 工单质检通过，更新各项，触发 qc.passed 事件', async () => {
      const completed = mockOrder('completed');
      orderRepo.findOne.mockResolvedValue(completed);
      itemRepo.save.mockResolvedValue([]);
      logRepo.save.mockResolvedValue({});

      const result = await service.qcPass(1, 1, '合格');

      expect(result.items[0].qc_status).toBe('pass');
      expect(result.items[0].qc_operator_id).toBe(1);
      expect(result.items[0].qc_at).toBeDefined();
      expect(result.items[0].qc_remark).toBe('合格');
      expect(eventEmitter.emit).toHaveBeenCalledWith('qc.passed', {
        orderId: 1, contractId: 1,
      });
    });

    it('非 completed 状态应抛 BadRequestException', async () => {
      orderRepo.findOne.mockResolvedValue(mockOrder('pending'));
      await expect(service.qcPass(1, 1)).rejects.toThrow(BadRequestException);
    });
  });

  // ============================
  //  qcReject
  // ============================
  describe('qcReject', () => {
    it('应将质检项标记 reject，工单回到 in_progress，触发 qc.rejected', async () => {
      const completed = mockOrder('completed');
      orderRepo.findOne.mockResolvedValue(completed);
      itemRepo.save.mockResolvedValue([]);
      logRepo.save.mockResolvedValue({});

      const result = await service.qcReject(1, 1, '尺寸不合格');

      expect(result.items[0].qc_status).toBe('reject');
      expect(result.items[0].qc_remark).toBe('尺寸不合格');
      expect(result.status).toBe('in_progress');
      expect(eventEmitter.emit).toHaveBeenCalledWith('qc.rejected', {
        orderId: 1, contractId: 1,
      });
    });

    it('非 completed 状态应抛 BadRequestException', async () => {
      orderRepo.findOne.mockResolvedValue(mockOrder('pending'));
      await expect(service.qcReject(1, 1, '不合格')).rejects.toThrow(BadRequestException);
    });
  });

  // ============================
  //  handleQCPassed (事件监听)
  // ============================
  describe('handleQCPassed', () => {
    it('质检通过后应自动增加库存并记录日志', async () => {
      const items = [
        { id: 1, product_id: 1, quantity: 2 },
        { id: 2, product_id: 2, quantity: 3 },
      ];
      itemRepo.find.mockResolvedValue(items);

      // 产品1已存在库存，产品2无库存记录
      invRepo.findOne
        .mockResolvedValueOnce({ id: 1, product_id: 1, quantity: 10 })
        .mockResolvedValueOnce(null);

      invRepo.create.mockReturnValue({ id: 2, product_id: 2, quantity: 0 });
      invRepo.save.mockResolvedValue({});

      await service.handleQCPassed({ orderId: 1, contractId: 1 });

      // 产品1: 10 + 2 = 12
      expect(invRepo.save).toHaveBeenNthCalledWith(1,
        expect.objectContaining({ product_id: 1, quantity: 12 }),
      );
      // 产品2: 0 + 3 = 3
      expect(invRepo.save).toHaveBeenNthCalledWith(2,
        expect.objectContaining({ product_id: 2, quantity: 3 }),
      );
      // 两条库存日志
      expect(invLogRepo.save).toHaveBeenCalledTimes(2);
      expect(invLogRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          product_id: 1, change_type: 'produce', quantity_change: 2,
        }),
      );
    });
  });

  describe('handleContractApproved', () => {
    it('应记录日志但不自动创建工单', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      await service.handleContractApproved({ contractId: 1 });
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('已审批通过'),
      );
      consoleSpy.mockRestore();
    });
  });
});
