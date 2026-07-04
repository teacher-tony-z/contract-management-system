import { Entity, PrimaryGeneratedColumn, Column, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Product } from 'src/modules/products/entities/product.entity';

@Entity('inventory')
export class Inventory {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Product)
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @Column()
  product_id: number;

  @Column({ default: 0 })
  quantity: number;

  @Column({ length: 100, nullable: true })
  location: string;

  @UpdateDateColumn()
  updatedAt: Date;
}
