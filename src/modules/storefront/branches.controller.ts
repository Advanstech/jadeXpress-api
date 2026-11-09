import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { eq } from 'drizzle-orm';
import { Inject } from '@nestjs/common';
import { DRIZZLE, DrizzleDB } from '../../database/database.module';
import { stores } from '../../database/schema';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('storefront-branches')
@Controller('storefront/branches')
export class BranchesController {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'List active stores for delivery-branch selection (public)' })
  async list() {
    return this.db
      .select({
        id: stores.id,
        code: stores.code,
        name: stores.name,
        address: stores.address,
        city: stores.city,
        phone: stores.phone,
      })
      .from(stores)
      .where(eq(stores.status, 'active'));
  }
}
