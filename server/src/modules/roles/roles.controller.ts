import {
  Controller,
  UseGuards,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { RolesService } from './roles.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { CreateRoleDto } from './dto/create-role.dto';

@Controller()
@UseGuards(JwtAuthGuard)
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get('users')
  @Permissions('system:admin')
  findAllUsers() {
    return this.rolesService.findUsers();
  }

  @Get('users/:id')
  @Permissions('system:admin')
  findUser(@Param('id') id: number) {
    return this.rolesService.findUserById(id);
  }

  @Post('users')
  @Permissions('system:admin')
  createUser(@Body() dto: CreateUserDto) {
    return this.rolesService.createUser(dto);
  }

  @Put('users/:id')
  @Permissions('system:admin')
  updateUser(@Param('id') id: number, @Body() dto: UpdateUserDto) {
    return this.rolesService.updateUser(id, dto);
  }

  @Delete('users/:id')
  @Permissions('system:admin')
  deleteUser(@Param('id') id: number) {
    return this.rolesService.deleteUser(id);
  }

  @Put('users/:id/status')
  @Permissions('system:admin')
  updateStatus(@Param('id') id: number, @Body('status') status: number) {
    return this.rolesService.updateUserStatus(id, status);
  }

  @Get('roles')
  @Permissions('system:admin')
  findAllRoles() {
    return this.rolesService.findAllRoles();
  }

  @Post('roles')
  @Permissions('system:admin')
  createRole(@Body() dto: CreateRoleDto) {
    return this.rolesService.createRole(dto);
  }

  @Get('permissions')
  @Permissions('system:admin')
  findAllPermissions() {
    return this.rolesService.findAllPermissions();
  }

  @Put('roles/:id/permissions')
  @Permissions('system:admin')
  assignPermissions(
    @Param('id') id: number,
    @Body('permission_ids') ids: number[],
  ) {
    return this.rolesService.assignPermissions(id, ids);
  }
}
