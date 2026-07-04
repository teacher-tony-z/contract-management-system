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
