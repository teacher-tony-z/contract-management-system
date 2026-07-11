import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';

describe('Contract Lifecycle (E2E)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  // JWT tokens for each role
  let adminToken: string;
  let salesToken: string;
  let financeToken: string;
  let prodToken: string;
  let qcToken: string;

  // Test data IDs
  let productId: number;
  let contractId: number;
  let productionOrderId: number;
  let contractId2: number; // for reject flow

  const TEST_PREFIX = 'E2E_TEST_';
  const API = '/api';

  // =========================================================
  //  Login helper
  // =========================================================
  async function login(username: string, password: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post(`${API}/auth/login`)
      .send({ username, password })
      .expect(201);
    return res.body.access_token;
  }

  async function createTestProduct(token: string): Promise<number> {
    const res = await request(app.getHttpServer())
      .post(`${API}/products`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: `${TEST_PREFIX}测试产品`,
        model: 'E2E-TEST-001',
        unit: '台',
        specs: { material: '测试' },
      });
    return res.body.id;
  }

  function auth(token: string) {
    return { Authorization: `Bearer ${token}` };
  }

  // =========================================================
  //  Setup
  // =========================================================
  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    await app.init();

    dataSource = app.get(DataSource);

    // Login as each role
    adminToken = await login('admin', 'admin123');
    salesToken = await login('sales1', '123456');
    financeToken = await login('finance1', '123456');
    prodToken = await login('prod1', '123456');
    qcToken = await login('qc1', '123456');

    // Create a test product (admin)
    productId = await createTestProduct(adminToken);
  });

  // =========================================================
  //  Cleanup
  // =========================================================
  afterAll(async () => {
    try {
      // 按外键依赖逆序清理测试数据
      await dataSource.query(
        `DELETE FROM inventory_log WHERE reference_type = 'production' AND reference_id IN
          (SELECT id FROM production_orders WHERE contract_id IN
            (SELECT id FROM contracts WHERE customer_name LIKE '${TEST_PREFIX}%'))`
      );
      await dataSource.query(
        `DELETE FROM inventory WHERE product_id IN (SELECT id FROM products WHERE name LIKE '${TEST_PREFIX}%')`
      );
      await dataSource.query(
        `DELETE FROM after_sale_records WHERE contract_id IN (SELECT id FROM contracts WHERE customer_name LIKE '${TEST_PREFIX}%')`
      );
      await dataSource.query(
        `DELETE FROM contract_operations WHERE contract_id IN (SELECT id FROM contracts WHERE customer_name LIKE '${TEST_PREFIX}%')`
      );
      await dataSource.query(
        `DELETE FROM contract_versions WHERE original_id IN (SELECT id FROM contracts WHERE customer_name LIKE '${TEST_PREFIX}%') OR new_id IN (SELECT id FROM contracts WHERE customer_name LIKE '${TEST_PREFIX}%')`
      );
      await dataSource.query(
        `DELETE FROM delivery_items WHERE delivery_id IN (SELECT id FROM delivery_orders WHERE contract_id IN (SELECT id FROM contracts WHERE customer_name LIKE '${TEST_PREFIX}%'))`
      );
      await dataSource.query(
        `DELETE FROM delivery_orders WHERE contract_id IN (SELECT id FROM contracts WHERE customer_name LIKE '${TEST_PREFIX}%')`
      );
      await dataSource.query(
        `DELETE FROM production_log WHERE order_id IN (SELECT id FROM production_orders WHERE contract_id IN (SELECT id FROM contracts WHERE customer_name LIKE '${TEST_PREFIX}%'))`
      );
      await dataSource.query(
        `DELETE FROM production_items WHERE order_id IN (SELECT id FROM production_orders WHERE contract_id IN (SELECT id FROM contracts WHERE customer_name LIKE '${TEST_PREFIX}%'))`
      );
      await dataSource.query(
        `DELETE FROM production_orders WHERE contract_id IN (SELECT id FROM contracts WHERE customer_name LIKE '${TEST_PREFIX}%')`
      );
      await dataSource.query(
        `DELETE FROM contract_items WHERE contract_id IN (SELECT id FROM contracts WHERE customer_name LIKE '${TEST_PREFIX}%')`
      );
      await dataSource.query(
        `DELETE FROM contracts WHERE customer_name LIKE '${TEST_PREFIX}%'`
      );
      await dataSource.query(
        `DELETE FROM products WHERE name LIKE '${TEST_PREFIX}%'`
      );
    } finally {
      await app.close();
    }
  });

  // =========================================================
  //  Tests
  // =========================================================

  // ---- 1. 正向完整流程 ----
  describe('正向流程：创建 → 提交 → 审核 → 生产 → 质检 → 发货 → 安装 → 验收', () => {

    it('1.1 销售创建合同 (draft)', async () => {
      const res = await request(app.getHttpServer())
        .post(`${API}/contracts`)
        .set(auth(salesToken))
        .send({
          customer_name: `${TEST_PREFIX}客户A`,
          customer_phone: '13900139000',
          customer_address: '测试地址',
          items: [{ product_id: productId, quantity: 2, remark: 'E2E测试' }],
        })
        .expect(201);

      expect(res.body.status).toBe('draft');
      expect(res.body.contract_no).toMatch(/^HT\d{12}$/);
      expect(res.body.customer_name).toContain(TEST_PREFIX);
      contractId = res.body.id;
    });

    it('1.2 销售提交审核 (draft → pending)', async () => {
      const res = await request(app.getHttpServer())
        .post(`${API}/contracts/${contractId}/submit`)
        .set(auth(salesToken))
        .expect(201);

      expect(res.body.status).toBe('pending');
      expect(res.body.submit_at).toBeDefined();
    });

    it('1.3 财务审核通过 (pending → approved)', async () => {
      const res = await request(app.getHttpServer())
        .post(`${API}/contracts/${contractId}/audit`)
        .set(auth(financeToken))
        .send({ action: 'pass', remark: '审核通过' })
        .expect(201);

      expect(res.body.status).toBe('approved');
    });

    it('1.4 生产创建工单 (合同 → production, 工单 → pending)', async () => {
      // 验证合同先变成 production
      const contractRes = await request(app.getHttpServer())
        .get(`${API}/contracts/${contractId}`)
        .set(auth(salesToken))
        .expect(200);
      expect(contractRes.body.status).toBe('approved');

      const res = await request(app.getHttpServer())
        .post(`${API}/production`)
        .set(auth(prodToken))
        .send({ contract_id: contractId })
        .expect(201);

      expect(res.body.status).toBe('pending');
      expect(res.body.contract_id).toBe(contractId);
      productionOrderId = res.body.id;
    });

    it('1.5 生产开始工单 (pending → in_progress)', async () => {
      const res = await request(app.getHttpServer())
        .put(`${API}/production/${productionOrderId}/start`)
        .set(auth(prodToken))
        .expect(200);

      expect(res.body.status).toBe('in_progress');
      expect(res.body.started_at).toBeDefined();
    });

    it('1.6 生产完成工单 (in_progress → completed)', async () => {
      const res = await request(app.getHttpServer())
        .put(`${API}/production/${productionOrderId}/complete`)
        .set(auth(prodToken))
        .expect(200);

      expect(res.body.status).toBe('completed');
      expect(res.body.completed_at).toBeDefined();
    });

    it('1.7 质检通过 (QC pass)', async () => {
      const res = await request(app.getHttpServer())
        .put(`${API}/production/${productionOrderId}/qc`)
        .set(auth(qcToken))
        .send({ action: 'pass', remark: '质检合格' })
        .expect(200);

      // 质检项被标记 pass
      expect(res.body.items[0].qc_status).toBe('pass');
      // 库存应已自动增加
      const invRes = await request(app.getHttpServer())
        .get(`${API}/inventory/${productId}`)
        .set(auth(prodToken))
        .expect(200);
      expect(invRes.body.quantity).toBeGreaterThanOrEqual(2);
    });

    it('1.8 生产创建发货单 (shipped)', async () => {
      const res = await request(app.getHttpServer())
        .post(`${API}/delivery`)
        .set(auth(prodToken))
        .send({
          contract_id: contractId,
          logistics_company: '测试物流',
          tracking_no: 'TEST123456',
          items: [{ product_id: productId, quantity: 2 }],
        })
        .expect(201);

      expect(res.body.status).toBe('shipped');
      expect(res.body.logistics_company).toBe('测试物流');

      // 验证合同状态变为 shipped
      const contractRes = await request(app.getHttpServer())
        .get(`${API}/contracts/${contractId}`)
        .set(auth(salesToken))
        .expect(200);
      expect(contractRes.body.status).toBe('shipped');
    });

    it('1.9 生产记录售后装机 (installing)', async () => {
      const res = await request(app.getHttpServer())
        .post(`${API}/delivery/after-sale/${contractId}`)
        .set(auth(prodToken))
        .send({
          test_date: '2026-07-11',
          test_result: '运行正常',
          remark: '安装调试完成',
        })
        .expect(201);

      expect(res.body.test_result).toBe('运行正常');

      // 验证合同状态变为 installing
      const contractRes = await request(app.getHttpServer())
        .get(`${API}/contracts/${contractId}`)
        .set(auth(salesToken))
        .expect(200);
      expect(contractRes.body.status).toBe('installing');
    });

    it('1.10 销售交付确认 (delivered)', async () => {
      const res = await request(app.getHttpServer())
        .post(`${API}/contracts/${contractId}/complete`)
        .set(auth(salesToken))
        .expect(201);

      expect(res.body.status).toBe('delivered');
      expect(res.body.delivered_by).toBeDefined();
    });
  });

  // ---- 2. 审核驳回 & 重新提交 ----
  describe('逆向流程：提交 → 驳回 → 重新提交 → 通过', () => {
    let rejectContractId: number;

    it('2.1 销售创建并提交合同', async () => {
      const createRes = await request(app.getHttpServer())
        .post(`${API}/contracts`)
        .set(auth(salesToken))
        .send({
          customer_name: `${TEST_PREFIX}客户B(驳回)`,
          items: [{ product_id: productId, quantity: 1 }],
        })
        .expect(201);
      rejectContractId = createRes.body.id;
      contractId2 = rejectContractId;

      await request(app.getHttpServer())
        .post(`${API}/contracts/${rejectContractId}/submit`)
        .set(auth(salesToken))
        .expect(201);
    });

    it('2.2 财务审核驳回 (pending → returned)', async () => {
      const res = await request(app.getHttpServer())
        .post(`${API}/contracts/${rejectContractId}/audit`)
        .set(auth(financeToken))
        .send({ action: 'reject', remark: '缺少客户资质文件' })
        .expect(201);

      expect(res.body.status).toBe('returned');
      expect(res.body.review_remark).toBe('缺少客户资质文件');
    });

    it('2.3 销售重新提交 (returned → pending)', async () => {
      const res = await request(app.getHttpServer())
        .post(`${API}/contracts/${rejectContractId}/submit`)
        .set(auth(salesToken))
        .expect(201);

      expect(res.body.status).toBe('pending');
    });

    it('2.4 财务最终通过', async () => {
      const res = await request(app.getHttpServer())
        .post(`${API}/contracts/${rejectContractId}/audit`)
        .set(auth(financeToken))
        .send({ action: 'pass', remark: '补充材料齐全，通过' })
        .expect(201);

      expect(res.body.status).toBe('approved');
      expect(res.body.review_remark).toBe('');
    });
  });

  // ---- 3. 权限校验 ----
  describe('权限校验：越权操作应返回 403', () => {
    it('3.1 销售不能审核合同', async () => {
      await request(app.getHttpServer())
        .post(`${API}/contracts/${contractId}/audit`)
        .set(auth(salesToken))
        .send({ action: 'pass' })
        .expect(403);
    });

    it('3.2 财务不能创建工单', async () => {
      await request(app.getHttpServer())
        .post(`${API}/production`)
        .set(auth(financeToken))
        .send({ contract_id: contractId })
        .expect(403);
    });

    it('3.3 质检不能创建合同', async () => {
      await request(app.getHttpServer())
        .post(`${API}/contracts`)
        .set(auth(qcToken))
        .send({
          customer_name: `${TEST_PREFIX}越权测试`,
          items: [{ product_id: productId, quantity: 1 }],
        })
        .expect(403);
    });

    it('3.4 未登录请求返回 401', async () => {
      await request(app.getHttpServer())
        .post(`${API}/contracts`)
        .send({ customer_name: 'test', items: [] })
        .expect(401);
    });
  });

  // ---- 4. 操作记录 ----
  describe('操作记录', () => {
    it('4.1 应返回完整的操作日志链', async () => {
      const res = await request(app.getHttpServer())
        .get(`${API}/contracts/${contractId}/operations`)
        .set(auth(adminToken))
        .expect(200);

      const actions = res.body.map((o: any) => o.action);
      // 正向流程应有创建、提交、审核、生产、质检、发货、售后、验收等记录
      expect(actions).toContain('submit');
      expect(actions).toContain('audit_pass');
      expect(actions).toContain('complete');
    });
  });
});
