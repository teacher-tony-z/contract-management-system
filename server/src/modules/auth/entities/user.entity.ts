import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn,
  OneToMany
} from 'typeorm';
import { UserRole } from 'src/modules/roles/entities/user-role.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 50, unique: true })
  username: string;

  @Column()
  password_hash: string;

  @Column({ length: 50 })
  real_name: string;

  @Column({ length: 20, nullable: true })
  phone: string;

  @Column({ default: 1 })
  status: number; // 1=启用 0=禁用

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => UserRole, ur => ur.user)
  userRoles: UserRole[];
}
