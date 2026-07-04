import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Product } from 'src/modules/products/entities/product.entity';
import { User } from 'src/modules/auth/entities/user.entity';

@Entity('inventory_log')
export class InventoryLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  product_id: number;

  @Column({ length: 20 })
  change_type: string; // inbound/outbound/produce/terminate

  @Column()
  quantity_before: number;

  @Column()
  quantity_change: number;

  @Column()
  quantity_after: number;

  @Column({ length: 20, nullable: true })
  reference_type: string;

  @Column({ nullable: true })
  reference_id: number;

  @Column()
  operator_id: number;

  @CreateDateColumn()
  createdAt: Date;
}
