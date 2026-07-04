import { Controller, Get, Post, Put, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ContractsService } from './contracts.service';
import { CreateContractDto } from './dto/create-contract.dto';
import { AuditContractDto } from './dto/audit-contract.dto';
import { ChangeContractDto } from './dto/change-contract.dto';

@Controller('contracts')
@UseGuards(JwtAuthGuard)
export class ContractsController {
  constructor(private service: ContractsService) {}

  @Post()
  @Permissions('contract:create')
  create(@Body() dto: CreateContractDto, @CurrentUser() user: any) {
    return this.service.create(dto, user.id);
  }

  @Get()
  @Permissions('contract:view')
  findAll(@CurrentUser() user: any) {
    return this.service.findAll(user);
  }

  @Get(':id')
  @Permissions('contract:view')
  findOne(@Param('id') id: number) {
    return this.service.findOne(id);
  }

  @Put(':id')
  @Permissions('contract:edit')
  update(
    @Param('id') id: number,
    @Body() dto: CreateContractDto,
    @CurrentUser() user: any,
  ) {
    return this.service.update(id, dto, user.id);
  }

  @Delete(':id')
  @Permissions('contract:delete')
  remove(@Param('id') id: number) {
    return this.service.remove(id);
  }

  @Post(':id/submit')
  @Permissions('contract:submit')
  submit(@Param('id') id: number, @CurrentUser() user: any) {
    return this.service.submit(id, user.id);
  }

  @Post(':id/audit')
  @Permissions('contract:audit')
  audit(
    @Param('id') id: number,
    @Body() dto: AuditContractDto,
    @CurrentUser() user: any,
  ) {
    return this.service.audit(id, user.id, dto);
  }

  @Post(':id/change')
  @Permissions('contract:change')
  change(
    @Param('id') id: number,
    @Body() dto: ChangeContractDto,
    @CurrentUser() user: any,
  ) {
    return this.service.change(id, user.id, dto);
  }

  @Post(':id/complete')
  @Permissions('contract:complete')
  complete(@Param('id') id: number, @CurrentUser() user: any) {
    return this.service.complete(id, user.id);
  }

  @Post(':id/terminate')
  @Permissions('contract:terminate')
  terminate(@Param('id') id: number, @CurrentUser() user: any) {
    return this.service.terminate(id, user.id);
  }

  @Get(':id/operations')
  @Permissions('contract:view')
  getOperations(@Param('id') id: number) {
    return this.service.getOperations(id);
  }
}
