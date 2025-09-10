
import { IsArray, IsIn } from 'class-validator';

export class BulkActionDto {
  @IsArray()
  ids: number[];

  @IsIn(['approve', 'reject'])
  action: 'approve' | 'reject';
}
