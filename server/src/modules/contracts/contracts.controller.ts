import {
  Controller, Get, Post, Put, Delete, Param, Body, Query, UseGuards,
  UseInterceptors, UploadedFile, Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ContractsService } from './contracts.service';
import { CreateContractDto } from './dto/create-contract.dto';
import { AuditContractDto } from './dto/audit-contract.dto';
import { ChangeContractDto } from './dto/change-contract.dto';

@Controller('contracts')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class ContractsController {
  constructor(private service: ContractsService) {}

  @Post()
  @Permissions('contract:create')
  create(@Body() dto: CreateContractDto, @CurrentUser() user: any) {
    return this.service.create(dto, user.id);
  }

  @Get()
  @Permissions('contract:view')
  findAll(
    @CurrentUser() user: any,
    @Query('customer_name') customer_name?: string,
    @Query('contract_no') contract_no?: string,
    @Query('status') status?: string,
  ) {
    return this.service.findAll(user, { customer_name, contract_no, status });
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

  // ===== 附件管理 =====

  @Post(':id/attachments')
  @Permissions('contract:edit')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 20 * 1024 * 1024 } }))
  uploadAttachment(
    @Param('id') id: number,
    @UploadedFile() file: any,
    @CurrentUser() user: any,
  ) {
    return this.service.uploadAttachment(id, file, user.id);
  }

  @Get(':id/attachments')
  @Permissions('contract:view')
  getAttachments(@Param('id') id: number) {
    return this.service.getAttachments(id);
  }

  @Get('attachments/:attachmentId/download')
  @Permissions('contract:view')
  async downloadAttachment(
    @Param('attachmentId') attachmentId: number,
    @Res() res: any,
  ) {
    const result = await this.service.getAttachmentFile(attachmentId);
    res.setHeader('Content-Type', result.mime);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(result.name)}"`);
    res.send(result.file);
  }

  @Delete('attachments/:attachmentId')
  @Permissions('contract:edit')
  deleteAttachment(
    @Param('attachmentId') attachmentId: number,
    @CurrentUser() user: any,
  ) {
    return this.service.deleteAttachment(attachmentId, user.id);
  }
}
