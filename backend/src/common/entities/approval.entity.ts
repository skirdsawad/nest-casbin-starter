import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('approvals')
export class Approval {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  requestId: string;

  @Column()
  approverId: string;

  @Column()
  stageCode: string;

  @Column()
  decision: 'approve' | 'reject';

  @CreateDateColumn()
  decidedAt: Date;
}
