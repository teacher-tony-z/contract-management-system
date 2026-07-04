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
