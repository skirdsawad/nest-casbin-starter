import { TypeOrmModuleOptions } from '@nestjs/typeorm';

export const casbinOrmConfig: TypeOrmModuleOptions = {
  type: 'postgres',
  url: 'postgresql://localhost:5432/nest-casbin-poc',
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  synchronize: true,
};
