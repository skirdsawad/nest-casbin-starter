import { Module, Global } from '@nestjs/common';
import { newEnforcer, newModelFromString, StringAdapter, Enforcer } from 'casbin';
import { readFileSync } from 'fs';
import { join } from 'path';
import { POLICY_CSV, GROUPING_CSV } from './policy.seed';
import { CasbinService } from './casbin.service';

@Global()
@Module({
  providers: [
    {
      provide: 'CASBIN_ENFORCER',
      useFactory: async (): Promise<Enforcer> => {
        const modelStr = readFileSync(join(__dirname, 'model.conf'), 'utf-8');
        const model = await newModelFromString(modelStr);
        const adapter = new StringAdapter(POLICY_CSV + '\n' + GROUPING_CSV);
        const enf = await newEnforcer(model, adapter);
        await enf.loadPolicy();
        return enf;
      },
    },
    CasbinService,
  ],
  exports: ['CASBIN_ENFORCER', CasbinService],
})
export class CasbinModule {}