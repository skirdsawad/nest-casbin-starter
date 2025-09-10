import { Module, Global } from '@nestjs/common';
import { newEnforcer, Enforcer } from 'casbin';
import { join } from 'path';
import { TypeOrmAdapter } from 'typeorm-adapter';
import { CasbinService } from './casbin.service';

@Global()
@Module({
  providers: [
    {
      provide: 'CASBIN_ENFORCER',
      useFactory: async (): Promise<Enforcer> => {
        const adapter = await TypeOrmAdapter.newAdapter({
            type: 'postgres',
            url: 'postgresql://localhost:5432/nest-casbin-poc',
        });
        const model = join(__dirname, 'model.conf');
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