import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY, AppRole } from '../decorators/roles.decorator';
import { JwtPayload } from '../decorators/current-user.decorator';
import { FastifyRequest } from 'fastify';

// Role hierarchy: root > super_admin > owner > manager > supervisor > cashier
const ROLE_HIERARCHY: Record<AppRole, number> = {
  root: 10,
  super_admin: 9,
  owner: 5,
  manager: 4,
  supervisor: 3,
  pharmacist: 3,
  stock_officer: 2,
  cashier: 1,
};

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<AppRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) return true;

    const req = context.switchToHttp().getRequest<FastifyRequest & { user: JwtPayload }>();
    const user = req.user;

    if (!user) throw new ForbiddenException('Not authenticated');

    // root and super_admin always bypass any @Roles check — full privileges
    const userRole = user.role?.toLowerCase() as AppRole;
    if (userRole === 'root' || userRole === 'super_admin') return true;

    const userLevel = ROLE_HIERARCHY[userRole] ?? 0;
    const minRequired = Math.min(...requiredRoles.map((r) => ROLE_HIERARCHY[r?.toLowerCase() as AppRole] ?? 99));

    if (userLevel < minRequired) {
      throw new ForbiddenException(`Role '${user.role}' is not authorized for this action`);
    }

    return true;
  }
}
