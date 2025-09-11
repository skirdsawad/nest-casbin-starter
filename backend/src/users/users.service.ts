import { Injectable, ConflictException, Inject, BadRequestException } from '@nestjs/common';
import { UsersRepository } from './users.repository';
import { User } from './user.entity';
import { CasbinService } from '../common/casbin/casbin.service';
import { UserRoleDto } from './user-role.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { DepartmentsRepository } from '../departments/departments.repository';
import { Enforcer } from 'casbin';

@Injectable()
export class UsersService {
  constructor(
    private readonly repository: UsersRepository,
    private readonly casbinService: CasbinService,
    private readonly departmentsRepository: DepartmentsRepository,
    @Inject('CASBIN_ENFORCER') private readonly enforcer: Enforcer,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    const existingUser = await this.repository.findByEmail(createUserDto.email);
    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Validate department exists
    const department = await this.departmentsRepository.findByCode(createUserDto.department);
    if (!department) {
      throw new BadRequestException(`Department '${createUserDto.department}' does not exist`);
    }

    // Create user (only store core user data, not role/department)
    const newUser = await this.repository.create({
      displayName: createUserDto.displayName,
      email: createUserDto.email,
    });

    // Assign primary role in Casbin
    await this.enforcer.addRoleForUser(newUser.id, createUserDto.role, createUserDto.department);

    // Assign special cross-department roles for AF and CG users
    if (createUserDto.department === 'AF') {
      await this.enforcer.addRoleForUser(newUser.id, 'AF_APPROVER', '*');
    }
    if (createUserDto.department === 'CG') {
      await this.enforcer.addRoleForUser(newUser.id, 'CG_APPROVER', '*');
    }

    // Save Casbin policy changes
    await this.enforcer.savePolicy();

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
