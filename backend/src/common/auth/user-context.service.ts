import { Injectable, Scope, Inject } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';

@Injectable({ scope: Scope.REQUEST })
export class UserContext {
  constructor(@Inject(REQUEST) private readonly request: Request) {}

  get userId(): string {
    // In tests, supply x-user-id header. In prod, replace with JWT.
    const id = (this.request.headers['x-user-id'] as string) || 'anonymous';
    return id;
  }
}