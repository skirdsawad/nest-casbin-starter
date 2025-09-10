import { Injectable, ConflictException } from '@nestjs/common';
import { UsersRepository } from './users.repository';
import { User } from './user.entity';
import { CasbinService } from '../common/casbin/casbin.service';
import { UserRoleDto } from './user-role.dto';
import { CreateUserDto } from './dto/create-user.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly repository: UsersRepository,
    private readonly casbinService: CasbinService,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    const existingUser = await this.repository.findByEmail(createUserDto.email);
    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }
    const newUser = await this.repository.create(createUserDto);

    // New users will have no roles by default. They must be assigned manually.

    return newUser;
  }

  findByEmail(email: string): Promise<User | null> {
    return this.repository.findByEmail(email);
  }

  async findAll(): Promise<UserRoleDto[]> {
    const users = await this.repository.findAll();
    const usersWithRoles: UserRoleDto[] = [];

    for (const user of users) {
      const roles = await this.casbinService.getRolesForUser(user.id);
      usersWithRoles.push({
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        roles: roles.map(([role, department]) => ({ role, department })),
      });
    }

    return usersWithRoles;
  }
}
