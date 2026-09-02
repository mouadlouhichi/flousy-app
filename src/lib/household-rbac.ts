import type { HouseholdRole } from './household';

export type HouseholdArea = 'dashboard' | 'balances' | 'expenses' | 'savings' | 'debts' | 'invoices' | 'settings' | 'roles';
export type AccessLevel = 'hidden' | 'view' | 'editOwn' | 'editAll';
export type HouseholdPermissions = Record<HouseholdArea, AccessLevel>;

const hiddenPermissions = (): HouseholdPermissions => ({
  dashboard: 'hidden',
  balances: 'hidden',
  expenses: 'hidden',
  savings: 'hidden',
  debts: 'hidden',
  invoices: 'hidden',
  settings: 'hidden',
  roles: 'hidden',
});

/**
 * The shared month is one Firestore document, so field-by-field custom access
 * cannot be enforced safely. Roles intentionally map only to permissions that
 * Security Rules can enforce at document boundaries. Legacy `custom` members
 * are restricted to the contributor invoice workflow until an owner migrates
 * them to editor/viewer/contributor.
 */
export function permissionsFor(
  role: HouseholdRole | undefined,
  _custom?: Partial<HouseholdPermissions>,
): HouseholdPermissions {
  const permissions = hiddenPermissions();
  if (role === 'owner') {
    for (const area of Object.keys(permissions) as HouseholdArea[]) permissions[area] = 'editAll';
    return permissions;
  }
  if (role === 'editor') {
    for (const area of Object.keys(permissions) as HouseholdArea[]) {
      permissions[area] = area === 'roles' ? 'view' : 'editAll';
    }
    return permissions;
  }
  if (role === 'viewer') {
    for (const area of Object.keys(permissions) as HouseholdArea[]) {
      permissions[area] = area === 'settings' || area === 'roles' ? 'hidden' : 'view';
    }
    return permissions;
  }
  if (role === 'contributor' || role === 'custom') {
    permissions.invoices = 'editOwn';
    return permissions;
  }
  return permissions;
}

export function canView(
  role: HouseholdRole | undefined,
  area: HouseholdArea,
  custom?: Partial<HouseholdPermissions>,
): boolean {
  return permissionsFor(role, custom)[area] !== 'hidden';
}

export function canEdit(
  role: HouseholdRole | undefined,
  area: HouseholdArea,
  custom?: Partial<HouseholdPermissions>,
  own = false,
): boolean {
  const level = permissionsFor(role, custom)[area];
  return level === 'editAll' || (level === 'editOwn' && own);
}
