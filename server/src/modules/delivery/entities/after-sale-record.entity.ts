import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('after_sale_records')
export class AfterSaleRecord {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  contract_id: number;

  @Column()
  test_date: Date;

  @Column({ length: 255 })
  test_result: string;

  @Column()
  tester_id: number;

  @Column({ length: 500, nullable: true })
  remark: string;

  @CreateDateColumn()
  createdAt: Date;
}
