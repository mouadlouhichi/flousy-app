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
 * Per-area grants for the `custom` role. The stored map is authoritative, but
 * only after `sanitizePermissions` clamps every entry to the levels Firestore
 * Rules can actually enforce for that area (see `AREA_LEVEL_OPTIONS`).
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

/**
 * The grant levels a `custom` member may hold per area — mirrored verbatim by
 * `validCustomPermissions()` in `firestore.rules`, which is why the sets are
 * narrow:
 *
 * - Month-document areas (`balances`…`debts`) support `editAll` because rules
 *   verify the changed month keys against the member's grants via
 *   `diff().affectedKeys()`. `editOwn` is not offered: rules cannot attribute
 *   individual rows inside a shared month document to an author.
 * - `invoices` supports `editOwn` (submit + follow your own invoices, the
 *   contributor flow) and `view` (read the household queue). Approval stays
 *   with owners/editors because approving also posts into the month document.
 * - `dashboard`/`analytics` are read surfaces; `members`/`settings` never
 *   exceed `view` — management stays owner-only in rules.
 */
export const AREA_LEVEL_OPTIONS: Record<HouseholdArea, readonly AccessLevel[]> = {
  dashboard: ['none', 'view'],
  balances: ['none', 'view', 'editAll'],
  income: ['none', 'view', 'editAll'],
  expenses: ['none', 'view', 'editAll'],
  fixedBills: ['none', 'view', 'editAll'],
  savings: ['none', 'view', 'editAll'],
  debts: ['none', 'view', 'editAll'],
  analytics: ['none', 'view'],
  invoices: ['none', 'view', 'editOwn'],
  members: ['none', 'view'],
  settings: ['none', 'view'],
};

const LEVEL_ORDER: readonly AccessLevel[] = ['none', 'view', 'editOwn', 'editAll'];

/**
 * Clamps a stored/authored permission map onto `AREA_LEVEL_OPTIONS`: unknown
 * areas are dropped and each requested level collapses to the strongest
 * allowed level that does not exceed it (e.g. `expenses: 'editOwn'` → `view`,
 * `members: 'editAll'` → `view`). Every authorization decision and every
 * write path must go through this, so a hand-edited document can never grant
 * more than the rules enforce.
 */
export function sanitizePermissions(map?: HouseholdPermissions): Record<HouseholdArea, AccessLevel> {
  const result = none();
  if (!map) return result;
  for (const area of HOUSEHOLD_AREAS) {
    const requested = map[area.id];
    if (!requested) continue;
    const requestedRank = LEVEL_ORDER.indexOf(requested);
    if (requestedRank < 0) continue;
    let chosen: AccessLevel = 'none';
    for (const level of AREA_LEVEL_OPTIONS[area.id]) {
      if (LEVEL_ORDER.indexOf(level) <= requestedRank) chosen = level;
    }
    result[area.id] = chosen;
  }
  return result;
}

/**
 * Custom members created before the permission matrix was reinstated may have
 * no stored map at all; they keep the contributor-equivalent access they
 * effectively had, instead of silently losing the ability to submit invoices.
 */
export const LEGACY_CUSTOM_FALLBACK: HouseholdPermissions = { invoices: 'editOwn' };

/** Starting point offered by the invite/edit matrix editor. */
export const DEFAULT_CUSTOM_PERMISSIONS: HouseholdPermissions = {
  dashboard: 'view',
  expenses: 'view',
  invoices: 'editOwn',
};

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
 * For `custom` members the sanitized per-area matrix is authoritative — rules
 * enforce the same grants server-side by diffing the changed month keys
 * against the member's stored map (`customMonthChangesAllowed`).
 */
export function permissionsFor(
  role: HouseholdRole | undefined,
  custom?: HouseholdPermissions,
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
  if (role === 'contributor') {
    return {
      ...none(),
      invoices: 'editOwn',
    };
  }
  if (role === 'custom') {
    return sanitizePermissions(custom ?? LEGACY_CUSTOM_FALLBACK);
  }
  // `profile` is a placeholder row written by onboarding (and accepted by the
  // rules' member-create branch) for a person who is not yet a member. It
  // carries no grants. Stated explicitly so it is never mistaken for the
  // "unknown role" fall-through below and accidentally given one.
  if (role === 'profile') return none();
  // Unknown or absent role: no access. Note that an absent role can also mean
  // the roster was unreadable — callers must not infer "not a member" from it.
  return none();
}

/** Month-document areas whose `editAll` grant makes a custom member a writer. */
export const MONTH_EDIT_AREAS = [
  'balances',
  'income',
  'expenses',
  'fixedBills',
  'savings',
  'debts',
] as const satisfies readonly HouseholdArea[];

/** True when the matrix grants direct edit access to the shared month document. */
export function hasMonthEditGrant(permissions: Record<HouseholdArea, AccessLevel>): boolean {
  return MONTH_EDIT_AREAS.some((area) => permissions[area] === 'editAll');
}

/** Finance surfaces whose visibility implies reading month/ledger documents. */
export const FINANCE_VIEW_AREAS = [
  'dashboard',
  'balances',
  'income',
  'expenses',
  'fixedBills',
  'savings',
  'debts',
  'analytics',
] as const satisfies readonly HouseholdArea[];

/**
 * True when the member may read household finance documents at all. A custom
 * member without any finance grant (e.g. invoices-only) uses the contributor
 * flow instead of subscribing to months — rules deny those reads.
 */
export function hasFinanceView(permissions: Record<HouseholdArea, AccessLevel>): boolean {
  return FINANCE_VIEW_AREAS.some((area) => permissions[area] !== 'none');
}

export function accessLevel(
  role: HouseholdRole | undefined,
  area: HouseholdArea,
  custom?: HouseholdPermissions,
): AccessLevel {
  return permissionsFor(role, custom)[area];
}

export function canView(
  role: HouseholdRole | undefined,
  area: HouseholdArea,
  custom?: HouseholdPermissions,
): boolean {
  return accessLevel(role, area, custom) !== 'none';
}

export function canEdit(
  role: HouseholdRole | undefined,
  area: HouseholdArea,
  custom?: HouseholdPermissions,
  own = false,
): boolean {
  const level = accessLevel(role, area, custom);
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
  search: 'expenses',
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
  /** Stored matrix for `custom` members; sanitized before it grants anything. */
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
  custom?: HouseholdPermissions,
): ExportSections {
  return {
    balances: canView(role, 'balances', custom),
    fixedBills: canView(role, 'fixedBills', custom),
    expenses: canView(role, 'expenses', custom),
    savings: canView(role, 'savings', custom),
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
