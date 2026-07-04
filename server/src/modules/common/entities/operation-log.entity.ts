import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('operation_logs')
export class OperationLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  user_id: number;

  @Column({ length: 50, nullable: true })
  username: string;

  @Column({ length: 50, nullable: true })
  role_name: string;

  @Column({ length: 100 })
  action: string;

  @Column({ length: 50 })
  module: string;

  @Column({ length: 50, nullable: true })
  target_type: string;

  @Column({ nullable: true })
  target_id: number;

  @Column({ type: 'text', nullable: true })
  detail: string;

  @Column({ length: 50, nullable: true })
  ip: string;

  @CreateDateColumn()
  createdAt: Date;
}
