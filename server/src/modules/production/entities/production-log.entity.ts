import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('production_log')
export class ProductionLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  order_id: number;

  @Column({ length: 50 })
  action: string;

  @Column()
  operator_id: number;

  @Column({ length: 500, nullable: true })
  remark: string;

  @CreateDateColumn()
  createdAt: Date;
}
