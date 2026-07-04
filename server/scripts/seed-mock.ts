/**
 * 模拟数据注入脚本
 * 运行: cd server && npx tsx scripts/seed-mock.ts
 */
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../src/modules/auth/entities/user.entity';
import { Role } from '../src/modules/roles/entities/role.entity';
import { UserRole } from '../src/modules/roles/entities/user-role.entity';
import { Permission } from '../src/modules/roles/entities/permission.entity';
import { RolePermission } from '../src/modules/roles/entities/role-permission.entity';
import { Product } from '../src/modules/products/entities/product.entity';
import { Contract } from '../src/modules/contracts/entities/contract.entity';
import { ContractItem } from '../src/modules/contracts/entities/contract-item.entity';
import { ContractOperation } from '../src/modules/contracts/entities/contract-operation.entity';
import { ContractAttachment } from '../src/modules/contracts/entities/contract-attachment.entity';
import { ContractVersion } from '../src/modules/contracts/entities/contract-version.entity';
import { Inventory } from '../src/modules/inventory/entities/inventory.entity';
import { InventoryLog } from '../src/modules/inventory/entities/inventory-log.entity';
import { ProductionOrder } from '../src/modules/production/entities/production-order.entity';
import { ProductionItem } from '../src/modules/production/entities/production-item.entity';
import { ProductionLog } from '../src/modules/production/entities/production-log.entity';
import { DeliveryOrder } from '../src/modules/delivery/entities/delivery-order.entity';
import { DeliveryItem } from '../src/modules/delivery/entities/delivery-item.entity';
import { AfterSaleRecord } from '../src/modules/delivery/entities/after-sale-record.entity';

const dataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'contract_db',
  entities: [
    User, Role, UserRole, Permission, RolePermission,
    Product, Contract, ContractItem, ContractOperation,
    ContractAttachment, ContractVersion,
    Inventory, InventoryLog,
    ProductionOrder, ProductionItem, ProductionLog,
    DeliveryOrder, DeliveryItem, AfterSaleRecord,
  ],
  synchronize: false,
});

async function seed() {
  await dataSource.initialize();
  console.log('🔄 数据库连接成功，开始注入模拟数据...\n');

  const userRepo = dataSource.getRepository(User);
  const roleRepo = dataSource.getRepository(Role);
  const userRoleRepo = dataSource.getRepository(UserRole);
  const productRepo = dataSource.getRepository(Product);
  const contractRepo = dataSource.getRepository(Contract);
  const contractItemRepo = dataSource.getRepository(ContractItem);
  const contractOpRepo = dataSource.getRepository(ContractOperation);
  const inventoryRepo = dataSource.getRepository(Inventory);
  const inventoryLogRepo = dataSource.getRepository(InventoryLog);
  const productionOrderRepo = dataSource.getRepository(ProductionOrder);
  const productionItemRepo = dataSource.getRepository(ProductionItem);
  const productionLogRepo = dataSource.getRepository(ProductionLog);
  const deliveryOrderRepo = dataSource.getRepository(DeliveryOrder);
  const deliveryItemRepo = dataSource.getRepository(DeliveryItem);
  const afterSaleRepo = dataSource.getRepository(AfterSaleRecord);

  // ===== 1. 获取现有角色 =====
  const roles = await roleRepo.find();
  const roleMap = Object.fromEntries(roles.map(r => [r.name, r.id]));
  console.log('✅ 已获取角色:', Object.keys(roleMap).join(', '));

  // ===== 2. 获取现有用户 =====
  const users = await userRepo.find({ relations: ['userRoles'] });
  const getUserByRole = (roleName: string) =>
    users.find(u => u.userRoles?.some(ur => ur.role_id === roleMap[roleName]));
  const admin = users.find(u => u.username === 'admin')!;
  const sales1 = getUserByRole('销售')!;
  const finance1 = getUserByRole('财务')!;
  const prod1 = getUserByRole('生产')!;
  const qc1 = getUserByRole('质检')!;
  console.log('✅ 已获取用户: admin, sales1, finance1, prod1, qc1');

  // ===== 3. 创建产品 =====
  const productData = [
    { model: 'XPS-2000', name: '智能控制柜 XPS-2000', specs: {尺寸: '800x600x200mm', 材质: '不锈钢', 防护等级: 'IP65'}, unit: '台' },
    { model: 'PLC-S7-1200', name: '西门子 PLC S7-1200', specs: {CPU: '1214C', 内存: '4MB', 通信: 'Profinet'}, unit: '台' },
    { model: 'VFD-7.5kW', name: '变频器 7.5kW', specs: {功率: '7.5kW', 输入: '三相380V', 输出: '0-500Hz'}, unit: '台' },
    { model: 'SENSOR-T100', name: '温度传感器 T100', specs: {量程: '-50~200°C', 精度: '±0.5°C', 输出: '4-20mA'}, unit: '支' },
    { model: 'CABLE-10M', name: '屏蔽电缆 10米', specs: {规格: '4x1.5mm²', 屏蔽: '双层', 长度: '10m'}, unit: '根' },
    { model: 'HMI-TP700', name: '触摸屏 TP700', specs: {尺寸: '7寸', 分辨率: '800x480', 接口: 'RS232/485'}, unit: '台' },
    { model: 'PSU-24V-10A', name: '开关电源 24V/10A', specs: {输入: 'AC220V', 输出: 'DC24V/10A', 效率: '90%'}, unit: '台' },
    { model: 'RELAY-8CH', name: '8路继电器模块', specs: {通道: '8路', 触点: '10A/250VAC', 控制: 'DC24V'}, unit: '块' },
  ];

  // 检查是否已有产品
  const existingProducts = await productRepo.count();
  if (existingProducts > 0) {
    console.log('⏭️  产品已存在，跳过创建');
  } else {
    const products = await productRepo.save(
      productData.map((p, i) => productRepo.create({ ...p, status: 1 }))
    );
    console.log(`✅ 创建了 ${products.length} 个产品`);

    // 创建初始库存
    for (const p of products) {
      await inventoryRepo.save(
        inventoryRepo.create({
          product_id: p.id,
          quantity: 50 + Math.floor(Math.random() * 200),
          location: ['A区-01架', 'A区-02架', 'B区-01架', 'B区-02架', 'C区-01架'][Math.floor(Math.random() * 5)],
        })
      );
    }
    console.log(`✅ 为 ${products.length} 个产品创建了初始库存`);
  }

  // 重新获取产品
  const products = await productRepo.find();
  const p = (idx: number) => products[idx % products.length];

  // ===== 4. 创建合同 =====
  const existingContracts = await contractRepo.count();
  if (existingContracts > 0) {
    console.log('⏭️  合同已存在，跳过创建');
  } else {
    const now = new Date();
    const daysAgo = (n: number) => new Date(now.getTime() - n * 86400000);

    // 合同1: 草稿 - 销售1创建
    const c1 = await contractRepo.save(contractRepo.create({
      contract_no: `HT${now.toISOString().slice(0, 10).replace(/-/g, '')}0001`,
      customer_name: '华强电子科技公司',
      customer_phone: '0755-83210001',
      customer_address: '深圳市福田区华强北路1001号',
      status: 'draft',
      submitter_id: sales1.id,
      is_latest: true,
      createdAt: daysAgo(5),
    }));
    await contractItemRepo.save([
      contractItemRepo.create({ contract_id: c1.id, product_id: p(0).id, quantity: 2, remark: '主控柜体' }),
      contractItemRepo.create({ contract_id: c1.id, product_id: p(1).id, quantity: 2, remark: '' }),
      contractItemRepo.create({ contract_id: c1.id, product_id: p(4).id, quantity: 10, remark: '连接线缆' }),
    ]);
    await contractOpRepo.save({ contract_id: c1.id, operator_id: sales1.id, action: 'create', createdAt: daysAgo(5) });
    console.log('✅ 合同1: 草稿 - 华强电子');

    // 合同2: 待审核 - 销售1提交
    const c2 = await contractRepo.save(contractRepo.create({
      contract_no: `HT${now.toISOString().slice(0, 10).replace(/-/g, '')}0002`,
      customer_name: '苏州工业园区自动化设备有限公司',
      customer_phone: '0512-62880001',
      customer_address: '苏州市工业园区星湖街328号',
      status: 'pending',
      submitter_id: sales1.id,
      submit_at: daysAgo(3),
      is_latest: true,
      createdAt: daysAgo(4),
    }));
    await contractItemRepo.save([
      contractItemRepo.create({ contract_id: c2.id, product_id: p(2).id, quantity: 5, remark: '' }),
      contractItemRepo.create({ contract_id: c2.id, product_id: p(5).id, quantity: 3, remark: '配安装支架' }),
      contractItemRepo.create({ contract_id: c2.id, product_id: p(6).id, quantity: 5, remark: '' }),
    ]);
    await contractOpRepo.save([
      { contract_id: c2.id, operator_id: sales1.id, action: 'create', createdAt: daysAgo(4) },
      { contract_id: c2.id, operator_id: sales1.id, action: 'submit', createdAt: daysAgo(3) },
    ]);
    console.log('✅ 合同2: 待审核 - 苏州工业园区自动化设备');

    // 合同3: 已审核(生产中) - 销售1提交，财务审核通过
    const c3 = await contractRepo.save(contractRepo.create({
      contract_no: `HT${now.toISOString().slice(0, 10).replace(/-/g, '')}0003`,
      customer_name: '成都天翔电气集团',
      customer_phone: '028-85310001',
      customer_address: '成都市高新区天府大道999号',
      status: 'production',
      submitter_id: sales1.id,
      submit_at: daysAgo(7),
      reviewer_id: finance1.id,
      review_at: daysAgo(6),
      is_latest: true,
      createdAt: daysAgo(8),
    }));
    await contractItemRepo.save([
      contractItemRepo.create({ contract_id: c3.id, product_id: p(0).id, quantity: 3, remark: '定制颜色:RAL7035' }),
      contractItemRepo.create({ contract_id: c3.id, product_id: p(1).id, quantity: 3, remark: '' }),
      contractItemRepo.create({ contract_id: c3.id, product_id: p(2).id, quantity: 3, remark: '' }),
      contractItemRepo.create({ contract_id: c3.id, product_id: p(3).id, quantity: 6, remark: '含传感器安装座' }),
      contractItemRepo.create({ contract_id: c3.id, product_id: p(7).id, quantity: 2, remark: '' }),
    ]);
    await contractOpRepo.save([
      { contract_id: c3.id, operator_id: sales1.id, action: 'create', createdAt: daysAgo(8) },
      { contract_id: c3.id, operator_id: sales1.id, action: 'submit', createdAt: daysAgo(7) },
      { contract_id: c3.id, operator_id: finance1.id, action: 'audit_pass', remark: '审核通过，请安排生产', createdAt: daysAgo(6) },
    ]);
    console.log('✅ 合同3: 生产中 - 成都天翔电气');

    // 合同4: 已发货 - 从生产到发货完整流程
    const c4 = await contractRepo.save(contractRepo.create({
      contract_no: `HT${now.toISOString().slice(0, 10).replace(/-/g, '')}0004`,
      customer_name: '北京北方重工有限公司',
      customer_phone: '010-67890001',
      customer_address: '北京市大兴区亦庄经济开发区荣华南路100号',
      status: 'shipped',
      submitter_id: sales1.id,
      submit_at: daysAgo(15),
      reviewer_id: finance1.id,
      review_at: daysAgo(14),
      delivery_at: daysAgo(2),
      is_latest: true,
      createdAt: daysAgo(16),
    }));
    await contractItemRepo.save([
      contractItemRepo.create({ contract_id: c4.id, product_id: p(0).id, quantity: 5, remark: '含安装配件包' }),
      contractItemRepo.create({ contract_id: c4.id, product_id: p(1).id, quantity: 5, remark: '' }),
      contractItemRepo.create({ contract_id: c4.id, product_id: p(5).id, quantity: 5, remark: '' }),
      contractItemRepo.create({ contract_id: c4.id, product_id: p(4).id, quantity: 20, remark: '每根10米' }),
    ]);
    await contractOpRepo.save([
      { contract_id: c4.id, operator_id: sales1.id, action: 'create', createdAt: daysAgo(16) },
      { contract_id: c4.id, operator_id: sales1.id, action: 'submit', createdAt: daysAgo(15) },
      { contract_id: c4.id, operator_id: finance1.id, action: 'audit_pass', remark: '同意', createdAt: daysAgo(14) },
    ]);
    console.log('✅ 合同4: 已发货 - 北京北方重工');

    console.log('✅ 创建了 4 份合同');
  }

  // ===== 5. 创建生产工单 =====
  const existingOrders = await productionOrderRepo.count();
  if (existingOrders > 0) {
    console.log('⏭️  生产工单已存在，跳过创建');
  } else {
    const approvedContract = await contractRepo.findOne({ where: { status: 'production' }, relations: ['items'] });
    if (approvedContract) {
      const po = await productionOrderRepo.save(productionOrderRepo.create({
        contract_id: approvedContract.id,
        status: 'in_progress',
        operator_id: prod1.id,
        started_at: new Date(Date.now() - 4 * 86400000),
        createdAt: new Date(Date.now() - 5 * 86400000),
      }));
      for (const item of approvedContract.items) {
        await productionItemRepo.save(productionItemRepo.create({
          order_id: po.id,
          product_id: item.product_id,
          quantity: item.quantity,
          qc_status: 'pending',
        }));
      }
      await productionLogRepo.save({ order_id: po.id, operator_id: prod1.id, action: 'create' });
      await productionLogRepo.save({ order_id: po.id, operator_id: prod1.id, action: 'start' });
      console.log('✅ 生产工单1: 进行中 (成都天翔电气)');
    }

    // 已完成生产+质检的工单
    const shippedContract = await contractRepo.findOne({ where: { status: 'shipped' }, relations: ['items'] });
    if (shippedContract) {
      const po2 = await productionOrderRepo.save(productionOrderRepo.create({
        contract_id: shippedContract.id,
        status: 'completed',
        operator_id: prod1.id,
        started_at: new Date(Date.now() - 12 * 86400000),
        completed_at: new Date(Date.now() - 8 * 86400000),
        createdAt: new Date(Date.now() - 13 * 86400000),
      }));
      for (const item of shippedContract.items) {
        await productionItemRepo.save(productionItemRepo.create({
          order_id: po2.id,
          product_id: item.product_id,
          quantity: item.quantity,
          qc_status: 'pass',
          qc_operator_id: qc1.id,
          qc_at: new Date(Date.now() - 7 * 86400000),
        }));
      }
      await productionLogRepo.save([
        { order_id: po2.id, operator_id: prod1.id, action: 'create' },
        { order_id: po2.id, operator_id: prod1.id, action: 'start' },
        { order_id: po2.id, operator_id: prod1.id, action: 'complete' },
        { order_id: po2.id, operator_id: qc1.id, action: 'qc_pass' },
      ]);
      console.log('✅ 生产工单2: 已完成 (北京北方重工)');
    }

    console.log('✅ 创建了生产工单');
  }

  // ===== 6. 创建发货单 =====
  const existingDeliveries = await deliveryOrderRepo.count();
  if (existingDeliveries > 0) {
    console.log('⏭️  发货单已存在，跳过创建');
  } else {
    const shippedContract = await contractRepo.findOne({ where: { status: 'shipped' }, relations: ['items'] });
    if (shippedContract) {
      const delivery = await deliveryOrderRepo.save(deliveryOrderRepo.create({
        contract_id: shippedContract.id,
        status: 'shipped',
        logistics_company: '顺丰速运',
        tracking_no: `SF${Date.now()}`,
        shipped_by: prod1.id,
        shipped_at: new Date(Date.now() - 2 * 86400000),
        createdAt: new Date(Date.now() - 2 * 86400000),
      }));
      for (const item of shippedContract.items) {
        await deliveryItemRepo.save(deliveryItemRepo.create({
          delivery_id: delivery.id,
          product_id: item.product_id,
          quantity: item.quantity,
        }));
      }
      console.log('✅ 发货单1: 已发货 (北京北方重工 → 顺丰速运)');
    }
    console.log('✅ 创建了发货单');
  }

  // ===== 总结 =====
  const counts = {
    products: await productRepo.count(),
    contracts: await contractRepo.count(),
    contractItems: await contractItemRepo.count(),
    productionOrders: await productionOrderRepo.count(),
    productionItems: await productionItemRepo.count(),
    deliveries: await deliveryOrderRepo.count(),
    inventory: await inventoryRepo.count(),
  };

  console.log('\n📊 数据统计:');
  for (const [key, value] of Object.entries(counts)) {
    console.log(`  ${key}: ${value}`);
  }

  console.log('\n🎉 模拟数据注入完成！');
  console.log('📝 使用测试账号登录即可查看: admin/admin123, sales1/123456, finance1/123456');

  await dataSource.destroy();
}

seed().catch(err => {
  console.error('❌ 注入失败:', err);
  process.exit(1);
});
