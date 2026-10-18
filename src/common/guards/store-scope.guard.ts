import { CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { eq } from 'drizzle-orm';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { DRIZZLE, DrizzleDB } from '../../database/database.module';
import { stores } from '../../database/schema';
import type { JwtPayload } from '../decorators/current-user.decorator';

const CROSS_BRANCH_ROLES = new Set(['owner', 'root', 'super_admin']);

@Injectable()
export class StoreScopeGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<{ headers: Record<string, string | string[] | undefined>; user?: JwtPayload }>();
    const user = request.user;
    if (!user || user.type === 'customer') return true;

    const header = request.headers['x-store-id'];
    const requestedStoreId = Array.isArray(header) ? header[0] : header;
    if (!requestedStoreId || requestedStoreId === user.storeId) return true;

    if (!CROSS_BRANCH_ROLES.has((user.role || '').toLowerCase())) {
      throw new ForbiddenException('Your role cannot switch to another branch');
    }

    const [store] = await this.db
      .select({ id: stores.id, status: stores.status })
      .from(stores)
      .where(eq(stores.id, requestedStoreId))
      .limit(1);

    if (!store) throw new NotFoundException('Selected branch not found');
    if (store.status !== 'active') throw new ForbiddenException('Selected branch is not active');

    (request as typeof request & { effectiveStoreId?: string }).effectiveStoreId = store.id;
    return true;
  }
}
