import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('permissions')
export class Permission {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 100, unique: true })
  code: string; // e.g. 'contract:audit'

  @Column({ length: 100 })
  name: string;

  @Column({ length: 50 })
  module: string; // e.g. 'contract'

  @CreateDateColumn()
  createdAt: Date;
}
