# 合同流程管理系统 — 设计文档

**日期**: 2026-07-04  
**版本**: v1.0  
**状态**: 定稿

---

## 1. 项目概述

### 1.1 业务背景

公司内部合同流程管理系统，覆盖从销售录入合同、财务评审、生产管理、库存管理、质检到交付售后的完整业务闭环。

### 1.2 核心角色（5个）

| 角色 | 职责 |
|------|------|
| 管理员 | 用户管理、角色权限配置、系统基础数据维护 |
| 销售 | 录入合同、提交审批、发起合同变更、交付确认 |
| 财务 | 评审合同（通过/退回） |
| 生产 | 查看库存、创建生产工单、发货、售后装机测试 |
| 质检 | 生产完成后质检（通过/退回） |

### 1.3 技术选型

| 层 | 技术 | 版本 |
|----|------|------|
| 前端框架 | Vue 3 + TypeScript | — |
| 构建工具 | Vite 5 | — |
| UI 组件库 | Element Plus | — |
| 状态管理 | Pinia | — |
| HTTP 客户端 | Axios | — |
| 后端框架 | NestJS 10 + TypeScript | — |
| ORM | TypeORM | — |
| 数据库 | PostgreSQL 15+ | — |
| 认证 | JWT + Passport | — |
| 模块通信 | @nestjs/event-emitter | — |
| 部署 | Docker + Docker Compose + Nginx | — |

---

## 2. 系统架构

### 2.1 总体架构

采用**模块化单体 + 事件驱动**架构。一个 NestJS 项目物理上按业务模块拆分，模块之间通过事件（EventEmitter）解耦通信，不直接 import 对方的 Service。

```
┌──────────────────────────────────────────────────────────┐
│                    前端 Vue3 + TypeScript                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐ │
│  │ Element   │  │  Router   │  │  Pinia   │  │  Axios   │ │
│  │   Plus    │  │ (权限)    │  │  Store   │  │  封装    │ │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘ │
└───────────────────────┬───────────────────────────────────┘
                        │ HTTP / JWT Token
┌───────────────────────▼───────────────────────────────────┐
│                   后端 NestJS + TypeScript                   │
│                                                           │
│  ┌──────────┐         事件总线                             │
│  │AuthGuard │   ┌────────────────────────────┐            │
│  │RolesGuard│   │ ContractApprovedEvent       │            │
│  │权限守卫   │   │ → ProductionModule 监听     │            │
│  └──────────┘   │ ProductionDoneEvent         │            │
│                 │ → QCModule 监听              │            │
│  ┌──────┐ ┌────┐└────────────────────────────┘  ┌──────┐ │
│  │ 合同  │ │ 库存 │         ┌──────┐  ┌──────┐  │ 售后  │ │
│  │ 模块  │ │ 模块 │         │ 生产  │  │ 交付  │  │ 模块  │ │
│  └──────┘ └────┘         │ 模块  │  │ 模块  │  └──────┘ │
│                           └──────┘  └──────┘            │
│  ┌──────┐ ┌──────┐                                       │
│  │ 产品  │ │ 权限  │                                       │
│  │ 目录  │ │ 模块  │                                       │
│  └──────┘ └──────┘                                       │
│                      │                                    │
│              ┌───────▼────────┐                           │
│              │  PostgreSQL     │                           │
│              │  (TypeORM)      │                           │
│              └────────────────┘                           │
└───────────────────────────────────────────────────────────┘
```

### 2.2 部署架构

单台云服务器（建议 2C4G）即可支撑 100 人并发：

```
云服务器
├── Nginx → 反向代理 API / 托管前端静态文件
├── Docker
│   ├── app 容器    — NestJS 后端
│   └── postgres 容器 — PostgreSQL 数据库
└── 前端构建产物    — Nginx 直接托管
```

### 2.3 模块间事件通信

| 事件 | 触发方 | 监听方 | 触发条件 |
|------|--------|--------|---------|
| `contract.approved` | 合同模块 | 生产模块 | 财务评审通过 |
| `production.completed` | 生产模块 | 质检模块 | 生产完成 |
| `qc.passed` | 质检模块 | 交付模块 | 质检通过 |
| `qc.rejected` | 质检模块 | 生产模块 | 质检退回 |
| `delivery.shipped` | 交付模块 | 合同模块 | 发货完成 |
| `after-sale.completed` | 交付模块 | 合同模块 | 售后装机完成 |
| `contract.terminated` | 合同模块 | 库存模块 | 合同终止作废 |

---

## 3. 数据库模型设计

### 3.1 ER 关系概览

```
users ── user_roles ── roles ── role_permissions ── permissions
                                          │
products ── contract_items ── contracts ── contract_attachments
   │                          │
   │                          ├── contract_versions
   │                          └── contract_operations
   │
inventory ── inventory_log
   │
   └── production_items ── production_orders ── production_log
                                   │
                             delivery_orders ── delivery_items
                                   │
                             after_sale_records
```

### 3.2 表结构

#### 用户与权限

```sql
-- 用户
CREATE TABLE users (
  id            SERIAL PRIMARY KEY,
  username      VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  real_name     VARCHAR(50) NOT NULL,
  phone         VARCHAR(20),
  status        SMALLINT DEFAULT 1, -- 1=启用 0=禁用
  created_at    TIMESTAMP DEFAULT NOW(),
  updated_at    TIMESTAMP DEFAULT NOW()
);

-- 角色
CREATE TABLE roles (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(50) UNIQUE NOT NULL, -- 管理员/销售/财务/生产/质检
  description VARCHAR(255)
);

-- 权限
CREATE TABLE permissions (
  id          SERIAL PRIMARY KEY,
  code        VARCHAR(100) UNIQUE NOT NULL, -- e.g. 'contract:audit'
  name        VARCHAR(100) NOT NULL,
  module      VARCHAR(50) NOT NULL,          -- e.g. 'contract'
  created_at  TIMESTAMP DEFAULT NOW()
);

-- 角色权限关联
CREATE TABLE role_permissions (
  role_id       INTEGER REFERENCES roles(id),
  permission_id INTEGER REFERENCES permissions(id),
  PRIMARY KEY (role_id, permission_id)
);

-- 用户角色关联（支持多角色）
CREATE TABLE user_roles (
  user_id INTEGER REFERENCES users(id),
  role_id INTEGER REFERENCES roles(id),
  PRIMARY KEY (user_id, role_id)
);
```

#### 产品目录

```sql
CREATE TABLE products (
  id          SERIAL PRIMARY KEY,
  model       VARCHAR(100) NOT NULL,        -- 设备型号
  name        VARCHAR(200) NOT NULL,        -- 设备名称
  specs       JSONB,                        -- 规格参数
  unit        VARCHAR(20) DEFAULT '台',     -- 单位
  status      SMALLINT DEFAULT 1,           -- 1=启用 0=停用
  created_at  TIMESTAMP DEFAULT NOW(),
  updated_at  TIMESTAMP DEFAULT NOW()
);
```

#### 合同管理

```sql
-- 合同主表
CREATE TABLE contracts (
  id              SERIAL PRIMARY KEY,
  contract_no     VARCHAR(50) UNIQUE NOT NULL, -- 自动生成：HT+年月日+序号
  customer_name   VARCHAR(200) NOT NULL,
  customer_phone  VARCHAR(20),
  customer_address VARCHAR(500),
  status          VARCHAR(20) NOT NULL DEFAULT 'draft',
  -- 状态枚举: draft/pending/approved/returned/production/shipped/installing/delivered/cancelled
  submitter_id    INTEGER REFERENCES users(id),
  submit_at       TIMESTAMP,
  reviewer_id     INTEGER REFERENCES users(id),
  review_at       TIMESTAMP,
  review_remark   VARCHAR(500),
  delivery_at     TIMESTAMP,
  after_sale_at   TIMESTAMP,
  delivered_by    INTEGER REFERENCES users(id),
  is_latest       BOOLEAN DEFAULT TRUE,     -- 变更时区分最新版本
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW()
);

-- 合同设备明细
CREATE TABLE contract_items (
  id          SERIAL PRIMARY KEY,
  contract_id INTEGER REFERENCES contracts(id),
  product_id  INTEGER REFERENCES products(id),
  quantity    INTEGER NOT NULL CHECK (quantity > 0),
  remark      VARCHAR(255)
);

-- 合同附件
CREATE TABLE contract_attachments (
  id          SERIAL PRIMARY KEY,
  contract_id INTEGER REFERENCES contracts(id),
  file_name   VARCHAR(255) NOT NULL,
  file_path   VARCHAR(500) NOT NULL,
  uploader_id INTEGER REFERENCES users(id),
  created_at  TIMESTAMP DEFAULT NOW()
);

-- 合同变更版本记录
CREATE TABLE contract_versions (
  id            SERIAL PRIMARY KEY,
  original_id   INTEGER REFERENCES contracts(id), -- 原合同ID
  new_id        INTEGER REFERENCES contracts(id),  -- 新合同ID
  change_reason VARCHAR(500),
  changed_by    INTEGER REFERENCES users(id),
  created_at    TIMESTAMP DEFAULT NOW()
);

-- 合同操作日志
CREATE TABLE contract_operations (
  id          SERIAL PRIMARY KEY,
  contract_id INTEGER REFERENCES contracts(id),
  operator_id INTEGER REFERENCES users(id),
  action      VARCHAR(50) NOT NULL,  -- submit/audit_pass/audit_reject/change/etc
  remark      VARCHAR(500),
  created_at  TIMESTAMP DEFAULT NOW()
);
```

**合同编号生成规则**: `HT` + `YYYYMMDD` + `4位序号`，示例：HT202607040001

#### 库存管理

```sql
CREATE TABLE inventory (
  id          SERIAL PRIMARY KEY,
  product_id  INTEGER UNIQUE REFERENCES products(id),
  quantity    INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  location    VARCHAR(100),         -- 库位
  updated_at  TIMESTAMP DEFAULT NOW()
);

CREATE TABLE inventory_log (
  id              SERIAL PRIMARY KEY,
  product_id      INTEGER REFERENCES products(id),
  change_type     VARCHAR(20) NOT NULL, -- inbound/outbound/produce/terminate
  quantity_before INTEGER NOT NULL,
  quantity_change INTEGER NOT NULL,
  quantity_after  INTEGER NOT NULL,
  reference_type  VARCHAR(20),          -- contract/production/terminate
  reference_id    INTEGER,
  operator_id     INTEGER REFERENCES users(id),
  created_at      TIMESTAMP DEFAULT NOW()
);
```

#### 生产管理

```sql
CREATE TABLE production_orders (
  id          SERIAL PRIMARY KEY,
  contract_id INTEGER REFERENCES contracts(id),
  status      VARCHAR(20) NOT NULL DEFAULT 'pending',
  -- pending/in_progress/completed
  started_at  TIMESTAMP,
  completed_at TIMESTAMP,
  operator_id INTEGER REFERENCES users(id),
  created_at  TIMESTAMP DEFAULT NOW(),
  updated_at  TIMESTAMP DEFAULT NOW()
);

-- 一个合同只对应一个生产工单，但工单可包含多个产品
CREATE TABLE production_items (
  id            SERIAL PRIMARY KEY,
  order_id      INTEGER REFERENCES production_orders(id),
  product_id    INTEGER REFERENCES products(id),
  quantity      INTEGER NOT NULL CHECK (quantity > 0),
  qc_status     VARCHAR(20) DEFAULT 'pending',  -- pending/pass/reject
  qc_operator_id INTEGER REFERENCES users(id),
  qc_at         TIMESTAMP,
  qc_remark     VARCHAR(500)
);

CREATE TABLE production_log (
  id          SERIAL PRIMARY KEY,
  order_id    INTEGER REFERENCES production_orders(id),
  action      VARCHAR(50) NOT NULL,  -- start/complete/qc_pass/qc_reject/rework
  operator_id INTEGER REFERENCES users(id),
  remark      VARCHAR(500),
  created_at  TIMESTAMP DEFAULT NOW()
);
```

#### 交付模块

```sql
CREATE TABLE delivery_orders (
  id                SERIAL PRIMARY KEY,
  contract_id       INTEGER REFERENCES contracts(id),
  status            VARCHAR(20) DEFAULT 'pending',  -- pending/shipped/installed/delivered
  logistics_company VARCHAR(100),
  tracking_no       VARCHAR(100),
  shipped_at        TIMESTAMP,
  shipped_by        INTEGER REFERENCES users(id),
  created_at        TIMESTAMP DEFAULT NOW()
);

CREATE TABLE delivery_items (
  id          SERIAL PRIMARY KEY,
  delivery_id INTEGER REFERENCES delivery_orders(id),
  product_id  INTEGER REFERENCES products(id),
  quantity    INTEGER NOT NULL CHECK (quantity > 0)
);

CREATE TABLE after_sale_records (
  id          SERIAL PRIMARY KEY,
  contract_id INTEGER REFERENCES contracts(id),
  test_date   DATE NOT NULL,
  test_result VARCHAR(255) NOT NULL,
  tester_id   INTEGER REFERENCES users(id),
  remark      VARCHAR(500),
  created_at  TIMESTAMP DEFAULT NOW()
);
```

#### 统一操作审计

```sql
CREATE TABLE operation_logs (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER REFERENCES users(id),
  username    VARCHAR(50),
  role_name   VARCHAR(50),
  action      VARCHAR(100) NOT NULL,
  module      VARCHAR(50) NOT NULL,
  target_type VARCHAR(50),
  target_id   INTEGER,
  detail      TEXT,
  ip          VARCHAR(50),
  created_at  TIMESTAMP DEFAULT NOW()
);
```

---

## 4. 模块详细设计

### 4.1 权限管理模块

**管理员专有模块**，管理用户、角色、权限。

| HTTP | 路径 | 说明 |
|------|------|------|
| GET/POST | `/api/users` | 用户列表 / 创建 |
| GET/PUT/DELETE | `/api/users/:id` | 用户详情 / 编辑 / 删除 |
| PUT | `/api/users/:id/status` | 启用/禁用用户 |
| GET/POST | `/api/roles` | 角色列表 / 创建角色 |
| GET/PUT/DELETE | `/api/roles/:id` | 角色详情 / 编辑 / 删除 |
| GET | `/api/permissions` | 权限列表（含分组） |
| PUT | `/api/roles/:id/permissions` | 配置角色权限 |

**预定义权限清单**：

| 权限 code | 名称 | 模块 | 默认分配角色 |
|-----------|------|------|-------------|
| `contract:create` | 创建合同 | 合同 | 销售 |
| `contract:edit` | 编辑合同 | 合同 | 销售 |
| `contract:submit` | 提交合同 | 合同 | 销售 |
| `contract:delete` | 删除合同 | 合同 | 销售 |
| `contract:audit` | 审核合同 | 合同 | 财务 |
| `contract:view` | 查看合同 | 合同 | 全员 |
| `contract:change` | 变更合同 | 合同 | 销售 |
| `contract:complete` | 交付确认 | 合同 | 销售 |
| `contract:terminate` | 终止合同 | 合同 | 管理员 |
| `product:view` | 查看产品目录 | 产品 | 全员 |
| `product:manage` | 管理产品目录 | 产品 | 管理员 |
| `inventory:view` | 查看库存 | 库存 | 生产 |
| `inventory:update` | 库存调整 | 库存 | 生产 |
| `production:create` | 创建工单 | 生产 | 生产 |
| `production:start` | 开始生产 | 生产 | 生产 |
| `production:qc` | 质检 | 生产 | 质检 |
| `production:view` | 查看工单 | 生产 | 生产/质检 |
| `delivery:ship` | 发货 | 交付 | 生产 |
| `delivery:install` | 售后装机 | 交付 | 生产 |
| `system:admin` | 系统管理 | 系统 | 管理员 |

### 4.2 合同管理模块

**核心模块**，管理合同全生命周期。

#### 合同状态机

```
                  ┌──────────┐
                  │  草稿     │ ← 销售创建
                  └────┬─────┘
                       │ 提交
                  ┌────▼─────┐
                  │  待评审    │ ← 财务待办
                  └────┬─────┘
                   ┌───┴───┐
                   │       │
              ┌────▼──┐ ┌─▼──────┐
              │ 退回修改│ │ 评审通过 │
              └────┬───┘ └───┬────┘
                   │         │
              ┌────▼─────┐  │（生产根据库存决策）
              │  草稿     │  │ 有货→直接发货
              └──────────┘  │ 缺货→生产
                            │
                     ┌──────▼──────┐
                     │   已投产/待发货 │
                     └──────┬──────┘
                            │ 生产完成+质检通过→发货
                     ┌──────▼──────┐
                     │   已发货     │
                     └──────┬──────┘
                            │ 售后装机测试完成
                     ┌──────▼──────┐
                     │   待交付     │
                     └──────┬──────┘
                            │ 销售确认交付
                     ┌──────▼──────┐
                     │   已完成     │
                     └─────────────┘
```

#### API

| HTTP | 路径 | 角色 | 说明 |
|------|------|------|------|
| POST | `/api/contracts` | 销售 | 创建合同 |
| GET | `/api/contracts` | 全员 | 列表（按角色过滤数据） |
| GET | `/api/contracts/:id` | 全员 | 详情 |
| PUT | `/api/contracts/:id` | 销售 | 编辑草稿合同 |
| DELETE | `/api/contracts/:id` | 销售 | 删除草稿合同 |
| POST | `/api/contracts/:id/submit` | 销售 | 提交审核 |
| POST | `/api/contracts/:id/audit` | 财务 | 审核(通过/退回) |
| POST | `/api/contracts/:id/change` | 销售 | 发起变更 |
| POST | `/api/contracts/:id/complete` | 销售 | 交付确认 |
| POST | `/api/contracts/:id/terminate` | 管理员 | 终止合同 |
| POST | `/api/contracts/:id/attachments` | 销售 | 上传附件 |
| DELETE | `/api/contracts/:id/attachments/:attId` | 销售 | 删除附件 |

#### 数据过滤规则

| 角色 | 合同列表可见范围 |
|------|----------------|
| 销售 | 自己创建的全部合同（包括已作废的） |
| 财务 | 所有待评审 + 已评审的合同 |
| 生产 | 所有待生产/生产中/待发货/已发货的合同 |
| 质检 | 所有生产中/已生产的合同 |
| 管理员 | 全部 |

### 4.3 库存管理模块

| HTTP | 路径 | 角色 | 说明 |
|------|------|------|------|
| GET | `/api/inventory` | 生产 | 库存列表 |
| GET | `/api/inventory/:productId` | 生产 | 单品库存 |
| GET | `/api/inventory/logs` | 生产 | 库存变动日志 |
| POST | `/api/inventory/:productId/adjust` | 生产 | 手动调整库存（终止合同入库等） |

**库存变化触发点**：
- 合同审批通过后，生产部门查看库存 → 有货则创建发货单，同时扣减库存
- 生产完成 + 质检通过 → 成品入库（增加库存）
- 发货 → 出库（减少库存）
- 合同终止 → 手动入库（增加库存）

### 4.4 生产管理模块

| HTTP | 路径 | 角色 | 说明 |
|------|------|------|------|
| GET | `/api/production` | 生产/质检 | 工单列表 |
| GET | `/api/production/:id` | 生产/质检 | 工单详情 |
| POST | `/api/production` | 生产 | 创建工单（关联合同） |
| PUT | `/api/production/:id/start` | 生产 | 开始生产 |
| PUT | `/api/production/:id/complete` | 生产 | 生产完成 |
| PUT | `/api/production/:id/qc` | 质检 | 质检通过/退回 |
| GET | `/api/production/:id/logs` | 生产/质检 | 操作日志 |

**质检流程**：
```
生产完成
  │
  ▼
质检员查看待检工单 → 点击质检
  │
  ├── 通过 → 自动触发交付模块就绪
  │          库存增加成品数量
  │
  └── 退回 → 工单状态回到"生产中"
              记录退回原因
              生产部门返工后重新完成
```

### 4.5 交付模块

| HTTP | 路径 | 角色 | 说明 |
|------|------|------|------|
| GET | `/api/delivery` | 生产 | 发货单列表 |
| POST | `/api/delivery` | 生产 | 创建发货单 |
| GET | `/api/delivery/:id` | 生产 | 发货单详情 |
| POST | `/api/delivery/:id/after-sale` | 生产 | 录入售后装机记录 |

---

## 5. 前端设计

### 5.1 路由结构

```
/login                     → LoginPage.vue
/                          → Layout.vue（动态菜单）

# 销售
/contracts                 → ContractList.vue
/contracts/create          → ContractForm.vue
/contracts/:id             → ContractDetail.vue
/contracts/:id/edit        → ContractForm.vue

# 财务
/contracts                 → ContractList.vue（含审核功能）

# 生产
/production                → ProductionList.vue
/production/:id            → ProductionDetail.vue
/inventory                 → InventoryList.vue
/delivery                  → DeliveryList.vue
/delivery/:id              → DeliveryDetail.vue

# 质检
/production                → ProductionList.vue（质检视角）
/production/:id            → ProductionDetail.vue（质检操作区）

# 管理员
/users                     → UserList.vue
/roles                     → RoleList.vue
/products                  → ProductList.vue
```

### 5.2 权限控制

| 层级 | 实现方式 |
|------|---------|
| 路由守卫 | `router.beforeEach` 检查权限，无权限→403 页面 |
| 菜单 | 根据角色权限动态生成侧边栏 |
| 按钮 | 自定义指令 `v-permission="'contract:audit'"` 控制显隐 |
| API 守卫 | 后端 NestJS `AuthGuard` + `RolesGuard` + 权限检查 |

### 5.3 状态管理（Pinia Stores）

```
stores/
├── user.ts      — 用户信息、角色、权限列表、登录/登出
├── contract.ts  — 合同列表、详情、CRUD 操作
├── production.ts— 工单列表、详情、操作
└── app.ts       — 全局状态（侧边栏、主题等）
```

---

## 6. 异常流程处理

| 场景 | 处理方式 |
|------|---------|
| 合同退回修改 | 状态→草稿，销售编辑后重新提交，保留退回原因 |
| 合同变更 | 原合同→已作废，自动复制生成新合同（状态=草稿） |
| 质检不通过 | 工单→生产中，记录原因，返工后重新完成交检 |
| 合同终止 | 管理员操作→已作废，已生产未发货设备手动入库 |
| 删除限制 | 仅草稿可删；不可删自己；不可删最后的管理员 |
| JWT 过期 | Token 8小时，401 自动跳转登录 |
| 并发控制 | 审核接口乐观锁（版本号）防重复操作 |
| 日志审计 | 关键操作全部记录到 operation_logs 表 |

---

## 7. 测试策略

| 层级 | 工具 | 范围 |
|------|------|------|
| 单元测试 | Jest | Service 层业务逻辑、DTO 校验 |
| 集成测试 | @nestjs/testing + supertest | API 接口正确性 |
| E2E 测试 | 人工 + 脚本 | 完整业务流程（合同→生产→质检→发货→交付） |
| 前端测试 | Vitest | 复杂组件逻辑 |
| 目标覆盖率 | — | 核心 Service 80%+ |

**核心验收流程**（每条均需通过）：
1. 销售登录 → 创建合同 → 提交审核
2. 财务登录 → 审核通过
3. 生产登录 → 查看库存 → 创建工单 → 开始生产
4. 生产完成 → 质检通过
5. 创建发货单 → 录入物流 → 发货
6. 录入售后装机测试 → 销售确认交付
7. 合同变更 → 新合同走完流程
8. 权限验证（跨角色访问被拦截）

---

## 8. 目录结构规划

```
contract-management-system/
├── client/                    # 前端项目
│   ├── src/
│   │   ├── router/
│   │   ├── views/
│   │   ├── stores/
│   │   ├── components/
│   │   ├── permission/
│   │   └── utils/
│   ├── package.json
│   └── vite.config.ts
│
├── server/                    # 后端项目
│   ├── src/
│   │   ├── modules/
│   │   │   ├── auth/
│   │   │   ├── users/
│   │   │   ├── roles/
│   │   │   ├── contracts/
│   │   │   ├── products/
│   │   │   ├── inventory/
│   │   │   ├── production/
│   │   │   ├── delivery/
│   │   │   └── common/
│   │   ├── app.module.ts
│   │   └── main.ts
│   ├── test/
│   ├── package.json
│   └── nest-cli.json
│
├── deploy/                    # 部署配置
│   ├── docker-compose.yml
│   ├── Dockerfile
│   └── nginx.conf
│
├── docs/                      # 文档
│   └── superpowers/
│       └── specs/
│           └── 2026-07-04-contract-management-system-design.md
│
└── README.md
```
