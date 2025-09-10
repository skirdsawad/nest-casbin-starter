import { Injectable } from '@nestjs/common';
import { UsersRepository } from './users.repository';
import { User } from './user.entity';

@Injectable()
export class UsersService {
  constructor(private readonly repository: UsersRepository) {}

  findByEmail(email: string): Promise<User | null> {
    return this.repository.findByEmail(email);
  }
}
