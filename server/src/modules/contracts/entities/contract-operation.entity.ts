import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Contract } from './contract.entity';
import { User } from 'src/modules/auth/entities/user.entity';

@Entity('contract_operations')
export class ContractOperation {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Contract, c => c.operations)
  @JoinColumn({ name: 'contract_id' })
  contract: Contract;

  @Column()
  contract_id: number;

  @Column()
  operator_id: number;

  @Column({ length: 50 })
  action: string;

  @Column({ length: 500, nullable: true })
  remark: string;

  @CreateDateColumn()
  createdAt: Date;
}
