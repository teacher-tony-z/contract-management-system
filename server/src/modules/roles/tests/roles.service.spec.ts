import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import bcrypt from 'bcrypt';
import { RolesService } from '../roles.service';
import { User } from '../../auth/entities/user.entity';
import { Role } from '../entities/role.entity';
import { Permission } from '../entities/permission.entity';
import { RolePermission } from '../entities/role-permission.entity';
import { UserRole } from '../entities/user-role.entity';
import { createMockRepo } from '../../../test-utils/mock-factory';

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
}));

describe('RolesService', () => {
  let service: RolesService;
  let userRepo: ReturnType<typeof createMockRepo>;
  let roleRepo: ReturnType<typeof createMockRepo>;
  let permRepo: ReturnType<typeof createMockRepo>;
  let rpRepo: ReturnType<typeof createMockRepo>;
  let urRepo: ReturnType<typeof createMockRepo>;

  beforeEach(async () => {
    (bcrypt.hash as jest.Mock).mockReset();

    userRepo = createMockRepo();
    roleRepo = createMockRepo();
    permRepo = createMockRepo();
    rpRepo = createMockRepo();
    urRepo = createMockRepo();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesService,
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: getRepositoryToken(Role), useValue: roleRepo },
        { provide: getRepositoryToken(Permission), useValue: permRepo },
        { provide: getRepositoryToken(RolePermission), useValue: rpRepo },
        { provide: getRepositoryToken(UserRole), useValue: urRepo },
      ],
    }).compile();

    service = module.get<RolesService>(RolesService);
  });

  // ============ 用户管理 ============

  describe('createUser', () => {
    it('应创建用户并返回不含密码的信息', async () => {
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed_xxx');
      userRepo.create.mockReturnValue({ id: 1, username: 'test', real_name: '测试' });
      userRepo.save.mockResolvedValue({ id: 1, username: 'test', password_hash: 'hashed_xxx', real_name: '测试' });
      urRepo.save.mockResolvedValue([{ id: 1, user_id: 1, role_id: 1 }]);

      const result = await service.createUser({
        username: 'test', password: '123456', real_name: '测试', role_ids: [1],
      });

      expect(bcrypt.hash).toHaveBeenCalledWith('123456', 10);
      expect(result).not.toHaveProperty('password_hash');
      expect(result).toMatchObject({ id: 1, username: 'test' });
      expect(urRepo.save).toHaveBeenCalledWith([{ user_id: 1, role_id: 1 }]);
    });

    it('不传 role_ids 时不应创建关联', async () => {
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed');
      userRepo.create.mockReturnValue({ id: 2, username: 'test2' });
      userRepo.save.mockResolvedValue({ id: 2, username: 'test2', password_hash: 'hashed' });

      await service.createUser({ username: 'test2', password: '123456', real_name: '测试' });

      expect(urRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('findUsers', () => {
    it('应返回用户列表含角色关联', async () => {
      const users = [
        { id: 1, username: 'admin', userRoles: [{ role: { name: '管理员' } }] },
      ];
      userRepo.find.mockResolvedValue(users);

      const result = await service.findUsers();

      expect(result).toEqual(users);
      expect(userRepo.find).toHaveBeenCalledWith({
        select: ['id', 'username', 'real_name', 'phone', 'status', 'createdAt'],
        relations: ['userRoles', 'userRoles.role'],
      });
    });
  });

  describe('findUserById', () => {
    it('应返回用户', async () => {
      const user = { id: 1, username: 'admin', userRoles: [] };
      userRepo.findOne.mockResolvedValue(user);

      expect(await service.findUserById(1)).toEqual(user);
    });

    it('不存在应抛 NotFoundException', async () => {
      userRepo.findOne.mockResolvedValue(null);
      await expect(service.findUserById(99)).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateUser', () => {
    it('应更新用户字段和角色', async () => {
      userRepo.findOne.mockResolvedValueOnce({ id: 1, username: 'old' });
      (bcrypt.hash as jest.Mock).mockResolvedValue('new_hash');
      userRepo.update.mockResolvedValue({ affected: 1 });
      urRepo.delete.mockResolvedValue({ affected: 1 });
      urRepo.save.mockResolvedValue([{ user_id: 1, role_id: 2 }]);
      userRepo.findOne.mockResolvedValueOnce({
        id: 1, username: 'newuser', real_name: 'New', userRoles: [{ role: { name: '销售' } }],
      });

      const result = await service.updateUser(1, {
        username: 'newuser', password: 'newpass', real_name: 'New', role_ids: [2],
      });

      expect(result.username).toBe('newuser');
      expect(urRepo.delete).toHaveBeenCalledWith({ user_id: 1 });
      expect(urRepo.save).toHaveBeenCalledWith([{ user_id: 1, role_id: 2 }]);
    });

    it('不传 role_ids 时不应修改角色', async () => {
      userRepo.findOne.mockResolvedValueOnce({ id: 1, username: 'admin' });
      userRepo.update.mockResolvedValue({ affected: 1 });
      userRepo.findOne.mockResolvedValueOnce({ id: 1, username: 'changed' });

      await service.updateUser(1, { username: 'changed', real_name: '改变' });

      expect(urRepo.delete).not.toHaveBeenCalled();
    });

    it('不存在应抛 NotFoundException', async () => {
      userRepo.findOne.mockResolvedValue(null);
      await expect(service.updateUser(99, { username: 'x', real_name: 'x' }))
        .rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteUser', () => {
    it('应删除用户关联角色后删除用户', async () => {
      userRepo.findOne.mockResolvedValue({ id: 1, username: 'del' });
      urRepo.delete.mockResolvedValue({ affected: 1 });
      userRepo.delete.mockResolvedValue({ affected: 1 });

      await service.deleteUser(1);

      expect(urRepo.delete).toHaveBeenCalledWith({ user_id: 1 });
      expect(userRepo.delete).toHaveBeenCalledWith(1);
    });

    it('不存在应抛 NotFoundException', async () => {
      userRepo.findOne.mockResolvedValue(null);
      await expect(service.deleteUser(99)).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateUserStatus', () => {
    it('应更新用户状态', async () => {
      userRepo.findOne.mockResolvedValue({ id: 1 });
      userRepo.update.mockResolvedValue({ affected: 1 });

      await service.updateUserStatus(1, 0);

      expect(userRepo.update).toHaveBeenCalledWith(1, { status: 0 });
    });
  });

  // ============ 角色管理 ============

  describe('findAllRoles', () => {
    it('应返回所有角色', async () => {
      const roles = [{ id: 1, name: '管理员' }, { id: 2, name: '销售' }];
      roleRepo.find.mockResolvedValue(roles);
      expect(await service.findAllRoles()).toEqual(roles);
    });
  });

  describe('createRole', () => {
    it('应创建角色', async () => {
      const role = { id: 1, name: '新角色', description: 'desc' };
      roleRepo.create.mockReturnValue(role);
      roleRepo.save.mockResolvedValue(role);

      const result = await service.createRole({ name: '新角色', description: 'desc' });

      expect(result).toEqual(role);
    });
  });

  // ============ 权限管理 ============

  describe('findAllPermissions', () => {
    it('应返回所有权限', async () => {
      const perms = [{ id: 1, code: 'contract:create' }];
      permRepo.find.mockResolvedValue(perms);
      expect(await service.findAllPermissions()).toEqual(perms);
    });
  });

  describe('assignPermissions', () => {
    it('应清空旧权限并分配新权限', async () => {
      roleRepo.findOne.mockResolvedValue({ id: 1, name: '销售' });
      rpRepo.delete.mockResolvedValue({ affected: 3 });
      rpRepo.save.mockResolvedValue([
        { role_id: 1, permission_id: 1 },
        { role_id: 1, permission_id: 2 },
      ]);

      await service.assignPermissions(1, [1, 2]);

      expect(rpRepo.delete).toHaveBeenCalledWith({ role_id: 1 });
      expect(rpRepo.save).toHaveBeenCalledWith([
        { role_id: 1, permission_id: 1 },
        { role_id: 1, permission_id: 2 },
      ]);
    });

    it('角色不存在应抛 NotFoundException', async () => {
      roleRepo.findOne.mockResolvedValue(null);
      await expect(service.assignPermissions(99, [1])).rejects.toThrow(NotFoundException);
    });

    it('permission_ids 为空时只清空不新增', async () => {
      roleRepo.findOne.mockResolvedValue({ id: 1 });

      await service.assignPermissions(1, []);

      expect(rpRepo.delete).toHaveBeenCalled();
      expect(rpRepo.save).not.toHaveBeenCalled();
    });
  });
});
