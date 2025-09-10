import { Module } from '@nestjs/common';
import { RulesService } from './rules.service';
import { RulesRepository } from './rules.repository';

@Module({
  providers: [RulesService, RulesRepository],
  exports: [RulesService],
})
export class RulesModule {}