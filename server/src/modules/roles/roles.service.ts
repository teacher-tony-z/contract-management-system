import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../auth/entities/user.entity';
import { Role } from './entities/role.entity';
import { Permission } from './entities/permission.entity';
import { RolePermission } from './entities/role-permission.entity';
import { UserRole } from './entities/user-role.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { CreateRoleDto } from './dto/create-role.dto';

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Role) private roleRepo: Repository<Role>,
    @InjectRepository(Permission) private permRepo: Repository<Permission>,
    @InjectRepository(RolePermission) private rpRepo: Repository<RolePermission>,
    @InjectRepository(UserRole) private urRepo: Repository<UserRole>,
  ) {}

  async createUser(dto: CreateUserDto): Promise<any> {
    const hash = await bcrypt.hash(dto.password, 10);
    const user = this.userRepo.create({
      username: dto.username,
      password_hash: hash,
      real_name: dto.real_name,
      phone: dto.phone,
    });
    const saved = await this.userRepo.save(user);
    if (dto.role_ids?.length) {
      await this.urRepo.save(
        dto.role_ids.map(rid => ({ user_id: saved.id, role_id: rid })),
      );
    }
    const { password_hash, ...result } = saved;
    return result;
  }

  async findUsers(): Promise<User[]> {
    return this.userRepo.find({
      select: ['id', 'username', 'real_name', 'phone', 'status', 'createdAt'],
      relations: ['userRoles', 'userRoles.role'],
    });
  }

  async findUserById(id: number): Promise<User> {
    const user = await this.userRepo.findOne({
      where: { id },
      relations: ['userRoles', 'userRoles.role'],
    });
    if (!user) throw new NotFoundException('用户不存在');
    return user;
  }

  async updateUser(id: number, dto: UpdateUserDto): Promise<any> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('用户不存在');

    const updateData: any = {};
    if (dto.username) updateData.username = dto.username;
    if (dto.password) updateData.password_hash = await bcrypt.hash(dto.password, 10);
    if (dto.real_name) updateData.real_name = dto.real_name;
    if (dto.phone !== undefined) updateData.phone = dto.phone;

    await this.userRepo.update(id, updateData);

    if (dto.role_ids !== undefined) {
      await this.urRepo.delete({ user_id: id });
      if (dto.role_ids.length > 0) {
        await this.urRepo.save(
          dto.role_ids.map(rid => ({ user_id: id, role_id: rid })),
        );
      }
    }

    return this.findUserById(id);
  }

  async deleteUser(id: number): Promise<void> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('用户不存在');
    await this.urRepo.delete({ user_id: id });
    await this.userRepo.delete(id);
  }

  async updateUserStatus(id: number, status: number): Promise<void> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('用户不存在');
    await this.userRepo.update(id, { status });
  }

  async findAllRoles(): Promise<Role[]> {
    return this.roleRepo.find();
  }

  async createRole(dto: CreateRoleDto): Promise<Role> {
    const role = this.roleRepo.create(dto);
    return this.roleRepo.save(role);
  }

  async findAllPermissions(): Promise<Permission[]> {
    return this.permRepo.find();
  }

  async assignPermissions(roleId: number, permissionIds: number[]): Promise<void> {
    const role = await this.roleRepo.findOne({ where: { id: roleId } });
    if (!role) throw new NotFoundException('角色不存在');

    await this.rpRepo.delete({ role_id: roleId });

    if (permissionIds.length > 0) {
      await this.rpRepo.save(
        permissionIds.map(pid => ({ role_id: roleId, permission_id: pid })),
      );
    }
  }
}
