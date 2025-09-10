import { IsIn } from 'class-validator';

export class ApproveDto {
  @IsIn(['approve', 'reject'])
  decision: 'approve' | 'reject';
}