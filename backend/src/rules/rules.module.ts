import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RulesService } from './rules.service';
import { RulesRepository } from './rules.repository';
import { ApprovalRule } from '../common/entities/approval-rule.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ApprovalRule])],
  providers: [RulesService, RulesRepository],
  exports: [RulesService],
})
export class RulesModule {}
