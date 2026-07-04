import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Contract } from './contract.entity';
import { Product } from 'src/modules/products/entities/product.entity';

@Entity('contract_items')
export class ContractItem {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Contract, c => c.items)
  @JoinColumn({ name: 'contract_id' })
  contract: Contract;

  @Column()
  contract_id: number;

  @ManyToOne(() => Product)
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @Column()
  product_id: number;

  @Column()
  quantity: number;

  @Column({ length: 255, nullable: true })
  remark: string;
}
