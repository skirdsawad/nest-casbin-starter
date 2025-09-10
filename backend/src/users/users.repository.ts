import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';

@Injectable()
export class UsersRepository {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOneBy({ email });
  }

  findAll(): Promise<User[]> {
    return this.usersRepository.find();
  }

  create(user: Partial<User>): Promise<User> {
    const newUser = this.usersRepository.create(user);
    return this.usersRepository.save(newUser);
  }

  async seed(): Promise<User[]> {
    const usersData = [
      // Department Heads
      { email: 'hr.head@example.com', displayName: 'HR Head' },
      { email: 'mkt.head@example.com', displayName: 'Marketing Head' },
      { email: 'it.head@example.com', displayName: 'IT Head' },
      { email: 'sp.head@example.com', displayName: 'Strategic Planning Head' },
      // Department Staff (creators/editors)
      { email: 'hr.user@example.com', displayName: 'HR User' },
      { email: 'mkt.user@example.com', displayName: 'Marketing User' },
      { email: 'it.user@example.com', displayName: 'IT User' },
      { email: 'af.user@example.com', displayName: 'AF User' },
      // Global Roles
      { email: 'amd.user@example.com', displayName: 'AMD User' },
      { email: 'cg.user@example.com', displayName: 'CG User' },
    ];

    const seededUsers: User[] = [];
    for (const userData of usersData) {
      let user = await this.findByEmail(userData.email);
      if (!user) {
        user = await this.usersRepository.save(userData);
      }
      seededUsers.push(user);
    }
    return seededUsers;
  }
}
