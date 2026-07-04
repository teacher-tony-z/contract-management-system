import { Controller, Get, Post, Put, Param, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ProductionService } from './production.service';
import { CreateProductionDto } from './dto/create-production.dto';
import { QcDto } from './dto/qc.dto';

@Controller('production')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class ProductionController {
  constructor(private service: ProductionService) {}

  @Get() @Permissions('production:view')
  findAll(@CurrentUser() user: any) { return this.service.findAll(user); }

  @Get(':id') @Permissions('production:view')
  findOne(@Param('id') id: number) { return this.service.findOne(id); }

  @Post() @Permissions('production:create')
  create(@Body() dto: CreateProductionDto, @CurrentUser() user: any) {
    return this.service.create(dto.contract_id, user.id);
  }

  @Put(':id/start') @Permissions('production:start')
  start(@Param('id') id: number, @CurrentUser() user: any) { return this.service.start(id, user.id); }

  @Put(':id/complete') @Permissions('production:start')
  complete(@Param('id') id: number, @CurrentUser() user: any) { return this.service.complete(id, user.id); }

  @Put(':id/qc') @Permissions('production:qc')
  qc(@Param('id') id: number, @Body() dto: QcDto, @CurrentUser() user: any) {
    if (dto.action === 'pass') return this.service.qcPass(id, user.id, dto.remark);
    return this.service.qcReject(id, user.id, dto.remark || '');
  }
}
