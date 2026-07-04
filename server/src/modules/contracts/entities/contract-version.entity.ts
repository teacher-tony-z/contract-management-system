import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { Contract } from './contract.entity';
import { User } from 'src/modules/auth/entities/user.entity';

@Entity('contract_versions')
export class ContractVersion {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  original_id: number;

  @Column()
  new_id: number;

  @Column({ length: 500, nullable: true })
  change_reason: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'changed_by' })
  changedBy: User;

  @Column()
  changed_by: number;

  @CreateDateColumn()
  createdAt: Date;
}
