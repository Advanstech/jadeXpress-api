import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { StoreScopeGuard } from './store-scope.guard';

function context(request: any): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

function database(store: { id: string; status: string } | undefined) {
  const limit = vi.fn().mockResolvedValue(store ? [store] : []);
  const where = vi.fn().mockReturnValue({ limit });
  const from = vi.fn().mockReturnValue({ where });
  const select = vi.fn().mockReturnValue({ from });
  return { select } as any;
}

describe('StoreScopeGuard', () => {
  const reflector = { getAllAndOverride: vi.fn().mockReturnValue(false) } as any;

  it('keeps the JWT home branch when no switch header is sent', async () => {
    const request = { headers: {}, user: { sub: 'staff', role: 'cashier', storeId: 'home' } };
    const guard = new StoreScopeGuard(reflector, database(undefined));
    await expect(guard.canActivate(context(request))).resolves.toBe(true);
    expect((request as any).effectiveStoreId).toBeUndefined();
  });

  it('lets an owner switch to an active branch', async () => {
    const request = { headers: { 'x-store-id': 'branch-b' }, user: { sub: 'owner', role: 'owner', storeId: 'home' } };
    const guard = new StoreScopeGuard(reflector, database({ id: 'branch-b', status: 'active' }));
    await expect(guard.canActivate(context(request))).resolves.toBe(true);
    expect((request as any).effectiveStoreId).toBe('branch-b');
  });

  it('blocks floor staff from switching branches', async () => {
    const request = { headers: { 'x-store-id': 'branch-b' }, user: { sub: 'cashier', role: 'cashier', storeId: 'home' } };
    const guard = new StoreScopeGuard(reflector, database({ id: 'branch-b', status: 'active' }));
    await expect(guard.canActivate(context(request))).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('blocks switching to an inactive branch', async () => {
    const request = { headers: { 'x-store-id': 'branch-b' }, user: { sub: 'owner', role: 'owner', storeId: 'home' } };
    const guard = new StoreScopeGuard(reflector, database({ id: 'branch-b', status: 'coming_soon' }));
    await expect(guard.canActivate(context(request))).rejects.toBeInstanceOf(ForbiddenException);
  });
});
