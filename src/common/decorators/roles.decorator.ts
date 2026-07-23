import { SetMetadata } from '@nestjs/common';

export type AppRole = 'owner' | 'manager' | 'supervisor' | 'cashier' | 'pharmacist' | 'stock_officer';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: AppRole[]) => SetMetadata(ROLES_KEY, roles);
