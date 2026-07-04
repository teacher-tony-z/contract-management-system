import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { ProductionOrder } from './production-order.entity';
import { Product } from 'src/modules/products/entities/product.entity';

@Entity('production_items')
export class ProductionItem {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => ProductionOrder, o => o.items)
  @JoinColumn({ name: 'order_id' })
  order: ProductionOrder;

  @Column()
  order_id: number;

  @ManyToOne(() => Product)
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @Column()
  product_id: number;

  @Column()
  quantity: number;

  @Column({ length: 20, default: 'pending' })
  qc_status: string; // pending/pass/reject

  @Column({ nullable: true })
  qc_operator_id: number;

  @Column({ nullable: true })
  qc_at: Date;

  @Column({ length: 500, nullable: true })
  qc_remark: string;
}
