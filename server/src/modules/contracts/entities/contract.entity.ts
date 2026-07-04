import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn,
  ManyToOne, JoinColumn, OneToMany
} from 'typeorm';
import { User } from 'src/modules/auth/entities/user.entity';
import { ContractItem } from './contract-item.entity';
import { ContractAttachment } from './contract-attachment.entity';
import { ContractOperation } from './contract-operation.entity';

@Entity('contracts')
export class Contract {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 50, unique: true })
  contract_no: string;

  @Column({ length: 200 })
  customer_name: string;

  @Column({ length: 20, nullable: true })
  customer_phone: string;

  @Column({ length: 500, nullable: true })
  customer_address: string;

  @Column({ length: 20, default: 'draft' })
  status: string; // draft/pending/approved/returned/production/shipped/installing/delivered/cancelled

  @ManyToOne(() => User)
  @JoinColumn({ name: 'submitter_id' })
  submitter: User;

  @Column({ nullable: true })
  submitter_id: number;

  @Column({ nullable: true })
  submit_at: Date;

  @Column({ nullable: true })
  reviewer_id: number;

  @Column({ nullable: true })
  review_at: Date;

  @Column({ length: 500, nullable: true })
  review_remark: string;

  @Column({ nullable: true })
  delivery_at: Date;

  @Column({ nullable: true })
  after_sale_at: Date;

  @Column({ nullable: true })
  delivered_by: number;

  @Column({ default: true })
  is_latest: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => ContractItem, ci => ci.contract, { cascade: true })
  items: ContractItem[];

  @OneToMany(() => ContractAttachment, ca => ca.contract, { cascade: true })
  attachments: ContractAttachment[];

  @OneToMany(() => ContractOperation, co => co.contract, { cascade: true })
  operations: ContractOperation[];
}
