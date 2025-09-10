import { Injectable } from '@nestjs/common';
import { RequestEntity } from '../common/models/domain';

@Injectable()
export class RequestsRepository {
  private _id = 1;
  private readonly REQS: RequestEntity[] = [];

  create(data: Omit<RequestEntity, 'id' | 'createdAt' | 'updatedAt'>): RequestEntity {
    const now = new Date();
    const r: RequestEntity = { id: this._id++, createdAt: now, updatedAt: now, ...data };
    this.REQS.push(r);
    return r;
  }

  update(id: number, patch: Partial<RequestEntity>): RequestEntity {
    const r = this.REQS.find((x) => x.id === id);
    if (!r) throw new Error('NotFound');
    Object.assign(r, patch, { updatedAt: new Date() });
    return r;
  }

  findById(id: number): RequestEntity | undefined {
    return this.REQS.find((x) => x.id === id);
  }

  findByDepartmentId(deptId: number): RequestEntity[] {
    return this.REQS.filter((x) => x.departmentId == deptId);
  }

  findAll(): RequestEntity[] {
    return this.REQS;
  }
}