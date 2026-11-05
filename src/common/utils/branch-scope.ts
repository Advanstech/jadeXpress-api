/**
 * Roles that may operate across branches (switch the active branch, assign staff
 * to any branch, view network-wide data). Every other role is locked to the
 * single branch (`staff_profile.store_id`) they are assigned to.
 */
export const CROSS_BRANCH_ROLES: ReadonlySet<string> = new Set([
  'owner',
  'manager',
  'root',
  'super_admin',
]);

export function isCrossBranchRole(role?: string | null): boolean {
  return CROSS_BRANCH_ROLES.has((role || '').toLowerCase());
}

