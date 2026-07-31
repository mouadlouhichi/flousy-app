import type { HouseholdRole } from './household';

export type HouseholdArea = 'dashboard' | 'balances' | 'income' | 'expenses' | 'fixedBills' | 'savings' | 'debts' | 'analytics' | 'invoices' | 'members' | 'settings';
export type AccessLevel = 'none' | 'view' | 'editOwn' | 'editAll';
export type HouseholdPermissions = Partial<Record<HouseholdArea, AccessLevel>>;

export const HOUSEHOLD_AREAS: Array<{ id: HouseholdArea; label: string; editable?: boolean }> = [
  { id: 'dashboard', label: 'Dashboard summary' }, { id: 'balances', label: 'Balances' },
  { id: 'income', label: 'Income', editable: true }, { id: 'expenses', label: 'Variable expenses', editable: true },
  { id: 'fixedBills', label: 'Fixed bills', editable: true }, { id: 'savings', label: 'Savings', editable: true },
  { id: 'debts', label: 'Debts', editable: true }, { id: 'analytics', label: 'Analytics' },
  { id: 'invoices', label: 'Invoices', editable: true }, { id: 'members', label: 'Members', editable: true }, { id: 'settings', label: 'Household settings', editable: true },
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
