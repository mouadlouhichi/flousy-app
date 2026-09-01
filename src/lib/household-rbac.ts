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

/**
 * Single source of truth for "what may this member do in this area".
 * `canView`/`canEdit` below are thin wrappers — every UI gate must ultimately
 * resolve through here so a new surface cannot drift away from the matrix.
 */
export function accessLevel(role: HouseholdRole | undefined, area: HouseholdArea, custom?: HouseholdPermissions): AccessLevel {
  if (role === 'owner') return 'editAll';
  if (!role) return 'none';
  return permissionsFor(role, custom)[area] || 'none';
}

export function canView(role: HouseholdRole | undefined, area: HouseholdArea, custom?: HouseholdPermissions) {
  return accessLevel(role, area, custom) !== 'none';
}
export function canEdit(role: HouseholdRole | undefined, area: HouseholdArea, custom?: HouseholdPermissions, own = false) {
  const level = accessLevel(role, area, custom);
  return level === 'editAll' || (own && level === 'editOwn');
}

/**
 * Dashboard screens and the RBAC area that owns them. A screen whose area is
 * `'none'` for a member must render the "private" placeholder instead of the
 * real content — never a redacted-looking shell that still leaks totals.
 *
 * The profile hub is deliberately absent: it also holds the member's OWN
 * account/preferences, which no household role may take away. Individual
 * entries inside it are gated through `TOOL_AREA` instead.
 */
export const SCREEN_AREA: Partial<Record<string, HouseholdArea>> = {
  overview: 'dashboard', variable: 'expenses', fixed: 'fixedBills', savings: 'savings',
  debts: 'debts', trends: 'analytics', courses: 'expenses',
};

/** Entry points that are not screens (sidebar quick tools, profile hub links). */
export const TOOL_AREA = {
  incomeSources: 'income',
  household: 'members',
  settings: 'settings',
  invoices: 'invoices',
} satisfies Record<string, HouseholdArea>;

/**
 * Every money figure in the UI belongs to exactly one area. Use these to keep
 * a card's visibility and its edit affordance in agreement — showing a value
 * while offering an edit button the member may not use (or vice versa) is the
 * bug class this mapping exists to prevent.
 */
export const AMOUNT_AREA = {
  totalBudget: 'balances',
  totalCashOnHand: 'balances',
  moneyPlace: 'balances',
  incomeSource: 'income',
  variableExpense: 'expenses',
  fixedBill: 'fixedBills',
  savingsGoal: 'savings',
  debt: 'debts',
} satisfies Record<string, HouseholdArea>;

/**
 * Resolves every gate a member's UI renders from.
 *
 * `household-context` calls this and nothing else, so the booleans handed to
 * each screen are derived here — in a pure function that tests can run without
 * Firebase, React or a browser.
 */
export interface AreaAccess {
  level: (area: HouseholdArea) => AccessLevel;
  canView: (area: HouseholdArea) => boolean;
  canEdit: (area: HouseholdArea, own?: boolean) => boolean;
  exportSections: ExportSections;
}

export function resolveAreaAccess(input: {
  /** True in the personal workspace, or for the household's owner. */
  unrestricted: boolean;
  role: HouseholdRole | undefined;
  permissions: HouseholdPermissions | undefined;
}): AreaAccess {
  const { unrestricted, role, permissions } = input;
  const level = (area: HouseholdArea): AccessLevel =>
    unrestricted ? 'editAll' : accessLevel(role, area, permissions);
  return {
    level,
    canView: (area) => level(area) !== 'none',
    canEdit: (area, own = false) => {
      const value = level(area);
      return value === 'editAll' || (own && value === 'editOwn');
    },
    exportSections: unrestricted ? ALL_EXPORT_SECTIONS : exportSectionsFor(role, permissions),
  };
}

/** Sections of the CSV export, each owned by one area. */
export type ExportSection = 'balances' | 'fixedBills' | 'expenses' | 'savings';
export type ExportSections = Record<ExportSection, boolean>;
export const EXPORT_SECTION_AREA: Record<ExportSection, HouseholdArea> = {
  balances: 'balances',
  fixedBills: 'fixedBills',
  expenses: 'expenses',
  savings: 'savings',
};
export const ALL_EXPORT_SECTIONS: ExportSections = { balances: true, fixedBills: true, expenses: true, savings: true };

/**
 * Which CSV sections a member may download. The export is the one place a
 * hidden figure can escape the app, so it is filtered rather than all-or-nothing.
 */
export function exportSectionsFor(role: HouseholdRole | undefined, custom?: HouseholdPermissions): ExportSections {
  return {
    balances: canView(role, 'balances', custom),
    fixedBills: canView(role, 'fixedBills', custom),
    expenses: canView(role, 'expenses', custom),
    savings: canView(role, 'savings', custom),
  };
}

/** True when at least one section survives — otherwise hide the export itself. */
export function canExportAnything(sections: ExportSections): boolean {
  return Object.values(sections).some(Boolean);
}

/** The mobile quick-action ids and the area each one writes to. */
export const QUICK_ACTION_AREA: Record<'expense' | 'charge' | 'savings' | 'courses', HouseholdArea> = {
  expense: 'expenses',
  charge: 'fixedBills',
  savings: 'savings',
  courses: 'expenses',
};
