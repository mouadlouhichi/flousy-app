import type { HouseholdRole } from './household';

export type HouseholdArea =
  | 'dashboard'
  | 'balances'
  | 'income'
  | 'expenses'
  | 'fixedBills'
  | 'savings'
  | 'debts'
  | 'analytics'
  | 'invoices'
  | 'members'
  | 'settings';
export type AccessLevel = 'none' | 'view' | 'editOwn' | 'editAll';

/**
 * Retained only to read legacy member documents. A monolithic month document
 * cannot safely enforce field-by-field custom grants in Firestore Rules, so
 * authorization never trusts this client-authored map.
 */
export type HouseholdPermissions = Partial<Record<HouseholdArea, AccessLevel>>;

export const HOUSEHOLD_AREAS: Array<{ id: HouseholdArea; editable?: boolean }> = [
  { id: 'dashboard' },
  { id: 'balances' },
  { id: 'income', editable: true },
  { id: 'expenses', editable: true },
  { id: 'fixedBills', editable: true },
  { id: 'savings', editable: true },
  { id: 'debts', editable: true },
  { id: 'analytics' },
  { id: 'invoices', editable: true },
  { id: 'members', editable: true },
  { id: 'settings', editable: true },
];

const none = (): Record<HouseholdArea, AccessLevel> => ({
  dashboard: 'none',
  balances: 'none',
  income: 'none',
  expenses: 'none',
  fixedBills: 'none',
  savings: 'none',
  debts: 'none',
  analytics: 'none',
  invoices: 'none',
  members: 'none',
  settings: 'none',
});

const all = (level: AccessLevel): Record<HouseholdArea, AccessLevel> =>
  Object.fromEntries(HOUSEHOLD_AREAS.map((area) => [area.id, level])) as Record<HouseholdArea, AccessLevel>;

/**
 * Role permissions deliberately mirror `firestore.rules` document boundaries.
 * Legacy `custom` members are treated as contributors until an owner migrates
 * them to a standard role; their stored permission map is never authoritative.
 */
export function permissionsFor(
  role: HouseholdRole | undefined,
  _legacyCustom?: HouseholdPermissions,
): Record<HouseholdArea, AccessLevel> {
  if (role === 'owner') return all('editAll');
  if (role === 'editor') {
    return {
      ...all('editAll'),
      members: 'view',
      settings: 'view',
    };
  }
  if (role === 'viewer') {
    return {
      ...all('view'),
      invoices: 'none',
    };
  }
  if (role === 'contributor' || role === 'custom') {
    return {
      ...none(),
      invoices: 'editOwn',
    };
  }
  return none();
}

export function accessLevel(
  role: HouseholdRole | undefined,
  area: HouseholdArea,
  legacyCustom?: HouseholdPermissions,
): AccessLevel {
  return permissionsFor(role, legacyCustom)[area];
}

export function canView(
  role: HouseholdRole | undefined,
  area: HouseholdArea,
  legacyCustom?: HouseholdPermissions,
): boolean {
  return accessLevel(role, area, legacyCustom) !== 'none';
}

export function canEdit(
  role: HouseholdRole | undefined,
  area: HouseholdArea,
  legacyCustom?: HouseholdPermissions,
  own = false,
): boolean {
  const level = accessLevel(role, area, legacyCustom);
  return level === 'editAll' || (own && level === 'editOwn');
}

/** Dashboard screens and the enforceable area that owns each one. */
export const SCREEN_AREA: Partial<Record<string, HouseholdArea>> = {
  overview: 'dashboard',
  variable: 'expenses',
  fixed: 'fixedBills',
  savings: 'savings',
  debts: 'debts',
  trends: 'analytics',
  courses: 'expenses',
};

/** Entry points that are not screens (sidebar quick tools, profile links). */
export const TOOL_AREA = {
  incomeSources: 'income',
  household: 'members',
  settings: 'settings',
  invoices: 'invoices',
} satisfies Record<string, HouseholdArea>;

/** Every rendered money figure resolves through one of these areas. */
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

export interface AreaAccess {
  level: (area: HouseholdArea) => AccessLevel;
  canView: (area: HouseholdArea) => boolean;
  canEdit: (area: HouseholdArea, own?: boolean) => boolean;
  exportSections: ExportSections;
}

/** Single resolver used by every household UI gate. */
export function resolveAreaAccess(input: {
  /** True in a personal workspace, or for the household owner. */
  unrestricted: boolean;
  role: HouseholdRole | undefined;
  /** Legacy only; intentionally ignored by `permissionsFor`. */
  permissions?: HouseholdPermissions;
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

export type ExportSection = 'balances' | 'fixedBills' | 'expenses' | 'savings';
export type ExportSections = Record<ExportSection, boolean>;
export const EXPORT_SECTION_AREA: Record<ExportSection, HouseholdArea> = {
  balances: 'balances',
  fixedBills: 'fixedBills',
  expenses: 'expenses',
  savings: 'savings',
};
export const ALL_EXPORT_SECTIONS: ExportSections = {
  balances: true,
  fixedBills: true,
  expenses: true,
  savings: true,
};

/** Hidden household areas are omitted from CSV exports. */
export function exportSectionsFor(
  role: HouseholdRole | undefined,
  legacyCustom?: HouseholdPermissions,
): ExportSections {
  return {
    balances: canView(role, 'balances', legacyCustom),
    fixedBills: canView(role, 'fixedBills', legacyCustom),
    expenses: canView(role, 'expenses', legacyCustom),
    savings: canView(role, 'savings', legacyCustom),
  };
}

export function canExportAnything(sections: ExportSections): boolean {
  return Object.values(sections).some(Boolean);
}

export const QUICK_ACTION_AREA: Record<'expense' | 'charge' | 'savings' | 'courses', HouseholdArea> = {
  expense: 'expenses',
  charge: 'fixedBills',
  savings: 'savings',
  courses: 'expenses',
};
