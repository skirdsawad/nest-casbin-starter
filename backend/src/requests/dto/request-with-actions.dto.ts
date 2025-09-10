import { RequestEntity } from '../../common/entities/request.entity';

export class RequestWithActionsDto extends RequestEntity {
  permittedActions: string[];
}
