import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { DeliveryOrder } from './delivery-order.entity';

@Entity('delivery_items')
export class DeliveryItem {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => DeliveryOrder, o => o.items)
  @JoinColumn({ name: 'delivery_id' })
  delivery: DeliveryOrder;

  @Column()
  delivery_id: number;

  @Column()
  product_id: number;

  @Column()
  quantity: number;
}
