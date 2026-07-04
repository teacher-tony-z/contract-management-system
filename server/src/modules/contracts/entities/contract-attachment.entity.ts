import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Contract } from './contract.entity';
import { User } from 'src/modules/auth/entities/user.entity';

@Entity('contract_attachments')
export class ContractAttachment {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Contract, c => c.attachments)
  @JoinColumn({ name: 'contract_id' })
  contract: Contract;

  @Column()
  contract_id: number;

  @Column()
  file_name: string;

  @Column()
  file_path: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'uploader_id' })
  uploader: User;

  @Column()
  uploader_id: number;

  @CreateDateColumn()
  createdAt: Date;
}
