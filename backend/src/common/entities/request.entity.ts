import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('requests')
export class RequestEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  departmentId: string;

  @Column()
  createdBy: string;

  @Column()
  status: string;

  @Column()
  stageCode: string;

  @Column({ type: 'jsonb' })
  payload: any;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
