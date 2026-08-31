import type { HouseholdRole } from './household';

export type HouseholdArea = 'dashboard' | 'balances' | 'income' | 'expenses' | 'fixedBills' | 'savings' | 'debts' | 'analytics' | 'invoices' | 'members' | 'settings';
export type AccessLevel = 'none' | 'view' | 'editOwn' | 'editAll';
export type HouseholdPermissions = Partial<Record<HouseholdArea, AccessLevel>>;

export const HOUSEHOLD_AREAS: Array<{ id: HouseholdArea; editable?: boolean }> = [
  { id: 'dashboard' }, { id: 'balances' },
  { id: 'income', editable: true }, { id: 'expenses', editable: true },
  { id: 'fixedBills', editable: true }, { id: 'savings', editable: true },
  { id: 'debts', editable: true }, { id: 'analytics' },
  { id: 'invoices', editable: true }, { id: 'members', editable: true }, { id: 'settings', editable: true },
];
const all = (level: AccessLevel): HouseholdPermissions => Object.fromEntries(HOUSEHOLD_AREAS.map(a => [a.id, level]));
export function permissionsFor(role: HouseholdRole, custom?: HouseholdPermissions): HouseholdPermissions {
  if (role === 'owner' || role === 'editor') return all('editAll');
  if (role === 'viewer') return all('view');
  if (role === 'contributor') return { invoices: 'editOwn', expenses: 'editOwn' };
  return custom || {};
}
export function canView(role: HouseholdRole | undefined, area: HouseholdArea, custom?: HouseholdPermissions) {
  const access = role ? permissionsFor(role, custom)[area] || 'none' : 'none'; return access !== 'none';
}
export function canEdit(role: HouseholdRole | undefined, area: HouseholdArea, custom?: HouseholdPermissions, own = false) {
  const access = role ? permissionsFor(role, custom)[area] || 'none' : 'none'; return access === 'editAll' || (own && access === 'editOwn');
}

export const SCREEN_AREA: Partial<Record<string, HouseholdArea>> = {
  overview: 'dashboard', variable: 'expenses', fixed: 'fixedBills', savings: 'savings', debts: 'debts', trends: 'analytics',
};
