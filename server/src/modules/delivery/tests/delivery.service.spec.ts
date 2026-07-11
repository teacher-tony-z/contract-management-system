import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { DeliveryService } from '../delivery.service';
import { DeliveryOrder } from '../entities/delivery-order.entity';
import { DeliveryItem } from '../entities/delivery-item.entity';
import { AfterSaleRecord } from '../entities/after-sale-record.entity';
import { Contract } from '../../contracts/entities/contract.entity';
import { Inventory } from '../../inventory/entities/inventory.entity';
import { InventoryLog } from '../../inventory/entities/inventory-log.entity';
import { createMockRepo } from '../../../test-utils/mock-factory';

describe('DeliveryService', () => {
  let service: DeliveryService;
  let deliveryRepo: ReturnType<typeof createMockRepo>;
  let itemRepo: ReturnType<typeof createMockRepo>;
  let afterSaleRepo: ReturnType<typeof createMockRepo>;
  let contractRepo: ReturnType<typeof createMockRepo>;
  let invRepo: ReturnType<typeof createMockRepo>;
  let invLogRepo: ReturnType<typeof createMockRepo>;

  // 工厂函数：每次返回新对象，避免测试间互相污染
  const mockContract = (status: string) => ({
    id: 1, contract_no: 'HT202607110001', status,
  });

  const mockDelivery = () => ({
    id: 1, contract_id: 1, status: 'shipped',
    logistics_company: '顺丰', tracking_no: 'SF123456',
    items: [{ product_id: 1, quantity: 2 }],
  });

  beforeEach(async () => {
    deliveryRepo = createMockRepo();
    itemRepo = createMockRepo();
    afterSaleRepo = createMockRepo();
    contractRepo = createMockRepo();
    invRepo = createMockRepo();
    invLogRepo = createMockRepo();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeliveryService,
        { provide: getRepositoryToken(DeliveryOrder), useValue: deliveryRepo },
        { provide: getRepositoryToken(DeliveryItem), useValue: itemRepo },
        { provide: getRepositoryToken(AfterSaleRecord), useValue: afterSaleRepo },
        { provide: getRepositoryToken(Contract), useValue: contractRepo },
        { provide: getRepositoryToken(Inventory), useValue: invRepo },
        { provide: getRepositoryToken(InventoryLog), useValue: invLogRepo },
      ],
    }).compile();

    service = module.get<DeliveryService>(DeliveryService);
  });

  // ============================
  //  findAll
  // ============================
  describe('findAll', () => {
    it('应返回所有发货单含关联', async () => {
      deliveryRepo.find.mockResolvedValue([mockDelivery()]);
      const result = await service.findAll();
      expect(result).toEqual([mockDelivery()]);
      expect(deliveryRepo.find).toHaveBeenCalledWith({
        relations: ['items', 'items.product'],
        order: { createdAt: 'DESC' },
      });
    });
  });

  // ============================
  //  findOne
  // ============================
  describe('findOne', () => {
    it('应返回发货单', async () => {
      const d = mockDelivery();
      deliveryRepo.findOne.mockResolvedValue(d);
      expect(await service.findOne(1)).toEqual(d);
    });

    it('不存在应抛 NotFoundException', async () => {
      deliveryRepo.findOne.mockResolvedValue(null);
      await expect(service.findOne(99)).rejects.toThrow(NotFoundException);
    });
  });

  // ============================
  //  getAfterSaleRecords
  // ============================
  describe('getAfterSaleRecords', () => {
    it('应按合同 ID 查询售后记录', async () => {
      const records = [{ id: 1, contract_id: 1, test_result: '合格' }];
      afterSaleRepo.find.mockResolvedValue(records);
      const result = await service.getAfterSaleRecords(1);
      expect(result).toEqual(records);
      expect(afterSaleRepo.find).toHaveBeenCalledWith({
        where: { contract_id: 1 },
        order: { createdAt: 'DESC' },
      });
    });
  });

  // ============================
  //  create (发货)
  // ============================
  describe('create', () => {
    it('应成功发货：检查库存→扣减库存→合同→shipped', async () => {
      const contract = mockContract('production');
      contractRepo.findOneBy.mockResolvedValue(contract);
      invRepo.findOne.mockResolvedValue({ id: 1, product_id: 1, quantity: 10 });

      const d = mockDelivery();
      deliveryRepo.create.mockReturnValue(d);
      deliveryRepo.save.mockResolvedValue(d);
      itemRepo.create.mockImplementation((data) => data as any);
      invRepo.save.mockResolvedValue({ product_id: 1, quantity: 8 });
      invLogRepo.save.mockResolvedValue({});

      const result = await service.create(1, {
        contract_id: 1,
        logistics_company: '顺丰',
        tracking_no: 'SF123456',
        items: [{ product_id: 1, quantity: 2 }],
      }, 1);

      // 验证库存扣减: 10 - 2 = 8
      expect(invRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ product_id: 1, quantity: 8 }),
      );
      // 验证合同状态更新
      expect(contractRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'shipped' }),
      );
      expect(result.status).toBe('shipped');
      expect(result.logistics_company).toBe('顺丰');
    });

    it('库存不足应抛 BadRequestException', async () => {
      contractRepo.findOneBy.mockResolvedValue(mockContract('production'));
      invRepo.findOne.mockResolvedValue({ id: 1, product_id: 1, quantity: 1 });

      await expect(
        service.create(1, {
          contract_id: 1,
          logistics_company: '顺丰',
          items: [{ product_id: 1, quantity: 2 }],
        }, 1),
      ).rejects.toThrow(BadRequestException);
    });

    it('产品无库存记录应抛 BadRequestException', async () => {
      contractRepo.findOneBy.mockResolvedValue(mockContract('production'));
      invRepo.findOne.mockResolvedValue(null);

      await expect(
        service.create(1, {
          contract_id: 1,
          logistics_company: '顺丰',
          items: [{ product_id: 1, quantity: 1 }],
        }, 1),
      ).rejects.toThrow(BadRequestException);
    });

    it('合同不存在应抛 NotFoundException', async () => {
      contractRepo.findOneBy.mockResolvedValue(null);
      await expect(
        service.create(99, {
          contract_id: 99,
          logistics_company: '顺丰',
          items: [{ product_id: 1, quantity: 1 }],
        }, 1),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ============================
  //  recordAfterSale (售后装机)
  // ============================
  describe('recordAfterSale', () => {
    it('应记录售后并将合同→installing', async () => {
      const shipped = mockContract('shipped');
      contractRepo.findOneBy.mockResolvedValueOnce(shipped);
      afterSaleRepo.save.mockResolvedValue({
        id: 1, contract_id: 1, test_date: '2026-07-11',
        test_result: '合格', remark: '安装完成',
      });
      contractRepo.save.mockResolvedValue(mockContract('installing'));

      const result = await service.recordAfterSale(1, {
        test_date: '2026-07-11',
        test_result: '合格',
        remark: '安装完成',
      }, 1);

      expect(result.test_result).toBe('合格');
      expect(contractRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'installing' }),
      );
    });

    it('非 shipped 状态应抛 BadRequestException', async () => {
      contractRepo.findOneBy.mockResolvedValue(mockContract('production'));
      afterSaleRepo.save.mockResolvedValue({});  // 不会被执行到

      await expect(
        service.recordAfterSale(1, {
          test_date: '2026-07-11',
          test_result: '合格',
        }, 1),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
