import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Contract } from './entities/contract.entity';
import { ContractItem } from './entities/contract-item.entity';
import { ContractAttachment } from './entities/contract-attachment.entity';
import { ContractVersion } from './entities/contract-version.entity';
import { ContractOperation } from './entities/contract-operation.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Contract, ContractItem, ContractAttachment, ContractVersion, ContractOperation])],
  exports: [TypeOrmModule],
})
export class ContractsModule {}
