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

  async seed(): Promise<User[]> {
    const usersData = [
      { email: 'user_hd_a@example.com', displayName: 'HD User A' },
      { email: 'user_hd_b@example.com', displayName: 'HD User B' },
      { email: 'user_amd_1@example.com', displayName: 'AMD User 1' },
      { email: 'user_af_1@example.com', displayName: 'AF User 1' },
      { email: 'user_cg_1@example.com', displayName: 'CG User 1' },
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
