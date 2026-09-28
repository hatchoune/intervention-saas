import type { OrganizationRole } from '@/types/database';

/**
 * Capability matrix.
 *
 * The database RLS policies enforce the same rules (see docs/SECURITY.md), so
 * this module is about UX: hiding what the current user cannot do instead of
 * letting them hit a permission error.
 */

export type Capability =
  | 'organization.edit'
  | 'team.manage'
  | 'customers.manage'
  | 'technicians.manage'
  | 'interventions.manage'
  | 'interventions.update_assigned'
  | 'quotes.manage'
  | 'invoices.manage'
  | 'reports.view';

const CAPABILITY_ROLES: Record<Capability, OrganizationRole[]> = {
  'organization.edit': ['admin'],
  'team.manage': ['admin'],
  'customers.manage': ['admin', 'manager'],
  'technicians.manage': ['admin', 'manager'],
  'interventions.manage': ['admin', 'manager'],
  'interventions.update_assigned': ['admin', 'manager', 'technician'],
  'quotes.manage': ['admin', 'manager'],
  'invoices.manage': ['admin', 'manager'],
  'reports.view': ['admin', 'manager'],
};

export function can(capability: Capability, role: OrganizationRole | null | undefined): boolean {
  if (!role) return false;
  return CAPABILITY_ROLES[capability].includes(role);
}

export function isAdmin(role: OrganizationRole | null | undefined): boolean {
  return role === 'admin';
}

export function isTechnician(role: OrganizationRole | null | undefined): boolean {
  return role === 'technician';
}

/**
 * Technicians may update an intervention only when they are the assignee; the
 * RLS policy `interventions_update_staff` implements the same rule.
 */
export function canEditIntervention(
  role: OrganizationRole | null | undefined,
  options: { assignedTechnicianUserId: string | null; userId: string },
): boolean {
  if (can('interventions.manage', role)) return true;
  return options.assignedTechnicianUserId === options.userId;
}

/** Landing page per role, used after sign-in and by the sidebar. */
export function defaultRouteFor(role: OrganizationRole | null | undefined): string {
  return role === 'technician' ? '/planning/my-day' : '/dashboard';
}
