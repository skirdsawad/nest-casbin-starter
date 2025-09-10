import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { getDataSourceToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

async function resetDatabase() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const dataSource = app.get<DataSource>(getDataSourceToken());

  if (dataSource.options.type !== 'postgres') {
    console.error('This script is intended for PostgreSQL databases only.');
    await app.close();
    return;
  }

  console.log('Dropping all tables from the public schema...');
  await dataSource.query(`
    DO $$ DECLARE
        r RECORD;
    BEGIN
        FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
            EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.tablename) || ' CASCADE';
        END LOOP;
    END $$;
  `);
  console.log('Tables dropped successfully.');

  console.log('Synchronizing database schema...');
  await dataSource.synchronize();
  console.log('Schema synchronized.');

  await app.close();
}

resetDatabase().catch((err) => {
  console.error('Error resetting database:', err);
  process.exit(1);
});
