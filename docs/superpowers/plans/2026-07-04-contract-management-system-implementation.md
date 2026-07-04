# 合同流程管理系统 — 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现一个完整的公司内部合同流程管理系统，覆盖合同录入→财务评审→生产→质检→发货→售后的全业务流程。

**Architecture:** 模块化单体 + 事件驱动架构。NestJS 后端按业务模块拆分（合同/生产/库存/交付/权限），模块间通过 EventEmitter 解耦。Vue3 前端使用 Element Plus 构建企业级界面，Pinia 管理状态，JWT 认证。

**Tech Stack:** NestJS 10 + TypeORM + PostgreSQL 15, Vue 3 + Vite 5 + Element Plus + Pinia + Axios

## Global Constraints

- 所有 API 路径以 `/api` 开头
- 数据库使用 PostgreSQL 15+，通过 TypeORM 的 `synchronize: true` 自动建表（开发阶段）
- JWT Token 有效期 8 小时
- 密码使用 bcrypt 加密，salt rounds = 10
- 前端按钮权限使用自定义指令 `v-permission` 控制
- 前端路由使用 `router.beforeEach` 守卫检查权限
- 模块间通信使用 `@nestjs/event-emitter`，禁止模块间直接 import Service
- 所有关键操作写入 `operation_logs` 审计表
- 合同编号格式：`HT` + `YYYYMMDD` + `4位序号`

---

## Task 1: 项目脚手架 & 开发环境

**Files:**
- Create: `server/package.json`
- Create: `server/src/main.ts`
- Create: `server/src/app.module.ts`
- Create: `client/package.json`
- Create: `client/vite.config.ts`
- Create: `docker-compose.yml`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: (none — initial scaffolding)
- Produces: NestJS 项目骨架（可 `npm run start:dev` 启动）, Vue3 项目骨架（可 `npm run dev` 启动）, Docker Compose 开发数据库

### 后端脚手架

- [ ] **Step 1: 创建 NestJS 后端项目**

```bash
cd D:\contract-management-system
npx @nestjs/cli@latest new server --package-manager npm --skip-git --strict
```

选择 npm 包管理器。创建完成后安装依赖：

```bash
cd server
npm install @nestjs/typeorm typeorm pg @nestjs/jwt @nestjs/passport passport passport-jwt @nestjs/event-emitter bcrypt
npm install -D @types/passport-jwt @types/bcrypt @nestjs/testing supertest
```

- [ ] **Step 2: 配置后端的 main.ts 和 app.module.ts**

`server/src/main.ts`:
```typescript
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.enableCors();
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  await app.listen(3000);
  console.log('Server running on http://localhost:3000');
}
bootstrap();
```

`server/src/app.module.ts`:
```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT) || 5432,
      username: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      database: process.env.DB_NAME || 'contract_db',
      autoLoadEntities: true,
      synchronize: true, // dev only
    }),
    EventEmitterModule.forRoot(),
  ],
})
export class AppModule {}
```

- [ ] **Step 3: 创建 Docker Compose 文件**

`docker-compose.yml`:
```yaml
version: '3.8'
services:
  postgres:
    image: postgres:15
    container_name: contract-db
    environment:
      POSTGRES_DB: contract_db
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - '5432:5432'
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
```

- [ ] **Step 4: 创建前端 Vue3 + Vite 项目**

```bash
cd D:\contract-management-system
npm create vite@latest client -- --template vue-ts
cd client
npm install element-plus @element-plus/icons-vue pinia vue-router@4 axios
npm install -D @types/node sass
```

`client/vite.config.ts`:
```typescript
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'path';

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
    },
  },
});
```

- [ ] **Step 5: 更新 .gitignore 并提交**

`.gitignore`:
```
node_modules/
dist/
.env
*.log
uploads/
```

```bash
git add -A
git commit -m "feat: scaffold NestJS backend and Vue3 frontend"
```

---

## Task 2: 数据库实体定义 (TypeORM Entities)

**Files:**
- Create: `server/src/modules/auth/entities/user.entity.ts`
- Create: `server/src/modules/roles/entities/role.entity.ts`
- Create: `server/src/modules/roles/entities/permission.entity.ts`
- Create: `server/src/modules/roles/entities/role-permission.entity.ts`
- Create: `server/src/modules/roles/entities/user-role.entity.ts`
- Create: `server/src/modules/products/entities/product.entity.ts`
- Create: `server/src/modules/contracts/entities/contract.entity.ts`
- Create: `server/src/modules/contracts/entities/contract-item.entity.ts`
- Create: `server/src/modules/contracts/entities/contract-attachment.entity.ts`
- Create: `server/src/modules/contracts/entities/contract-version.entity.ts`
- Create: `server/src/modules/contracts/entities/contract-operation.entity.ts`
- Create: `server/src/modules/inventory/entities/inventory.entity.ts`
- Create: `server/src/modules/inventory/entities/inventory-log.entity.ts`
- Create: `server/src/modules/production/entities/production-order.entity.ts`
- Create: `server/src/modules/production/entities/production-item.entity.ts`
- Create: `server/src/modules/production/entities/production-log.entity.ts`
- Create: `server/src/modules/delivery/entities/delivery-order.entity.ts`
- Create: `server/src/modules/delivery/entities/delivery-item.entity.ts`
- Create: `server/src/modules/delivery/entities/after-sale-record.entity.ts`
- Create: `server/src/modules/common/entities/operation-log.entity.ts`

**Interfaces:**
- Consumes: (requires Task 1 scaffolding)
- Produces: 完整的 TypeORM 实体类，对应设计文档中全部 18 张表

### 实体编写（每个实体对应设计文档中的 SQL 表）

- [ ] **Step 1: 权限相关实体**

`server/src/modules/roles/entities/role.entity.ts`:
```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('roles')
export class Role {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 50, unique: true })
  name: string; // 管理员/销售/财务/生产/质检

  @Column({ length: 255, nullable: true })
  description: string;
}
```

`server/src/modules/roles/entities/permission.entity.ts`:
```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('permissions')
export class Permission {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 100, unique: true })
  code: string; // e.g. 'contract:audit'

  @Column({ length: 100 })
  name: string;

  @Column({ length: 50 })
  module: string; // e.g. 'contract'

  @CreateDateColumn()
  createdAt: Date;
}
```

`server/src/modules/roles/entities/role-permission.entity.ts`:
```typescript
import { Entity, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Role } from './role.entity';
import { Permission } from './permission.entity';

@Entity('role_permissions')
export class RolePermission {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Role)
  @JoinColumn({ name: 'role_id' })
  role: Role;

  @Column()
  role_id: number;

  @ManyToOne(() => Permission)
  @JoinColumn({ name: 'permission_id' })
  permission: Permission;

  @Column()
  permission_id: number;
}
```

`server/src/modules/roles/entities/user-role.entity.ts`:
```typescript
import { Entity, PrimaryGeneratedColumn, ManyToOne, JoinColumn, Column } from 'typeorm';
import { User } from 'src/modules/auth/entities/user.entity';
import { Role } from './role.entity';

@Entity('user_roles')
export class UserRole {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column()
  user_id: number;

  @ManyToOne(() => Role)
  @JoinColumn({ name: 'role_id' })
  role: Role;

  @Column()
  role_id: number;
}
```

`server/src/modules/auth/entities/user.entity.ts`:
```typescript
import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn,
  OneToMany
} from 'typeorm';
import { UserRole } from 'src/modules/roles/entities/user-role.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 50, unique: true })
  username: string;

  @Column()
  password_hash: string;

  @Column({ length: 50 })
  real_name: string;

  @Column({ length: 20, nullable: true })
  phone: string;

  @Column({ default: 1 })
  status: number; // 1=启用 0=禁用

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => UserRole, ur => ur.user)
  userRoles: UserRole[];
}
```

- [ ] **Step 2: 产品实体**

`server/src/modules/products/entities/product.entity.ts`:
```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('products')
export class Product {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 100 })
  model: string;

  @Column({ length: 200 })
  name: string;

  @Column({ type: 'jsonb', nullable: true })
  specs: Record<string, any>;

  @Column({ length: 20, default: '台' })
  unit: string;

  @Column({ default: 1 })
  status: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
```

- [ ] **Step 3: 合同相关实体**

`server/src/modules/contracts/entities/contract.entity.ts`:
```typescript
import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn,
  ManyToOne, JoinColumn, OneToMany
} from 'typeorm';
import { User } from 'src/modules/auth/entities/user.entity';
import { ContractItem } from './contract-item.entity';
import { ContractAttachment } from './contract-attachment.entity';
import { ContractOperation } from './contract-operation.entity';

@Entity('contracts')
export class Contract {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 50, unique: true })
  contract_no: string;

  @Column({ length: 200 })
  customer_name: string;

  @Column({ length: 20, nullable: true })
  customer_phone: string;

  @Column({ length: 500, nullable: true })
  customer_address: string;

  @Column({ length: 20, default: 'draft' })
  status: string; // draft/pending/approved/returned/production/shipped/installing/delivered/cancelled

  @ManyToOne(() => User)
  @JoinColumn({ name: 'submitter_id' })
  submitter: User;

  @Column({ nullable: true })
  submitter_id: number;

  @Column({ nullable: true })
  submit_at: Date;

  @Column({ nullable: true })
  reviewer_id: number;

  @Column({ nullable: true })
  review_at: Date;

  @Column({ length: 500, nullable: true })
  review_remark: string;

  @Column({ nullable: true })
  delivery_at: Date;

  @Column({ nullable: true })
  after_sale_at: Date;

  @Column({ nullable: true })
  delivered_by: number;

  @Column({ default: true })
  is_latest: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => ContractItem, ci => ci.contract, { cascade: true })
  items: ContractItem[];

  @OneToMany(() => ContractAttachment, ca => ca.contract, { cascade: true })
  attachments: ContractAttachment[];

  @OneToMany(() => ContractOperation, co => co.contract, { cascade: true })
  operations: ContractOperation[];
}
```

`server/src/modules/contracts/entities/contract-item.entity.ts`:
```typescript
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Contract } from './contract.entity';
import { Product } from 'src/modules/products/entities/product.entity';

@Entity('contract_items')
export class ContractItem {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Contract, c => c.items)
  @JoinColumn({ name: 'contract_id' })
  contract: Contract;

  @Column()
  contract_id: number;

  @ManyToOne(() => Product)
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @Column()
  product_id: number;

  @Column()
  quantity: number;

  @Column({ length: 255, nullable: true })
  remark: string;
}
```

`server/src/modules/contracts/entities/contract-attachment.entity.ts`:
```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Contract } from './contract.entity';
import { User } from 'src/modules/auth/entities/user.entity';

@Entity('contract_attachments')
export class ContractAttachment {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Contract, c => c.attachments)
  @JoinColumn({ name: 'contract_id' })
  contract: Contract;

  @Column()
  contract_id: number;

  @Column()
  file_name: string;

  @Column()
  file_path: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'uploader_id' })
  uploader: User;

  @Column()
  uploader_id: number;

  @CreateDateColumn()
  createdAt: Date;
}
```

`server/src/modules/contracts/entities/contract-version.entity.ts`:
```typescript
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { Contract } from './contract.entity';
import { User } from 'src/modules/auth/entities/user.entity';

@Entity('contract_versions')
export class ContractVersion {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  original_id: number;

  @Column()
  new_id: number;

  @Column({ length: 500, nullable: true })
  change_reason: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'changed_by' })
  changedBy: User;

  @Column()
  changed_by: number;

  @CreateDateColumn()
  createdAt: Date;
}
```

`server/src/modules/contracts/entities/contract-operation.entity.ts`:
```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Contract } from './contract.entity';
import { User } from 'src/modules/auth/entities/user.entity';

@Entity('contract_operations')
export class ContractOperation {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Contract, c => c.operations)
  @JoinColumn({ name: 'contract_id' })
  contract: Contract;

  @Column()
  contract_id: number;

  @Column()
  operator_id: number;

  @Column({ length: 50 })
  action: string;

  @Column({ length: 500, nullable: true })
  remark: string;

  @CreateDateColumn()
  createdAt: Date;
}
```

- [ ] **Step 4: 库存相关实体**

`server/src/modules/inventory/entities/inventory.entity.ts`:
```typescript
import { Entity, PrimaryGeneratedColumn, Column, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Product } from 'src/modules/products/entities/product.entity';

@Entity('inventory')
export class Inventory {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Product)
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @Column()
  product_id: number;

  @Column({ default: 0 })
  quantity: number;

  @Column({ length: 100, nullable: true })
  location: string;

  @UpdateDateColumn()
  updatedAt: Date;
}
```

`server/src/modules/inventory/entities/inventory-log.entity.ts`:
```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Product } from 'src/modules/products/entities/product.entity';
import { User } from 'src/modules/auth/entities/user.entity';

@Entity('inventory_log')
export class InventoryLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  product_id: number;

  @Column({ length: 20 })
  change_type: string; // inbound/outbound/produce/terminate

  @Column()
  quantity_before: number;

  @Column()
  quantity_change: number;

  @Column()
  quantity_after: number;

  @Column({ length: 20, nullable: true })
  reference_type: string;

  @Column({ nullable: true })
  reference_id: number;

  @Column()
  operator_id: number;

  @CreateDateColumn()
  createdAt: Date;
}
```

- [ ] **Step 5: 生产相关实体**

`server/src/modules/production/entities/production-order.entity.ts`:
```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { ProductionItem } from './production-item.entity';

@Entity('production_orders')
export class ProductionOrder {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  contract_id: number;

  @Column({ length: 20, default: 'pending' })
  status: string; // pending/in_progress/completed

  @Column({ nullable: true })
  started_at: Date;

  @Column({ nullable: true })
  completed_at: Date;

  @Column({ nullable: true })
  operator_id: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => ProductionItem, pi => pi.order, { cascade: true })
  items: ProductionItem[];
}
```

`server/src/modules/production/entities/production-item.entity.ts`:
```typescript
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { ProductionOrder } from './production-order.entity';

@Entity('production_items')
export class ProductionItem {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => ProductionOrder, o => o.items)
  @JoinColumn({ name: 'order_id' })
  order: ProductionOrder;

  @Column()
  order_id: number;

  @Column()
  product_id: number;

  @Column()
  quantity: number;

  @Column({ length: 20, default: 'pending' })
  qc_status: string; // pending/pass/reject

  @Column({ nullable: true })
  qc_operator_id: number;

  @Column({ nullable: true })
  qc_at: Date;

  @Column({ length: 500, nullable: true })
  qc_remark: string;
}
```

`server/src/modules/production/entities/production-log.entity.ts`:
```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('production_log')
export class ProductionLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  order_id: number;

  @Column({ length: 50 })
  action: string;

  @Column()
  operator_id: number;

  @Column({ length: 500, nullable: true })
  remark: string;

  @CreateDateColumn()
  createdAt: Date;
}
```

- [ ] **Step 6: 交付相关实体**

`server/src/modules/delivery/entities/delivery-order.entity.ts`:
```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToMany } from 'typeorm';
import { DeliveryItem } from './delivery-item.entity';

@Entity('delivery_orders')
export class DeliveryOrder {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  contract_id: number;

  @Column({ length: 20, default: 'pending' })
  status: string; // pending/shipped/installed/delivered

  @Column({ length: 100, nullable: true })
  logistics_company: string;

  @Column({ length: 100, nullable: true })
  tracking_no: string;

  @Column({ nullable: true })
  shipped_at: Date;

  @Column({ nullable: true })
  shipped_by: number;

  @CreateDateColumn()
  createdAt: Date;

  @OneToMany(() => DeliveryItem, di => di.delivery, { cascade: true })
  items: DeliveryItem[];
}
```

`server/src/modules/delivery/entities/delivery-item.entity.ts`:
```typescript
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { DeliveryOrder } from './delivery-order.entity';

@Entity('delivery_items')
export class DeliveryItem {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => DeliveryOrder, o => o.items)
  @JoinColumn({ name: 'delivery_id' })
  delivery: DeliveryOrder;

  @Column()
  delivery_id: number;

  @Column()
  product_id: number;

  @Column()
  quantity: number;
}
```

`server/src/modules/delivery/entities/after-sale-record.entity.ts`:
```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('after_sale_records')
export class AfterSaleRecord {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  contract_id: number;

  @Column()
  test_date: Date;

  @Column({ length: 255 })
  test_result: string;

  @Column()
  tester_id: number;

  @Column({ length: 500, nullable: true })
  remark: string;

  @CreateDateColumn()
  createdAt: Date;
}
```

- [ ] **Step 7: 审计日志实体**

`server/src/modules/common/entities/operation-log.entity.ts`:
```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('operation_logs')
export class OperationLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  user_id: number;

  @Column({ length: 50, nullable: true })
  username: string;

  @Column({ length: 50, nullable: true })
  role_name: string;

  @Column({ length: 100 })
  action: string;

  @Column({ length: 50 })
  module: string;

  @Column({ length: 50, nullable: true })
  target_type: string;

  @Column({ nullable: true })
  target_id: number;

  @Column({ type: 'text', nullable: true })
  detail: string;

  @Column({ length: 50, nullable: true })
  ip: string;

  @CreateDateColumn()
  createdAt: Date;
}
```

- [ ] **Step 8: 将实体注册到模块并验证**

在每个模块中创建对应的 `.module.ts` 文件并导入 TypeOrmModule.forFeature([...entities])。然后在 app.module.ts 中 imports 所有业务模块。

```bash
# 启动 PostgreSQL，运行 docker
cd D:\contract-management-system
docker compose up -d

# 启动后端，确认 TypeORM 自动创建了表
cd D:\contract-management-system\server
npm run start:dev
```

确认控制台无错误，PostgreSQL 中表已创建。

```bash
git add -A
git commit -m "feat: add all TypeORM entities (18 tables)"
```

---

## Task 3: 后端认证模块 (JWT Login)

**Files:**
- Create: `server/src/modules/auth/auth.module.ts`
- Create: `server/src/modules/auth/auth.controller.ts`
- Create: `server/src/modules/auth/auth.service.ts`
- Create: `server/src/modules/auth/dto/login.dto.ts`
- Create: `server/src/modules/auth/strategies/jwt.strategy.ts`
- Create: `server/src/modules/auth/guards/jwt-auth.guard.ts`
- Create: `server/src/modules/auth/decorators/current-user.decorator.ts`

**Interfaces:**
- Consumes: User entity (Task 2)
- Produces: `POST /api/auth/login` → `{ access_token: string }`, `@CurrentUser()` decorator, `JwtAuthGuard`

- [ ] **Step 1: 创建 AuthModule 和配置 JWT**

`server/src/modules/auth/auth.module.ts`:
```typescript
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { User } from './entities/user.entity';
import { UserRole } from '../roles/entities/user-role.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, UserRole]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'contract-system-secret-key',
      signOptions: { expiresIn: '8h' },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
```

- [ ] **Step 2: DTO**

`server/src/modules/auth/dto/login.dto.ts`:
```typescript
import { IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsString()
  @MinLength(2)
  username: string;

  @IsString()
  @MinLength(4)
  password: string;
}
```

- [ ] **Step 3: AuthService**

`server/src/modules/auth/auth.service.ts`:
```typescript
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './entities/user.entity';
import { UserRole } from '../roles/entities/user-role.entity';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(UserRole)
    private userRoleRepo: Repository<UserRole>,
    private jwtService: JwtService,
  ) {}

  async login(username: string, password: string) {
    const user = await this.userRepo.findOne({ where: { username } });
    if (!user) throw new UnauthorizedException('用户名或密码错误');
    if (user.status === 0) throw new UnauthorizedException('用户已被禁用');

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) throw new UnauthorizedException('用户名或密码错误');

    const userRoles = await this.userRoleRepo.find({
      where: { user_id: user.id },
      relations: ['role'],
    });
    const roles = userRoles.map(ur => ur.role.name);
    // 收集所有权限 code
    const permissions = await this.getUserPermissions(user.id);

    const payload = {
      sub: user.id,
      username: user.username,
      real_name: user.real_name,
      roles,
      permissions,
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: payload,
    };
  }

  private async getUserPermissions(userId: number): Promise<string[]> {
    const result = await this.userRoleRepo.find({
      where: { user_id: userId },
      relations: ['role', 'role.rolePermissions', 'role.rolePermissions.permission'],
    });
    const permSet = new Set<string>();
    for (const ur of result) {
      const rps = await this.userRoleRepo.manager
        .createQueryBuilder()
        .select('p.code')
        .from('role_permissions', 'rp')
        .innerJoin('permissions', 'p', 'p.id = rp.permission_id')
        .where('rp.role_id = :rid', { rid: ur.role_id })
        .getRawMany();
      rps.forEach(r => permSet.add(r.p_code));
    }
    return Array.from(permSet);
  }
}
```

- [ ] **Step 4: JWT Strategy**

`server/src/modules/auth/strategies/jwt.strategy.ts`:
```typescript
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: process.env.JWT_SECRET || 'contract-system-secret-key',
    });
  }

  async validate(payload: any) {
    return {
      id: payload.sub,
      username: payload.username,
      real_name: payload.real_name,
      roles: payload.roles,
      permissions: payload.permissions,
    };
  }
}
```

- [ ] **Step 5: Guards 和 Decorator**

`server/src/modules/auth/guards/jwt-auth.guard.ts`:
```typescript
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
```

`server/src/modules/auth/decorators/current-user.decorator.ts`:
```typescript
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;
    return data ? user?.[data] : user;
  },
);
```

- [ ] **Step 6: AuthController**

`server/src/modules/auth/auth.controller.ts`:
```typescript
import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.username, dto.password);
  }
}
```

- [ ] **Step 7: 验证登录接口**

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```
预期返回 401（因为还没有用户数据——先确认接口可达即可）。

```bash
git add -A
git commit -m "feat: add JWT authentication module (login, guards, decorators)"
```

---

## Task 4: 后端数据初始化 + 权限系统

**Files:**
- Create: `server/src/modules/common/common.module.ts`
- Create: `server/src/modules/common/seed.service.ts`
- Create: `server/src/modules/common/entity-exists.validator.ts`
- Create: `server/src/modules/auth/guards/permission.guard.ts`
- Create: `server/src/modules/auth/decorators/permissions.decorator.ts`

**Interfaces:**
- Consumes: User entity, Role entity, Permission entity (Task 2)
- Produces: 种子数据（5个角色 + 20+权限 + 1个管理员账号），`@Permissions()` 装饰器 + `PermissionGuard`

- [ ] **Step 1: 创建 PermissionGuard**

`server/src/modules/auth/decorators/permissions.decorator.ts`:
```typescript
import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';
export const Permissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
```

`server/src/modules/auth/guards/permission.guard.ts`:
```typescript
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredPermissions || requiredPermissions.length === 0) return true;

    const { user } = context.switchToHttp().getRequest();
    return requiredPermissions.some(p => user.permissions?.includes(p));
  }
}
```

- [ ] **Step 2: 创建 SeedService**

`server/src/modules/common/seed.service.ts`:
```typescript
import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Role } from '../roles/entities/role.entity';
import { Permission } from '../roles/entities/permission.entity';
import { RolePermission } from '../roles/entities/role-permission.entity';
import { User } from '../auth/entities/user.entity';
import { UserRole } from '../roles/entities/user-role.entity';

@Injectable()
export class SeedService implements OnModuleInit {
  private readonly PERMISSIONS = [
    // 合同权限
    { code: 'contract:create', name: '创建合同', module: 'contract' },
    { code: 'contract:edit', name: '编辑合同', module: 'contract' },
    { code: 'contract:submit', name: '提交合同', module: 'contract' },
    { code: 'contract:delete', name: '删除合同', module: 'contract' },
    { code: 'contract:view', name: '查看合同', module: 'contract' },
    { code: 'contract:audit', name: '审核合同', module: 'contract' },
    { code: 'contract:change', name: '变更合同', module: 'contract' },
    { code: 'contract:complete', name: '交付确认', module: 'contract' },
    { code: 'contract:terminate', name: '终止合同', module: 'contract' },
    // 产品权限
    { code: 'product:view', name: '查看产品', module: 'product' },
    { code: 'product:manage', name: '管理产品', module: 'product' },
    // 库存权限
    { code: 'inventory:view', name: '查看库存', module: 'inventory' },
    { code: 'inventory:update', name: '库存调整', module: 'inventory' },
    // 生产权限
    { code: 'production:create', name: '创建工单', module: 'production' },
    { code: 'production:start', name: '开始生产', module: 'production' },
    { code: 'production:view', name: '查看工单', module: 'production' },
    { code: 'production:qc', name: '质检操作', module: 'production' },
    // 交付权限
    { code: 'delivery:ship', name: '发货', module: 'delivery' },
    { code: 'delivery:install', name: '售后装机', module: 'delivery' },
    // 系统权限
    { code: 'system:admin', name: '系统管理', module: 'system' },
  ];

  private readonly ROLES = [
    { name: '管理员', description: '系统管理员' },
    { name: '销售', description: '录入合同、提交审核、交付确认' },
    { name: '财务', description: '合同评审' },
    { name: '生产', description: '库存管理、生产工单、发货、售后' },
    { name: '质检', description: '生产质检' },
  ];

  private readonly ROLE_PERMISSIONS: Record<string, string[]> = {
    管理员: ['system:admin', ...this.PERMISSIONS.map(p => p.code)],
    销售: ['contract:create', 'contract:edit', 'contract:submit', 'contract:delete',
          'contract:view', 'contract:change', 'contract:complete', 'product:view'],
    财务: ['contract:view', 'contract:audit'],
    生产: ['contract:view', 'product:view', 'inventory:view', 'inventory:update',
          'production:create', 'production:start', 'production:view',
          'delivery:ship', 'delivery:install'],
    质检: ['production:view', 'production:qc'],
  };

  constructor(
    @InjectRepository(Role) private roleRepo: Repository<Role>,
    @InjectRepository(Permission) private permRepo: Repository<Permission>,
    @InjectRepository(RolePermission) private rpRepo: Repository<RolePermission>,
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(UserRole) private urRepo: Repository<UserRole>,
  ) {}

  async onModuleInit() {
    const roleCount = await this.roleRepo.count();
    if (roleCount > 0) return; // 已初始化则跳过

    // 1. 创建权限
    const permEntities = await this.permRepo.save(
      this.PERMISSIONS.map(p => this.permRepo.create(p)),
    );
    const permMap = new Map(permEntities.map(p => [p.code, p.id]));

    // 2. 创建角色
    const roleEntities = await this.roleRepo.save(
      this.ROLES.map(r => this.roleRepo.create(r)),
    );
    const roleMap = new Map(roleEntities.map(r => [r.name, r.id]));

    // 3. 分配角色权限
    const rps: Partial<RolePermission>[] = [];
    for (const [roleName, codes] of Object.entries(this.ROLE_PERMISSIONS)) {
      const roleId = roleMap.get(roleName);
      if (!roleId) continue;
      for (const code of codes) {
        const permId = permMap.get(code);
        if (permId) {
          rps.push({ role_id: roleId, permission_id: permId });
        }
      }
    }
    await this.rpRepo.save(rps);

    // 4. 创建默认管理员
    const admin = await this.userRepo.save({
      username: 'admin',
      password_hash: await bcrypt.hash('admin123', 10),
      real_name: '系统管理员',
    });
    const adminRoleId = roleMap.get('管理员')!;
    await this.urRepo.save({ user_id: admin.id, role_id: adminRoleId });

    console.log('Seed data created: 1 admin user, 5 roles, 20 permissions');
  }
}
```

- [ ] **Step 3: 注册 CommonModule 和全局 Guard**

`server/src/modules/common/common.module.ts`:
```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_GUARD } from '@nestjs/core';
import { SeedService } from './seed.service';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { Role } from '../roles/entities/role.entity';
import { Permission } from '../roles/entities/permission.entity';
import { RolePermission } from '../roles/entities/role-permission.entity';
import { User } from '../auth/entities/user.entity';
import { UserRole } from '../roles/entities/user-role.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Role, Permission, RolePermission, User, UserRole])],
  providers: [
    SeedService,
    { provide: APP_GUARD, useClass: PermissionGuard },
  ],
})
export class CommonModule {}
```

更新 `server/src/app.module.ts`，添加 `AuthModule` 和 `CommonModule` 到 imports。

- [ ] **Step 4: 验证种子数据**

重启后端，确认控制台输出 "Seed data created: 1 admin user, 5 roles, 20 permissions"。

```bash
# 测试管理员登录
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```
预期返回：`{ "access_token": "eyJ...", "user": {...} }`

```bash
git add -A
git commit -m "feat: add seed data (admin user, roles, permissions) and PermissionGuard"
```

---

## Task 5: 后端用户管理模块

**Files:**
- Create: `server/src/modules/roles/roles.module.ts`
- Create: `server/src/modules/roles/roles.controller.ts`
- Create: `server/src/modules/roles/roles.service.ts`
- Create: `server/src/modules/roles/dto/create-user.dto.ts`
- Create: `server/src/modules/roles/dto/update-user.dto.ts`
- Create: `server/src/modules/roles/dto/create-role.dto.ts`

**Interfaces:**
- Consumes: User entity, Role entity, Permission entity, `@Permissions()` decorator
- Produces: 用户 CRUD API, 角色管理 API

- [ ] **Step 1: 用户管理 Controller + Service**

`server/src/modules/roles/roles.service.ts` (关键方法)：
```typescript
// 用户 CRUD
async createUser(dto: CreateUserDto): Promise<User> {
  const hash = await bcrypt.hash(dto.password, 10);
  const user = this.userRepo.create({ ...dto, password_hash: hash });
  delete (user as any).password_hash;
  const saved = await this.userRepo.save(user);
  // 分配角色
  if (dto.role_ids?.length) {
    await this.urRepo.save(dto.role_ids.map(rid => ({ user_id: saved.id, role_id: rid })));
  }
  return saved;
}

async findUsers(): Promise<User[]> {
  return this.userRepo.find({
    select: ['id', 'username', 'real_name', 'phone', 'status', 'createdAt'],
    relations: ['userRoles', 'userRoles.role'],
  });
}

async updateUserStatus(id: number, status: number): Promise<void> {
  await this.userRepo.update(id, { status });
}
```

`server/src/modules/roles/roles.controller.ts`:
```typescript
@Controller()
@UseGuards(JwtAuthGuard)
export class RolesController {
  // === 用户管理 ===
  @Get('users')
  @Permissions('system:admin')
  findAllUsers() { return this.rolesService.findUsers(); }

  @Post('users')
  @Permissions('system:admin')
  createUser(@Body() dto: CreateUserDto) { ... }

  @Put('users/:id')
  @Permissions('system:admin')
  updateUser(@Param('id') id: number, @Body() dto: UpdateUserDto) { ... }

  @Delete('users/:id')
  @Permissions('system:admin')
  deleteUser(@Param('id') id: number) { ... }

  @Put('users/:id/status')
  @Permissions('system:admin')
  updateStatus(@Param('id') id: number, @Body('status') status: number) { ... }

  // === 角色管理 ===
  @Get('roles')
  @Permissions('system:admin')
  findAllRoles() { ... }

  @Post('roles')
  @Permissions('system:admin')
  createRole(@Body() dto: CreateRoleDto) { ... }

  @Get('permissions')
  @Permissions('system:admin')
  findAllPermissions() { ... }

  @Put('roles/:id/permissions')
  @Permissions('system:admin')
  assignPermissions(@Param('id') id: number, @Body('permission_ids') ids: number[]) { ... }
}
```

- [ ] **Step 2: 创建一个测试销售用户用于后续开发**

在 SeedService 的 `onModuleInit` 末尾追加：
```typescript
// 创建测试销售用户
const sales = await this.userRepo.save({
  username: 'sales1',
  password_hash: await bcrypt.hash('123456', 10),
  real_name: '销售员张',
});
const salesRoleId = roleMap.get('销售')!;
await this.urRepo.save({ user_id: sales.id, role_id: salesRoleId });
```

同样创建财务 (finance1)、生产 (prod1)、质检 (qc1) 测试账号，密码统一 `123456`。

- [ ] **Step 3: 验证**

```bash
# 管理员登录获取 token
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)

# 获取用户列表
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/users
# 预期: 返回用户列表，包含 admin, sales1, finance1, prod1, qc1

# 测试权限拦截
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/users
# 预期: 管理员的 token 能访问

# 用销售 token 测试权限不足
SALES_TOKEN=$(curl -s -X POST ... -d '{"username":"sales1","password":"123456"}' | ...)
curl -H "Authorization: Bearer $SALES_TOKEN" http://localhost:3000/api/users
# 预期: 403 Forbidden
```

```bash
git add -A
git commit -m "feat: add user and role management API, test accounts, permission guard verification"
```

---

## Task 6: 后端产品目录 + 库存模块

**Files:**
- Create: `server/src/modules/products/products.module.ts`
- Create: `server/src/modules/products/products.controller.ts`
- Create: `server/src/modules/products/products.service.ts`
- Create: `server/src/modules/products/dto/create-product.dto.ts`
- Create: `server/src/modules/inventory/inventory.module.ts`
- Create: `server/src/modules/inventory/inventory.controller.ts`
- Create: `server/src/modules/inventory/inventory.service.ts`

**Interfaces:**
- Consumes: Product entity, Inventory entity
- Produces: 产品 CRUD API, 库存查询/调整 API

- [ ] **Step 1: ProductsController**

```typescript
@Controller('products')
@UseGuards(JwtAuthGuard)
export class ProductsController {
  constructor(private productsService: ProductsService) {}

  @Get()
  @Permissions('product:view')
  findAll(@Query('status') status?: string) { ... }

  @Get(':id')
  @Permissions('product:view')
  findOne(@Param('id') id: number) { ... }

  @Post()
  @Permissions('product:manage')
  create(@Body() dto: CreateProductDto) { ... }

  @Put(':id')
  @Permissions('product:manage')
  update(@Param('id') id: number, @Body() dto: UpdateProductDto) { ... }
}
```

- [ ] **Step 2: InventoryController**

```typescript
@Controller('inventory')
@UseGuards(JwtAuthGuard)
export class InventoryController {
  constructor(private inventoryService: InventoryService) {}

  @Get()
  @Permissions('inventory:view')
  findAll() { ... }

  @Get(':productId')
  @Permissions('inventory:view')
  findOne(@Param('productId') productId: number) { ... }

  @Post(':productId/adjust')
  @Permissions('inventory:update')
  adjust(@Param('productId') productId: number, @Body() dto: AdjustDto) { ... }
}
```

- [ ] **Step 3: 验证**

```bash
# 管理员创建产品
ADMIN_TOKEN=...
curl -X POST http://localhost:3000/api/products \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"model":"DEV-1001","name":"智能网关设备","specs":{"cpu":"4核","ram":"8GB"},"unit":"台"}'
# 预期: 返回创建的产品

# 生产用户查看库存
PROD_TOKEN=...
curl -H "Authorization: Bearer $PROD_TOKEN" http://localhost:3000/api/inventory
# 预期: 库存列表（可能为空）
```

```bash
git add -A
git commit -m "feat: add products CRUD and inventory management API"
```

---

## Task 7: 后端合同模块（核心）

**Files:**
- Create: `server/src/modules/contracts/contracts.module.ts`
- Create: `server/src/modules/contracts/contracts.controller.ts`
- Create: `server/src/modules/contracts/contracts.service.ts`
- Create: `server/src/modules/contracts/dto/create-contract.dto.ts`
- Create: `server/src/modules/contracts/dto/audit-contract.dto.ts`
- Create: `server/src/modules/contracts/dto/change-contract.dto.ts`
- Create: `server/src/modules/contracts/contracts.gateway.ts` (可选，后续WebSocket实时通知)

**Interfaces:**
- Consumes: Contract, ContractItem, ContractAttachment, ContractVersion, ContractOperation entities
- Produces: 完整合同生命周期 API（创建/提交/审核/变更/终止/交付确认）+ 角色过滤列表

- [ ] **Step 1: DTO 定义**

`server/src/modules/contracts/dto/create-contract.dto.ts`:
```typescript
import { IsString, IsArray, ValidateNested, IsOptional, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

class ContractItemDto {
  @IsNumber() product_id: number;
  @IsNumber() @Min(1) quantity: number;
  @IsOptional() @IsString() remark?: string;
}

export class CreateContractDto {
  @IsString() customer_name: string;
  @IsOptional() @IsString() customer_phone?: string;
  @IsOptional() @IsString() customer_address?: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => ContractItemDto)
  items: ContractItemDto[];
}
```

`server/src/modules/contracts/dto/audit-contract.dto.ts`:
```typescript
import { IsString, IsIn } from 'class-validator';

export class AuditContractDto {
  @IsString()
  @IsIn(['pass', 'reject'])
  action: string;

  @IsOptional()
  @IsString()
  remark?: string;
}
```

`server/src/modules/contracts/dto/change-contract.dto.ts`:
```typescript
export class ChangeContractDto {
  @IsString()
  change_reason: string;

  @IsString() customer_name: string;
  // ... 其他合同字段同上
  @IsArray() @ValidateNested({ each: true }) @Type(() => ContractItemDto)
  items: ContractItemDto[];
}
```

- [ ] **Step 2: ContractsService — 核心逻辑**

```typescript
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

  // 变更合同（生成新合同，原合同作废）
  async change(id: number, userId: number, dto: ChangeContractDto): Promise<Contract> {
    const original = await this.contractRepo.findOne({
      where: { id },
      relations: ['items'],
    });
    if (!original) throw new NotFoundException('合同不存在');
    // 原合同作废
    original.status = 'cancelled';
    original.is_latest = false;
    await this.contractRepo.save(original);
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
    const saved = await this.contractRepo.save(newContract);
    // 记录版本关联
    await this.verRepo.save({
      original_id: id, new_id: saved.id,
      change_reason: dto.change_reason, changed_by: userId,
    });
    await this.logOperation(id, userId, 'change', dto.change_reason);
    return saved;
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

  // 角色过滤列表
  async findAll(user: any): Promise<Contract[]> {
    const qb = this.contractRepo.createQueryBuilder('c')
      .leftJoinAndSelect('c.items', 'items')
      .leftJoinAndSelect('c.submitter', 'submitter')
      .orderBy('c.createdAt', 'DESC');
    if (user.roles.includes('销售')) {
      qb.where('c.submitter_id = :uid', { uid: user.id });
    } else if (user.roles.includes('财务')) {
      qb.where("c.status IN ('pending','approved','returned')");
    } else if (user.roles.includes('生产')) {
      qb.where("c.status IN ('approved','production','shipped','installing')");
    } else if (user.roles.includes('质检')) {
      qb.where("c.status IN ('production','shipped')");
    }
    // 管理员看到全部
    return qb.getMany();
  }

  private async logOperation(contractId: number, userId: number, action: string, remark?: string) {
    await this.opRepo.save({ contract_id: contractId, operator_id: userId, action, remark });
  }
}
```

- [ ] **Step 3: ContractsController**

```typescript
@Controller('contracts')
@UseGuards(JwtAuthGuard)
export class ContractsController {
  constructor(private contractsService: ContractsService) {}

  @Post()
  @Permissions('contract:create')
  create(@Body() dto: CreateContractDto, @CurrentUser() user: any) {
    return this.contractsService.create(dto, user.id);
  }

  @Get()
  @Permissions('contract:view')
  findAll(@CurrentUser() user: any) {
    return this.contractsService.findAll(user);
  }

  @Get(':id')
  @Permissions('contract:view')
  findOne(@Param('id') id: number) { return this.contractsService.findOne(id); }

  @Put(':id')
  @Permissions('contract:edit')
  update(@Param('id') id: number, @Body() dto: CreateContractDto) { ... }

  @Delete(':id')
  @Permissions('contract:delete')
  remove(@Param('id') id: number) { ... }

  @Post(':id/submit')
  @Permissions('contract:submit')
  submit(@Param('id') id: number, @CurrentUser() user: any) {
    return this.contractsService.submit(id, user.id);
  }

  @Post(':id/audit')
  @Permissions('contract:audit')
  audit(@Param('id') id: number, @Body() dto: AuditContractDto, @CurrentUser() user: any) {
    return this.contractsService.audit(id, user.id, dto);
  }

  @Post(':id/change')
  @Permissions('contract:change')
  change(@Param('id') id: number, @Body() dto: ChangeContractDto, @CurrentUser() user: any) {
    return this.contractsService.change(id, user.id, dto);
  }

  @Post(':id/complete')
  @Permissions('contract:complete')
  complete(@Param('id') id: number, @CurrentUser() user: any) {
    return this.contractsService.complete(id, user.id);
  }

  @Post(':id/terminate')
  @Permissions('contract:terminate')
  terminate(@Param('id') id: number, @CurrentUser() user: any) {
    return this.contractsService.terminate(id, user.id);
  }
}
```

- [ ] **Step 4: 验证完整合同流程**

```bash
# 销售登录 → 创建合同 → 提交
SALES_TOKEN=...
CONTRACT_ID=$(curl -s -X POST http://localhost:3000/api/contracts \
  -H "Authorization: Bearer $SALES_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"customer_name":"测试客户","customer_phone":"13800138000","items":[{"product_id":1,"quantity":2}]}' | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2)

curl -X POST "http://localhost:3000/api/contracts/$CONTRACT_ID/submit" \
  -H "Authorization: Bearer $SALES_TOKEN"
# 预期: status → pending

# 财务登录 → 审核通过
FINANCE_TOKEN=...
curl -X POST "http://localhost:3000/api/contracts/$CONTRACT_ID/audit" \
  -H "Authorization: Bearer $FINANCE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action":"pass"}'
# 预期: status → approved，console 显示 "contract.approved" 事件触发
```

```bash
git add -A
git commit -m "feat: add contract management module - full CRUD, state machine, events"
```

---

## Task 8: 后端生产模块 & 交付模块

**Files:**
- Create: `server/src/modules/production/production.module.ts`
- Create: `server/src/modules/production/production.controller.ts`
- Create: `server/src/modules/production/production.service.ts`
- Create: `server/src/modules/production/dto/create-production.dto.ts`
- Create: `server/src/modules/delivery/delivery.module.ts`
- Create: `server/src/modules/delivery/delivery.controller.ts`
- Create: `server/src/modules/delivery/delivery.service.ts`
- Create: `server/src/modules/delivery/dto/create-delivery.dto.ts`
- Create: `server/src/modules/delivery/dto/after-sale.dto.ts`
- Modify: `server/src/modules/production/production.module.ts` (添加 EventEmitter 监听)

**Interfaces:**
- Consumes: ProductionOrder, DeliveryOrder entities, EventEmitter events
- Produces: 生产工单 + 质检 API, 发货 + 售后 API

- [ ] **Step 1: ProductionService**

```typescript
// 生产模块需要监听合同审核通过事件
@Injectable()
export class ProductionService {
  constructor(
    @InjectRepository(ProductionOrder) private orderRepo: Repository<ProductionOrder>,
    @InjectRepository(ProductionItem) private itemRepo: Repository<ProductionItem>,
    @InjectRepository(ProductionLog) private logRepo: Repository<ProductionLog>,
    @InjectRepository(Contract) private contractRepo: Repository<Contract>,
    @InjectRepository(Inventory) private invRepo: Repository<Inventory>,
    private eventEmitter: EventEmitter2,
  ) {}

  // 监听合同审核通过
  @OnEvent('contract.approved')
  async handleContractApproved(payload: { contractId: number }) {
    // 实际生产中，生产部门手动创建工单，这里先不做自动创建
    console.log(`合同 ${payload.contractId} 已审批通过，等待生产部门处理`);
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
      item.qc_remark = remark;
    }
    await this.itemRepo.save(order.items);
    await this.logOp(id, userId, 'qc_pass', remark);
    this.eventEmitter.emit('qc.passed', { orderId: id, contractId: order.contract_id });
    return order;
  }

  // 质检退回
  async qcReject(id: number, userId: number, remark: string): Promise<ProductionOrder> {
    const order = await this.orderRepo.findOneBy({ id });
    if (!order || order.status !== 'completed') throw new BadRequestException('工单状态不正确');
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
```

- [ ] **Step 2: DeliveryService**

```typescript
@Injectable()
export class DeliveryService {
  constructor(
    @InjectRepository(DeliveryOrder) private deliveryRepo: Repository<DeliveryOrder>,
    @InjectRepository(DeliveryItem) private itemRepo: Repository<DeliveryItem>,
    @InjectRepository(AfterSaleRecord) private afterSaleRepo: Repository<AfterSaleRecord>,
    @InjectRepository(Contract) private contractRepo: Repository<Contract>,
    @InjectRepository(Inventory) private invRepo: Repository<Inventory>,
    @InjectRepository(InventoryLog) private invLogRepo: Repository<InventoryLog>,
  ) {}

  // 创建发货单（从有库存的合同直接发货，或质检通过后发货）
  async create(contractId: number, dto: CreateDeliveryDto, userId: number): Promise<DeliveryOrder> {
    const contract = await this.contractRepo.findOneBy({ id: contractId });
    if (!contract) throw new NotFoundException('合同不存在');

    const delivery = this.deliveryRepo.create({
      contract_id: contractId,
      logistics_company: dto.logistics_company,
      tracking_no: dto.tracking_no,
      shipped_by: userId,
      shipped_at: new Date(),
      status: 'shipped',
    });
    delivery.items = dto.items.map(item => this.itemRepo.create(item));
    const saved = await this.deliveryRepo.save(delivery);

    // 扣减库存
    for (const item of dto.items) {
      const inv = await this.invRepo.findOne({ where: { product_id: item.product_id } });
      if (inv) {
        const before = inv.quantity;
        inv.quantity = Math.max(0, inv.quantity - item.quantity);
        await this.invRepo.save(inv);
        await this.invLogRepo.save({
          product_id: item.product_id,
          change_type: 'outbound',
          quantity_before: before,
          quantity_change: -item.quantity,
          quantity_after: inv.quantity,
          reference_type: 'contract',
          reference_id: contractId,
          operator_id: userId,
        });
      }
    }

    // 更新合同状态
    contract.status = 'shipped';
    contract.delivery_at = new Date();
    await this.contractRepo.save(contract);

    return saved;
  }

  // 记录售后装机
  async recordAfterSale(contractId: number, dto: AfterSaleDto, userId: number): Promise<AfterSaleRecord> {
    const contract = await this.contractRepo.findOneBy({ id: contractId });
    if (!contract || contract.status !== 'shipped') throw new BadRequestException('合同状态不正确');

    const record = await this.afterSaleRepo.save({
      contract_id: contractId,
      test_date: dto.test_date,
      test_result: dto.test_result,
      tester_id: userId,
      remark: dto.remark,
    });

    // 合同 → installing
    contract.status = 'installing';
    contract.after_sale_at = new Date();
    await this.contractRepo.save(contract);

    return record;
  }
}
```

- [ ] **Step 3: 监听 QC 通过事件 — 自动增加库存**

在 `ProductionModule` 中注册：
```typescript
@OnEvent('qc.passed')
async handleQCPassed(payload: { orderId: number; contractId: number }) {
  // 质检通过后，成品入库
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
```

- [ ] **Step 4: 验证完整生产→质检→发货流程**

```bash
# 生产创建工单
PROD_TOKEN=...
curl -X POST "http://localhost:3000/api/production" \
  -H "Authorization: Bearer $PROD_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"contract_id":1}'

# 开始生产
curl -X PUT "http://localhost:3000/api/production/1/start" -H "Authorization: Bearer $PROD_TOKEN"

# 生产完成
curl -X PUT "http://localhost:3000/api/production/1/complete" -H "Authorization: Bearer $PROD_TOKEN"

# 质检通过
QC_TOKEN=...
curl -X PUT "http://localhost:3000/api/production/1/qc" \
  -H "Authorization: Bearer $QC_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action":"pass","remark":"测试通过"}'

# 创建发货单
curl -X POST "http://localhost:3000/api/delivery" \
  -H "Authorization: Bearer $PROD_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"contract_id":1,"logistics_company":"顺丰","tracking_no":"SF123456","items":[{"product_id":10,"quantity":2}]}'

# 售后装机
curl -X POST "http://localhost:3000/api/delivery/1/after-sale" \
  -H "Authorization: Bearer $PROD_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"test_date":"2026-07-10","test_result":"全部测试通过"}'
```

```bash
git add -A
git commit -m "feat: add production module (orders, QC) and delivery module (shipping, after-sales)"
```

---

## Task 9: 前端基础架构（登录、布局、路由、权限）

**Files:**
- Create: `client/src/main.ts`
- Create: `client/src/App.vue`
- Create: `client/src/router/index.ts`
- Create: `client/src/router/permission.ts`
- Create: `client/src/stores/user.ts`
- Create: `client/src/stores/app.ts`
- Create: `client/src/utils/request.ts`
- Create: `client/src/utils/permission.ts`
- Create: `client/src/views/login/LoginPage.vue`
- Create: `client/src/views/layout/Layout.vue`
- Create: `client/src/views/layout/Sidebar.vue`
- Create: `client/src/views/layout/Navbar.vue`
- Create: `client/src/views/error/403.vue`
- Create: `client/src/views/error/404.vue`
- Create: `client/src/permission/index.ts` (自定义 v-permission 指令)
- Create: `client/src/types/index.ts`

**Interfaces:**
- Consumes: 后端 API `POST /api/auth/login`
- Produces: 登录页面、主布局、路由守卫、Axios 拦截器、权限指令

- [ ] **Step 1: 类型定义**

`client/src/types/index.ts`:
```typescript
export interface UserInfo {
  id: number;
  username: string;
  real_name: string;
  roles: string[];
  permissions: string[];
}

export interface LoginResult {
  access_token: string;
  user: UserInfo;
}

export interface Contract {
  id: number;
  contract_no: string;
  customer_name: string;
  status: string;
  submitter: { real_name: string };
  items: ContractItem[];
  created_at: string;
}

export interface ContractItem {
  id: number;
  product_id: number;
  quantity: number;
  remark?: string;
}
```

- [ ] **Step 2: Axios 请求封装**

`client/src/utils/request.ts`:
```typescript
import axios from 'axios';
import { ElMessage } from 'element-plus';
import router from '@/router';

const request = axios.create({ baseURL: '/api', timeout: 15000 });

// 请求拦截器：自动携带 JWT
request.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// 响应拦截器：统一错误处理
request.interceptors.response.use(
  res => res,
  error => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      router.push('/login');
    } else if (error.response?.status === 403) {
      ElMessage.error('没有操作权限');
    } else {
      ElMessage.error(error.response?.data?.message || '请求失败');
    }
    return Promise.reject(error);
  },
);

export default request;
```

- [ ] **Step 3: User Store**

`client/src/stores/user.ts`:
```typescript
import { defineStore } from 'pinia';
import { ref } from 'vue';
import request from '@/utils/request';
import type { UserInfo, LoginResult } from '@/types';

export const useUserStore = defineStore('user', () => {
  const token = ref(localStorage.getItem('token') || '');
  const userInfo = ref<UserInfo | null>(null);

  const isLoggedIn = () => !!token.value;

  const login = async (username: string, password: string) => {
    const res = await request.post<LoginResult>('/auth/login', { username, password });
    token.value = res.data.access_token;
    userInfo.value = res.data.user;
    localStorage.setItem('token', res.data.access_token);
    localStorage.setItem('userInfo', JSON.stringify(res.data.user));
  };

  const logout = () => {
    token.value = '';
    userInfo.value = null;
    localStorage.removeItem('token');
    localStorage.removeItem('userInfo');
    router.push('/login');
  };

  const restoreSession = () => {
    const stored = localStorage.getItem('userInfo');
    if (stored) userInfo.value = JSON.parse(stored);
  };

  const hasPermission = (code: string) => {
    return userInfo.value?.permissions?.includes(code) ?? false;
  };

  return { token, userInfo, login, logout, isLoggedIn, restoreSession, hasPermission };
});
```

- [ ] **Step 4: 路由配置 + 权限守卫**

`client/src/router/index.ts`:
```typescript
import { createRouter, createWebHistory } from 'vue-router';
import Layout from '@/views/layout/Layout.vue';

const routes = [
  { path: '/login', component: () => import('@/views/login/LoginPage.vue') },
  {
    path: '/',
    component: Layout,
    redirect: '/contracts',
    meta: { requiresAuth: true },
    children: [
      // 合同管理
      { path: 'contracts', component: () => import('@/views/contract/ContractList.vue'), meta: { permission: 'contract:view' } },
      { path: 'contracts/create', component: () => import('@/views/contract/ContractForm.vue'), meta: { permission: 'contract:create' } },
      { path: 'contracts/:id', component: () => import('@/views/contract/ContractDetail.vue'), meta: { permission: 'contract:view' } },
      { path: 'contracts/:id/edit', component: () => import('@/views/contract/ContractForm.vue'), meta: { permission: 'contract:edit' } },
      // 生产管理
      { path: 'production', component: () => import('@/views/production/ProductionList.vue'), meta: { permission: 'production:view' } },
      { path: 'production/:id', component: () => import('@/views/production/ProductionDetail.vue'), meta: { permission: 'production:view' } },
      // 库存
      { path: 'inventory', component: () => import('@/views/inventory/InventoryList.vue'), meta: { permission: 'inventory:view' } },
      // 交付
      { path: 'delivery', component: () => import('@/views/delivery/DeliveryList.vue'), meta: { permission: 'delivery:ship' } },
      { path: 'delivery/:id', component: () => import('@/views/delivery/DeliveryDetail.vue'), meta: { permission: 'delivery:ship' } },
      // 系统管理
      { path: 'users', component: () => import('@/views/system/UserList.vue'), meta: { permission: 'system:admin' } },
      { path: 'roles', component: () => import('@/views/system/RoleList.vue'), meta: { permission: 'system:admin' } },
      { path: 'products', component: () => import('@/views/product/ProductList.vue'), meta: { permission: 'product:manage' } },
    ],
  },
  { path: '/403', component: () => import('@/views/error/403.vue') },
  { path: '/:pathMatch(.*)*', component: () => import('@/views/error/404.vue') },
];

const router = createRouter({ history: createWebHistory(), routes });

// 路由守卫
router.beforeEach((to, from, next) => {
  const userStore = useUserStore();
  userStore.restoreSession();

  if (to.path === '/login') return next();

  if (!userStore.isLoggedIn()) return next('/login');

  const permission = to.meta.permission as string;
  if (permission && !userStore.hasPermission(permission)) {
    return next('/403');
  }

  next();
});

export default router;
```

- [ ] **Step 5: v-permission 指令**

`client/src/permission/index.ts`:
```typescript
import type { App, Directive } from 'vue';
import { useUserStore } from '@/stores/user';

const permissionDirective: Directive = {
  mounted(el: HTMLElement, binding) {
    const userStore = useUserStore();
    const permissionCode = binding.value as string;
    if (permissionCode && !userStore.hasPermission(permissionCode)) {
      el.style.display = 'none';
    }
  },
};

export function setupPermission(app: App) {
  app.directive('permission', permissionDirective);
}
```

- [ ] **Step 6: 登录页面**

`client/src/views/login/LoginPage.vue`:
```vue
<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useUserStore } from '@/stores/user';
import { ElMessage } from 'element-plus';
import { UserFilled, Lock } from '@element-plus/icons-vue';

const router = useRouter();
const userStore = useUserStore();
const form = ref({ username: '', password: '' });
const loading = ref(false);

const handleLogin = async () => {
  loading.value = true;
  try {
    await userStore.login(form.value.username, form.value.password);
    ElMessage.success('登录成功');
    router.push('/');
  } catch {
    // 错误由 axios 拦截器处理
  } finally {
    loading.value = false;
  }
};
</script>

<template>
  <div class="login-container">
    <div class="login-card">
      <h2 class="login-title">合同管理系统</h2>
      <el-form :model="form" @keyup.enter="handleLogin">
        <el-form-item>
          <el-input v-model="form.username" placeholder="用户名" :prefix-icon="UserFilled" />
        </el-form-item>
        <el-form-item>
          <el-input v-model="form.password" type="password" placeholder="密码" show-password :prefix-icon="Lock" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="loading" style="width:100%" @click="handleLogin">
            登 录
          </el-button>
        </el-form-item>
      </el-form>
    </div>
  </div>
</template>

<style scoped>
.login-container {
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}
.login-card {
  width: 400px;
  padding: 40px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 12px rgba(0,0,0,.1);
}
.login-title {
  text-align: center;
  margin-bottom: 30px;
  color: #303133;
}
</style>
```

- [ ] **Step 7: 布局组件**

`client/src/views/layout/Layout.vue` — 包含侧边栏 + 顶栏 + 主内容区，侧边栏根据角色权限动态渲染菜单项。

- [ ] **Step 8: main.ts 入口**

`client/src/main.ts`:
```typescript
import { createApp } from 'vue';
import { createPinia } from 'pinia';
import ElementPlus from 'element-plus';
import 'element-plus/dist/index.css';
import App from './App.vue';
import router from './router';
import { setupPermission } from './permission';

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.use(ElementPlus, { locale: /* zhCn */ });
setupPermission(app);
app.mount('#app');
```

- [ ] **Step 9: 验证前端登录流程**

```bash
cd D:\contract-management-system\client
npm run dev
```

浏览器打开 `http://localhost:5173`，应看到登录页面。
用 admin / admin123 登录，应跳转到主页面，看到侧边栏菜单。

```bash
git add -A
git commit -m "feat: frontend foundation - login, layout, router guard, permission directive"
```

---

## Task 10: 前端合同管理页面

**Files:**
- Create: `client/src/views/contract/ContractList.vue`
- Create: `client/src/views/contract/ContractDetail.vue`
- Create: `client/src/views/contract/ContractForm.vue`
- Create: `client/src/views/contract/components/ContractItemsEditor.vue`
- Create: `client/src/views/contract/components/ContractTimeline.vue`
- Create: `client/src/views/contract/components/AuditDialog.vue`
- Create: `client/src/stores/contract.ts`

**Interfaces:**
- Consumes: 后端 API `/api/contracts/*`
- Produces: 合同列表页、表单页、详情页，含角色感知的 UI

- [ ] **Step 1: 合同 Store**

`client/src/stores/contract.ts`:
```typescript
export const useContractStore = defineStore('contract', () => {
  const list = ref<Contract[]>([]);
  const current = ref<Contract | null>(null);
  const loading = ref(false);

  async function fetchList() {
    loading.value = true;
    try {
      const res = await request.get('/contracts');
      list.value = res.data;
    } finally { loading.value = false; }
  }

  async function fetchById(id: number) {
    const res = await request.get(`/contracts/${id}`);
    current.value = res.data;
    return res.data;
  }

  async function create(data: any) {
    const res = await request.post('/contracts', data);
    return res.data;
  }

  async function update(id: number, data: any) {
    const res = await request.put(`/contracts/${id}`, data);
    return res.data;
  }

  async function submit(id: number) {
    return request.post(`/contracts/${id}/submit`);
  }

  async function audit(id: number, action: string, remark?: string) {
    return request.post(`/contracts/${id}/audit`, { action, remark });
  }

  async function changeContract(id: number, data: any) {
    return request.post(`/contracts/${id}/change`, data);
  }

  async function completeContract(id: number) {
    return request.post(`/contracts/${id}/complete`);
  }

  async function terminateContract(id: number) {
    return request.post(`/contracts/${id}/terminate`);
  }

  return {
    list, current, loading,
    fetchList, fetchById, create, update,
    submit, audit, changeContract, completeContract, terminateContract,
  };
});
```

- [ ] **Step 2: 合同列表页**

`ContractList.vue` — 带角色感知的表格，显示状态标签和操作按钮。核心要点：
- 顶部搜索区（客户名、合同号、状态筛选）
- 表格列：合同号、客户名、状态（彩色标签）、销售员、创建时间
- 操作列：根据 `v-permission` 指令显示按钮（提交/审核/变更/终止/交付确认）
- 状态标签颜色映射

```vue
<script setup lang="ts">
import { onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useContractStore } from '@/stores/contract';
import { useUserStore } from '@/stores/user';
import { ElMessage, ElMessageBox } from 'element-plus';
import { ref } from 'vue';

const router = useRouter();
const store = useContractStore();
const userStore = useUserStore();

const statusMap: Record<string, { label: string; type: string }> = {
  draft: { label: '草稿', type: 'info' },
  pending: { label: '待评审', type: 'warning' },
  approved: { label: '已通过', type: 'success' },
  returned: { label: '已退回', type: 'danger' },
  production: { label: '生产中', type: 'primary' },
  shipped: { label: '已发货', type: '' },
  installing: { label: '待交付', type: 'warning' },
  delivered: { label: '已完成', type: 'success' },
  cancelled: { label: '已作废', type: 'danger' },
};

onMounted(() => store.fetchList());

const handleSubmit = async (id: number) => {
  await store.submit(id);
  ElMessage.success('已提交审核');
  store.fetchList();
};

const handleAudit = (id: number) => {
  // 打开审核对话框
};

const handleChange = (id: number) => {
  router.push(`/contracts/${id}/edit?mode=change`);
};

const handleComplete = async (id: number) => {
  await ElMessageBox.confirm('确认该合同已完成交付？');
  await store.completeContract(id);
  ElMessage.success('交付确认成功');
  store.fetchList();
};
</script>

<template>
  <div>
    <h2>合同管理</h2>
    <el-table :data="store.list" v-loading="store.loading" border stripe>
      <el-table-column prop="contract_no" label="合同号" width="180" />
      <el-table-column prop="customer_name" label="客户名" min-width="150" />
      <el-table-column label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="statusMap[row.status]?.type as any">
            {{ statusMap[row.status]?.label || row.status }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="submitter?.real_name" label="销售员" width="100" />
      <el-table-column prop="createdAt" label="创建时间" width="180" />
      <el-table-column label="操作" width="280" fixed="right">
        <template #default="{ row }">
          <el-button size="small" @click="router.push(`/contracts/${row.id}`)">详情</el-button>
          <el-button size="small" v-permission="'contract:submit'"
            v-if="row.status==='draft'" type="primary" @click="handleSubmit(row.id)">提交</el-button>
          <el-button size="small" v-permission="'contract:audit'"
            v-if="row.status==='pending'" type="warning" @click="handleAudit(row.id)">审核</el-button>
          <el-button size="small" v-permission="'contract:change'"
            v-if="row.status!=='cancelled' && row.status!=='delivered'" @click="handleChange(row.id)">变更</el-button>
          <el-button size="small" v-permission="'contract:complete'"
            v-if="row.status==='installing'" type="success" @click="handleComplete(row.id)">交付</el-button>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>
```

- [ ] **Step 3: 合同表单页**

`ContractForm.vue` — 支持新建/编辑/变更三种模式：
- 根据路由参数区分：`create`（新建）、 无参（编辑）、`?mode=change`（变更）
- 表单字段：客户名称、电话、地址
- 设备清单（ContractItemsEditor 组件）：动态增减行，每行选产品 + 数量 + 备注
- 变更时带出原合同数据，且必填变更原因

- [ ] **Step 4: 合同详情页**

`ContractDetail.vue`:
- 顶部：合同号、状态标签、操作按钮
- 基本信息卡片：客户信息
- 设备清单表格
- 附件列表
- 操作时间线（ContractTimeline 组件）：显示合同的完整操作历史

- [ ] **Step 5: 审核对话框**

`AuditDialog.vue`:
```vue
<template>
  <el-dialog v-model="visible" title="合同审核" width="400px">
    <el-radio-group v-model="action">
      <el-radio value="pass">审核通过</el-radio>
      <el-radio value="reject">退回修改</el-radio>
    </el-radio-group>
    <el-input v-if="action==='reject'" v-model="remark" type="textarea" placeholder="退回原因" :rows="3" />
    <template #footer>
      <el-button @click="visible=false">取消</el-button>
      <el-button type="primary" @click="confirm">确认</el-button>
    </template>
  </el-dialog>
</template>
```

- [ ] **Step 6: 验证**

以销售角色登录，创建合同 → 提交。切换财务角色 → 审核通过。页面交互应完整流畅。

```bash
git add -A
git commit -m "feat: frontend contract pages - list, form, detail with role-aware actions"
```

---

## Task 11: 前端生产 & 质检页面

**Files:**
- Create: `client/src/views/production/ProductionList.vue`
- Create: `client/src/views/production/ProductionDetail.vue`
- Create: `client/src/views/production/components/QCForm.vue`
- Create: `client/src/stores/production.ts`

**Interfaces:**
- Consumes: 后端 API `/api/production/*`
- Produces: 工单列表页、工单详情页（含质检操作）

- [ ] **Step 1: Production Store**

```typescript
// stores/production.ts — 类似 contract store，API 调用 /api/production
export const useProductionStore = defineStore('production', () => {
  const list = ref([]);
  const current = ref(null);

  async function fetchList() {
    const res = await request.get('/production');
    list.value = res.data;
  }

  async function fetchById(id: number) {
    const res = await request.get(`/production/${id}`);
    current.value = res.data;
    return res.data;
  }

  async function create(contractId: number) {
    return request.post('/production', { contract_id: contractId });
  }

  async function start(id: number) {
    return request.put(`/production/${id}/start`);
  }

  async function complete(id: number) {
    return request.put(`/production/${id}/complete`);
  }

  async function qc(id: number, action: string, remark?: string) {
    return request.put(`/production/${id}/qc`, { action, remark });
  }

  return { list, current, fetchList, fetchById, create, start, complete, qc };
});
```

- [ ] **Step 2: 生产列表页**

`ProductionList.vue` — 显示工单列表：
- 表格列：ID、关联合同号、状态标签、创建时间
- 操作：创建工单按钮（选择已审批通过的合同）、开始生产、生产完成

- [ ] **Step 3: 生产详情页**

`ProductionDetail.vue` — 显示工单详情：
- 基本信息卡（合同号、状态、时间线）
- 生产设备清单 + 质检状态
- 操作区：根据用户角色显示不同按钮
  - 生产角色：开始/完成按钮
  - 质检角色：质检通过/退回按钮，带备注输入

- [ ] **Step 4: 验证**

以生产角色登录 → 查看待生产合同 → 创建工单 → 开始 → 完成。
切换质检角色 → 查看待检工单 → 质检通过。

```bash
git add -A
git commit -m "feat: frontend production pages with QC operations"
```

---

## Task 12: 前端库存 + 交付页面

**Files:**
- Create: `client/src/views/inventory/InventoryList.vue`
- Create: `client/src/views/delivery/DeliveryList.vue`
- Create: `client/src/views/delivery/DeliveryForm.vue`
- Create: `client/src/views/delivery/DeliveryDetail.vue`
- Create: `client/src/views/delivery/components/AfterSaleForm.vue`

**Interfaces:**
- Consumes: 后端 API `/api/inventory/*`、`/api/delivery/*`
- Produces: 库存列表、发货单管理、售后记录表单

- [ ] **Step 1: 库存列表页**

`InventoryList.vue`:
```vue
<template>
  <div>
    <h2>库存管理</h2>
    <el-table :data="inventoryList" border stripe v-loading="loading">
      <el-table-column label="产品型号" prop="product.model" />
      <el-table-column label="产品名称" prop="product.name" />
      <el-table-column label="库存数量" prop="quantity" width="120">
        <template #default="{ row }">
          <el-tag :type="row.quantity > 0 ? 'success' : 'danger'">
            {{ row.quantity }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="库位" prop="location" width="150" />
      <el-table-column label="最后更新" prop="updatedAt" width="180" />
      <el-table-column label="操作" width="160">
        <template #default="{ row }">
          <el-button size="small" v-permission="'inventory:update'" @click="showAdjust(row)">
            调整库存
          </el-button>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>
```

- [ ] **Step 2: 发货管理页面**

`DeliveryList.vue` — 发货单列表 + 创建发货单按钮。
`DeliveryForm.vue` — 选择合同、填写物流信息、选择发送设备。
`DeliveryDetail.vue` — 发货单详情 + 售后装机测试记录按钮。
`AfterSaleForm.vue` — 填写测试日期、测试结果。

- [ ] **Step 3: 验证**

生产角色 → 查看库存列表。
对质检通过的合同 → 创建发货单 → 记录售后装机。

```bash
git add -A
git commit -m "feat: frontend inventory and delivery pages"
```

---

## Task 13: 前端系统管理页面

**Files:**
- Create: `client/src/views/system/UserList.vue`
- Create: `client/src/views/system/UserForm.vue`
- Create: `client/src/views/system/RoleList.vue`
- Create: `client/src/views/system/RoleForm.vue`
- Create: `client/src/views/product/ProductList.vue`
- Create: `client/src/views/product/ProductForm.vue`

**Interfaces:**
- Consumes: 后端 API `/api/users/*`、`/api/roles/*`、`/api/permissions`、`/api/products/*`
- Produces: 用户/角色/产品管理的 CRUD 页面

- [ ] **Step 1: 用户管理**

`UserList.vue` — 用户表格（用户名、姓名、手机、状态、角色），启用/禁用、编辑、删除。
`UserForm.vue` — 创建/编辑用户表单（含角色选择多选框）。

- [ ] **Step 2: 角色管理**

`RoleList.vue` — 角色列表 + 权限配置对话框（树形权限选择器）。
`RoleForm.vue` — 角色创建/编辑。

- [ ] **Step 3: 产品目录管理**

`ProductList.vue` — 产品表格（型号、名称、规格、状态）。
`ProductForm.vue` — 产品创建/编辑表单（规格使用 JSON 输入或动态键值对）。

- [ ] **Step 4: 验证**

管理员登录 → 管理用户（创建销售账号）→ 管理角色权限 → 管理产品目录。

```bash
git add -A
git commit -m "feat: frontend admin pages - users, roles, products management"
```

---

## Task 14: 部署配置 & README

**Files:**
- Create: `deploy/docker-compose.yml`
- Create: `deploy/Dockerfile`
- Create: `deploy/nginx.conf`
- Create: `server/.env.example`
- Create: `README.md`

**Interfaces:**
- Consumes: 完整项目代码
- Produces: 可 Docker 化部署的配置 + 项目文档

- [ ] **Step 1: 后端 Dockerfile**

`deploy/Dockerfile`:
```dockerfile
# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY server/package*.json ./
RUN npm ci
COPY server/ ./
RUN npm run build

# Production stage
FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
EXPOSE 3000
CMD ["node", "dist/main"]
```

- [ ] **Step 2: Nginx 配置**

`deploy/nginx.conf`:
```nginx
server {
    listen 80;
    server_name _;

    # 前端静态文件
    root /usr/share/nginx/html;
    index index.html;
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API 反向代理
    location /api/ {
        proxy_pass http://app:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

- [ ] **Step 3: 生产环境 docker-compose**

`deploy/docker-compose.yml`:
```yaml
version: '3.8'
services:
  app:
    build:
      context: ..
      dockerfile: deploy/Dockerfile
    environment:
      DB_HOST: postgres
      DB_PORT: 5432
      DB_USER: postgres
      DB_PASSWORD: ${DB_PASSWORD:-postgres}
      DB_NAME: contract_db
      JWT_SECRET: ${JWT_SECRET:-change-me-in-production}
    depends_on:
      - postgres
    restart: always

  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: contract_db
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${DB_PASSWORD:-postgres}
    volumes:
      - pgdata:/var/lib/postgresql/data
    restart: always

  nginx:
    image: nginx:alpine
    ports:
      - '80:80'
    volumes:
      - ./nginx.conf:/etc/nginx/conf.d/default.conf
      - ../client/dist:/usr/share/nginx/html
    depends_on:
      - app
    restart: always

volumes:
  pgdata:
```

- [ ] **Step 4: 环境变量示例文件**

`server/.env.example`:
```
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=contract_db
JWT_SECRET=your-secret-key
```

- [ ] **Step 5: README**

```markdown
# 合同流程管理系统

公司内部使用的合同全流程管理系统，覆盖销售录入→财务评审→生产→质检→发货→售后完整业务闭环。

## 技术栈

- **前端**: Vue 3 + TypeScript + Element Plus + Vite + Pinia
- **后端**: NestJS + TypeORM + PostgreSQL
- **部署**: Docker + Nginx

## 快速开始

### 开发环境

1. 启动 PostgreSQL: `docker compose -f docker-compose.yml up -d`
2. 启动后端: `cd server && npm run start:dev`
3. 启动前端: `cd client && npm run dev`
4. 访问: http://localhost:5173

### 默认账号

| 用户名 | 密码 | 角色 |
|--------|------|------|
| admin | admin123 | 管理员 |
| sales1 | 123456 | 销售 |
| finance1 | 123456 | 财务 |
| prod1 | 123456 | 生产 |
| qc1 | 123456 | 质检 |
```

- [ ] **Step 6: 最终提交**

```bash
git add -A
git commit -m "docs: add deployment config, README and environment example"
```

```bash
# 推送到 GitHub
git push origin master
```
