import { Module, Global, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { Pool } from '@neondatabase/serverless';
import * as schema from './schema';

export const DRIZZLE = Symbol('DRIZZLE');

export type DrizzleDB = ReturnType<typeof drizzle<typeof schema>>;

@Global()
@Module({
  providers: [
    {
      provide: DRIZZLE,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const url = config.getOrThrow<string>('database.url');
        const pool = new Pool({ connectionString: url });
        return drizzle(pool, { schema });
      },
    },
  ],
  exports: [DRIZZLE],
})
export class DatabaseModule {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async onModuleDestroy() {
    await this.db.$client.end();
  }
}
