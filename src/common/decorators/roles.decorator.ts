import { SetMetadata } from '@nestjs/common';

export type AppRole = 'root' | 'super_admin' | 'owner' | 'manager' | 'supervisor' | 'cashier' | 'pharmacist' | 'stock_officer';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: AppRole[]) => SetMetadata(ROLES_KEY, roles);
