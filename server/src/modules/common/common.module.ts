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
