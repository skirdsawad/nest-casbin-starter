import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';
import { RoleCode } from '../models/domain';

@Entity('approval_rules')
export class ApprovalRule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  departmentId: string;

  @Column()
  stageCode: string;

  @Column()
  minApprovers: number;

  @Column({ nullable: true })
  fallbackRole?: RoleCode;
}
