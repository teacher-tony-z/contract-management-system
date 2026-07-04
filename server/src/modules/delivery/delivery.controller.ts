import { Controller, Get, Post, Param, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { DeliveryService } from './delivery.service';
import { CreateDeliveryDto } from './dto/create-delivery.dto';
import { AfterSaleDto } from './dto/after-sale.dto';

@Controller('delivery')
@UseGuards(JwtAuthGuard)
export class DeliveryController {
  constructor(private service: DeliveryService) {}

  @Get() @Permissions('delivery:ship')
  findAll() { return this.service.findAll(); }

  @Get(':id') @Permissions('delivery:ship')
  findOne(@Param('id') id: number) { return this.service.findOne(id); }

  @Post() @Permissions('delivery:ship')
  create(@Body() dto: CreateDeliveryDto, @CurrentUser() user: any) {
    return this.service.create(dto.contract_id, dto, user.id);
  }

  @Post(':id/after-sale') @Permissions('delivery:install')
  recordAfterSale(@Param('id') id: number, @Body() dto: AfterSaleDto, @CurrentUser() user: any) {
    return this.service.recordAfterSale(id, dto, user.id);
  }

  @Get('after-sale/:contractId') @Permissions('delivery:install')
  getAfterSaleRecords(@Param('contractId') contractId: number) {
    return this.service.getAfterSaleRecords(contractId);
  }
}
