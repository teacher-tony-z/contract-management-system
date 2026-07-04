import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContractsController } from './contracts.controller';
import { ContractsService } from './contracts.service';
import { Contract } from './entities/contract.entity';
import { ContractItem } from './entities/contract-item.entity';
import { ContractAttachment } from './entities/contract-attachment.entity';
import { ContractVersion } from './entities/contract-version.entity';
import { ContractOperation } from './entities/contract-operation.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Contract, ContractItem, ContractAttachment, ContractVersion, ContractOperation])],
  controllers: [ContractsController],
  providers: [ContractsService],
  exports: [ContractsService],
})
export class ContractsModule {}
