import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import bcrypt from 'bcrypt';
import { AuthService } from '../auth.service';
import { User } from '../entities/user.entity';
import { UserRole } from '../../roles/entities/user-role.entity';
import { createMockRepo } from '../../../test-utils/mock-factory';

// 让所有 bcrypt 方法变成 jest.fn()
jest.mock('bcrypt', () => ({
  compare: jest.fn(),
}));

describe('AuthService', () => {
  let service: AuthService;
  let userRepo: ReturnType<typeof createMockRepo>;
  let userRoleRepo: ReturnType<typeof createMockRepo>;
  let jwtService: Record<string, jest.Mock>;

  const mockUser = {
    id: 1,
    username: 'admin',
    password_hash: 'hashed_password',
    real_name: '管理员',
    status: 1,
  };

  const mockRoles = [
    { id: 1, user_id: 1, role_id: 1, role: { id: 1, name: '管理员' } },
  ];

  beforeEach(async () => {
    // 重置 bcrypt mock 状态
    (bcrypt.compare as jest.Mock).mockReset();

    userRepo = createMockRepo();
    userRoleRepo = createMockRepo();
    jwtService = { sign: jest.fn(() => 'mock-jwt-token') };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: getRepositoryToken(UserRole), useValue: userRoleRepo },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('login', () => {
    it('应返回 access_token 和 user 信息（含角色和权限）', async () => {
      userRepo.findOne.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      userRoleRepo.find.mockResolvedValue(mockRoles);
      userRoleRepo.manager.createQueryBuilder = jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([
          { p_code: 'system:admin' },
          { p_code: 'contract:create' },
        ]),
      })) as any;

      const result = await service.login('admin', 'admin123');

      expect(result.access_token).toBe('mock-jwt-token');
      expect(result.user).toMatchObject({
        username: 'admin',
        real_name: '管理员',
        roles: ['管理员'],
        permissions: expect.arrayContaining(['system:admin', 'contract:create']),
      });
      expect(jwtService.sign).toHaveBeenCalled();
    });

    it('错误密码应抛 UnauthorizedException', async () => {
      userRepo.findOne.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login('admin', 'wrong')).rejects.toThrow(UnauthorizedException);
    });

    it('不存在的用户名应抛 UnauthorizedException', async () => {
      userRepo.findOne.mockResolvedValue(null);

      await expect(service.login('nobody', '123')).rejects.toThrow(UnauthorizedException);
    });

    it('被禁用的用户应抛 UnauthorizedException', async () => {
      userRepo.findOne.mockResolvedValue({ ...mockUser, status: 0 });

      await expect(service.login('admin', 'admin123')).rejects.toThrow(UnauthorizedException);
    });
  });
});
