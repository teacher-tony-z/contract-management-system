import { Controller, Get, Post, Put, Param, Query, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Controller('products')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class ProductsController {
  constructor(private service: ProductsService) {}

  @Get()
  @Permissions('product:view')
  findAll(@Query('status') status?: string) { return this.service.findAll(status); }

  @Get(':id')
  @Permissions('product:view')
  findOne(@Param('id') id: number) { return this.service.findOne(id); }

  @Post()
  @Permissions('product:manage')
  create(@Body() dto: CreateProductDto) { return this.service.create(dto); }

  @Put(':id')
  @Permissions('product:manage')
  update(@Param('id') id: number, @Body() dto: UpdateProductDto) { return this.service.update(id, dto); }
}
