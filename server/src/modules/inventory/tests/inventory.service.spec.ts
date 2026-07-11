import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { InventoryService } from '../inventory.service';
import { Inventory } from '../entities/inventory.entity';
import { InventoryLog } from '../entities/inventory-log.entity';
import { createMockRepo } from '../../../test-utils/mock-factory';

describe('InventoryService', () => {
  let service: InventoryService;
  let invRepo: ReturnType<typeof createMockRepo>;
  let logRepo: ReturnType<typeof createMockRepo>;

  beforeEach(async () => {
    invRepo = createMockRepo();
    logRepo = createMockRepo();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryService,
        { provide: getRepositoryToken(Inventory), useValue: invRepo },
        { provide: getRepositoryToken(InventoryLog), useValue: logRepo },
      ],
    }).compile();

    service = module.get<InventoryService>(InventoryService);
  });

  describe('findAll', () => {
    it('应返回所有库存含产品关联', async () => {
      const items = [{ id: 1, product_id: 1, quantity: 10, product: { id: 1, name: '产品A' } }];
      invRepo.find.mockResolvedValue(items);
      const result = await service.findAll();
      expect(result).toEqual(items);
    });
  });

  describe('findOne', () => {
    it('应按产品 ID 查询库存', async () => {
      const item = { id: 1, product_id: 1, quantity: 10, product: { id: 1 } };
      invRepo.findOne.mockResolvedValue(item);
      expect(await service.findOne(1)).toEqual(item);
    });

    it('无库存记录应返回 null', async () => {
      invRepo.findOne.mockResolvedValue(null);
      expect(await service.findOne(99)).toBeNull();
    });
  });

  describe('adjust', () => {
    it('应增加库存并记录日志', async () => {
      invRepo.findOne.mockResolvedValue({ id: 1, product_id: 1, quantity: 10 });
      invRepo.save.mockResolvedValue({ id: 1, product_id: 1, quantity: 15 });
      logRepo.save.mockResolvedValue({});

      const result = await service.adjust(1, { quantity: 5, reason: '盘盈' }, 1);

      expect(invRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ quantity: 15 }),
      );
      expect(logRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          product_id: 1, change_type: 'inbound',
          quantity_before: 10, quantity_change: 5, quantity_after: 15,
          reference_type: 'manual', operator_id: 1,
        }),
      );
      expect(result.quantity).toBe(15);
    });

    it('应减少库存（负数调整）', async () => {
      invRepo.findOne.mockResolvedValue({ id: 1, product_id: 1, quantity: 10 });
      invRepo.save.mockResolvedValue({ id: 1, product_id: 1, quantity: 7 });
      logRepo.save.mockResolvedValue({});

      await service.adjust(1, { quantity: -3, reason: '盘亏' }, 1);

      expect(invRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ quantity: 7 }),
      );
    });

    it('库存归零（减少量超过当前库存）', async () => {
      invRepo.findOne.mockResolvedValue({ id: 1, product_id: 1, quantity: 10 });
      invRepo.save.mockResolvedValue({ id: 1, product_id: 1, quantity: 0 });
      logRepo.save.mockResolvedValue({});

      await service.adjust(1, { quantity: -999, reason: '全部扣除' }, 1);

      expect(invRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ quantity: 0 }),
      );
    });

    it('无库存记录时应创建新记录', async () => {
      invRepo.findOne.mockResolvedValue(null);
      invRepo.create.mockReturnValue({ product_id: 1, quantity: 0 });
      invRepo.save.mockResolvedValue({ id: 1, product_id: 1, quantity: 8 });
      logRepo.save.mockResolvedValue({});

      const result = await service.adjust(1, { quantity: 8, reason: '初始化' }, 1);

      expect(invRepo.create).toHaveBeenCalledWith({ product_id: 1, quantity: 0 });
      expect(result.quantity).toBe(8);
    });
  });

  describe('getLogs', () => {
    it('应返回最近 100 条日志', async () => {
      const logs = [{ id: 1, product_id: 1, change_type: 'inbound' }];
      logRepo.find.mockResolvedValue(logs);
      const result = await service.getLogs();
      expect(result).toEqual(logs);
      expect(logRepo.find).toHaveBeenCalledWith({
        where: {},
        order: { createdAt: 'DESC' },
        take: 100,
      });
    });

    it('支持按产品 ID 过滤', async () => {
      logRepo.find.mockResolvedValue([]);
      await service.getLogs(1);
      expect(logRepo.find).toHaveBeenCalledWith({
        where: { product_id: 1 },
        order: { createdAt: 'DESC' },
        take: 100,
      });
    });
  });
});
