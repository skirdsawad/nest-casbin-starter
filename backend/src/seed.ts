import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Enforcer } from 'casbin';
import { seedPolicies } from './common/casbin/policy.seed';
import { DepartmentsRepository } from './departments/departments.repository';
import { RulesRepository } from './rules/rules.repository';
import { UsersRepository } from './users/users.repository';
import { RequestsRepository } from './requests/requests.repository';
import { ApprovalsRepository } from './approvals/approvals.repository';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);

  console.log('Seeding users...');
  const usersRepository = app.get(UsersRepository);
  const users = await usersRepository.seed();

  console.log('Seeding departments...');
  const departmentsRepository = app.get(DepartmentsRepository);
  const departments = await departmentsRepository.seed();

  console.log('Seeding rules...');
  const rulesRepository = app.get(RulesRepository);
  await rulesRepository.seed(departments);

  console.log('Seeding casbin policies...');
  const enforcer = app.get<Enforcer>('CASBIN_ENFORCER');
  await enforcer.clearPolicy();
  await seedPolicies(enforcer, users);

  console.log('Seeding requests...');
  const requestsRepository = app.get(RequestsRepository);
  const requests = await requestsRepository.seed(users, departments);

  console.log('Seeding approvals...');
  const approvalsRepository = app.get(ApprovalsRepository);
  await approvalsRepository.seed(requests, users);

  await app.close();
  console.log('Seeding complete.');
}

bootstrap();
