
import { IsArray, IsIn, IsUUID } from 'class-validator';

export class BulkActionDto {
  @IsArray()
  @IsUUID('all', { each: true })
  ids: string[];

  @IsIn(['approve', 'reject'])
  action: 'approve' | 'reject';
}
