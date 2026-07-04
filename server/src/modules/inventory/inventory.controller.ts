import { Controller, Get, Post, Param, Query, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { InventoryService } from './inventory.service';
import { AdjustDto } from './dto/adjust.dto';

@Controller('inventory')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class InventoryController {
  constructor(private service: InventoryService) {}

  @Get()
  @Permissions('inventory:view')
  findAll() { return this.service.findAll(); }

  @Get(':productId')
  @Permissions('inventory:view')
  findOne(@Param('productId') productId: number) { return this.service.findOne(productId); }

  @Post(':productId/adjust')
  @Permissions('inventory:update')
  adjust(@Param('productId') productId: number, @Body() dto: AdjustDto, @CurrentUser() user: any) {
    return this.service.adjust(productId, dto, user.id);
  }

  @Get('logs/list')
  @Permissions('inventory:view')
  getLogs(@Query('productId') productId?: number) { return this.service.getLogs(productId); }
}
