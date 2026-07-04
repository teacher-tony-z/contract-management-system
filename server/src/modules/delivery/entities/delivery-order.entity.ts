import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToMany } from 'typeorm';
import { DeliveryItem } from './delivery-item.entity';

@Entity('delivery_orders')
export class DeliveryOrder {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  contract_id: number;

  @Column({ length: 20, default: 'pending' })
  status: string; // pending/shipped/installed/delivered

  @Column({ length: 100, nullable: true })
  logistics_company: string;

  @Column({ length: 100, nullable: true })
  tracking_no: string;

  @Column({ nullable: true })
  shipped_at: Date;

  @Column({ nullable: true })
  shipped_by: number;

  @CreateDateColumn()
  createdAt: Date;

  @OneToMany(() => DeliveryItem, di => di.delivery, { cascade: true })
  items: DeliveryItem[];
}
