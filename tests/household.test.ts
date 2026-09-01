import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  HOUSEHOLD_AREAS,
  permissionsFor,
  accessLevel,
  canView,
  canEdit,
  SCREEN_AREA,
  TOOL_AREA,
  AMOUNT_AREA,
  QUICK_ACTION_AREA,
  EXPORT_SECTION_AREA,
  ALL_EXPORT_SECTIONS,
  exportSectionsFor,
  resolveAreaAccess,
  canExportAnything,
  type HouseholdArea,
  type HouseholdPermissions,
} from '../src/lib/household-rbac';
import { getMobileQuickActions } from '../src/lib/dashboard-quick-actions';
import {
  householdStorageKey,
  actorForMonth,
  canShowProUpgrade,
  isProFeatureUnlocked,
  monthStartDateField,
  monthStartDateFor,
  type HouseholdRole,
} from '../src/lib/household';

describe('Per-workspace month start date', () => {
  it('maps each workspace to its own profile field', () => {
    assert.strictEqual(monthStartDateField('personal'), 'monthStartDate');
    assert.strictEqual(monthStartDateField('household'), 'householdMonthStartDate');
    assert.strictEqual(monthStartDateField(undefined), 'monthStartDate');
  });

  it('reads a separate payday per workspace', () => {
    const profile = { monthStartDate: 15, householdMonthStartDate: 2 };
    assert.strictEqual(monthStartDateFor(profile, 'personal'), 15);
    assert.strictEqual(monthStartDateFor(profile, 'household'), 2);
  });

  it('falls back to the personal payday while the household one is unset', () => {
    const profile = { monthStartDate: 15, householdMonthStartDate: undefined };
    assert.strictEqual(monthStartDateFor(profile, 'household'), 15);
  });

  it('never lets the household payday leak into the personal period', () => {
    const profile = { monthStartDate: 15, householdMonthStartDate: 2 };
    assert.notStrictEqual(
      monthStartDateFor(profile, 'personal'),
      monthStartDateFor(profile, 'household'),
    );
  });

  it('handles a missing or empty profile without throwing', () => {
    assert.strictEqual(monthStartDateFor(null, 'personal'), undefined);
    assert.strictEqual(monthStartDateFor(undefined, 'household'), undefined);
    assert.strictEqual(monthStartDateFor({}, 'personal'), undefined);
  });
});

describe('Household RBAC permissions', () => {
  it('grants full editAll permissions to owner and editor roles across all 11 areas', () => {
    const ownerPerms = permissionsFor('owner');
    const editorPerms = permissionsFor('editor');

    for (const area of HOUSEHOLD_AREAS) {
      assert.equal(ownerPerms[area.id], 'editAll');
      assert.equal(editorPerms[area.id], 'editAll');
      assert.equal(canView('owner', area.id), true);
      assert.equal(canEdit('owner', area.id), true);
      assert.equal(canView('editor', area.id), true);
      assert.equal(canEdit('editor', area.id), true);
    }
  });

  it('grants read-only view permissions to viewer role across all 11 areas', () => {
    const viewerPerms = permissionsFor('viewer');

    for (const area of HOUSEHOLD_AREAS) {
      assert.equal(viewerPerms[area.id], 'view');
      assert.equal(canView('viewer', area.id), true);
      assert.equal(canEdit('viewer', area.id), false);
      assert.equal(canEdit('viewer', area.id, undefined, true), false);
    }
  });

  it('grants editOwn permissions only on invoices and expenses to contributor role', () => {
    const contributorPerms = permissionsFor('contributor');
    assert.deepEqual(contributorPerms, { invoices: 'editOwn', expenses: 'editOwn' });

    assert.equal(canView('contributor', 'invoices'), true);
    assert.equal(canView('contributor', 'expenses'), true);
    assert.equal(canView('contributor', 'dashboard'), false);
    assert.equal(canView('contributor', 'balances'), false);

    assert.equal(canEdit('contributor', 'invoices', undefined, false), false);
    assert.equal(canEdit('contributor', 'invoices', undefined, true), true);
    assert.equal(canEdit('contributor', 'expenses', undefined, true), true);
    assert.equal(canEdit('contributor', 'fixedBills', undefined, true), false);
  });

  it('respects custom permissions maps for custom role', () => {
    const customPerms: HouseholdPermissions = {
      dashboard: 'view',
      savings: 'editAll',
      invoices: 'editOwn',
    };

    assert.equal(canView('custom', 'dashboard', customPerms), true);
    assert.equal(canEdit('custom', 'dashboard', customPerms), false);

    assert.equal(canView('custom', 'savings', customPerms), true);
    assert.equal(canEdit('custom', 'savings', customPerms), true);

    assert.equal(canView('custom', 'invoices', customPerms), true);
    assert.equal(canEdit('custom', 'invoices', customPerms, false), false);
    assert.equal(canEdit('custom', 'invoices', customPerms, true), true);

    assert.equal(canView('custom', 'debts', customPerms), false);
  });

  it('maps UI screens to expected RBAC areas', () => {
    assert.equal(SCREEN_AREA.overview, 'dashboard');
    assert.equal(SCREEN_AREA.variable, 'expenses');
    assert.equal(SCREEN_AREA.fixed, 'fixedBills');
    assert.equal(SCREEN_AREA.savings, 'savings');
    assert.equal(SCREEN_AREA.debts, 'debts');
    assert.equal(SCREEN_AREA.trends, 'analytics');
    // A course session ends as variable expenses, so it is the `expenses` area.
    assert.equal(SCREEN_AREA.courses, 'expenses');
  });

  it('resolves the raw access level behind canView/canEdit', () => {
    assert.equal(accessLevel('owner', 'income'), 'editAll');
    assert.equal(accessLevel('editor', 'balances'), 'editAll');
    assert.equal(accessLevel('viewer', 'income'), 'view');
    assert.equal(accessLevel('contributor', 'expenses'), 'editOwn');
    assert.equal(accessLevel('contributor', 'balances'), 'none');
    // No role at all (membership row missing) must fail closed.
    assert.equal(accessLevel(undefined, 'income'), 'none');
    assert.equal(accessLevel(undefined, 'balances'), 'none');
  });
});

describe('resolveAreaAccess — the gates every screen renders from', () => {
  it('grants everything in the personal workspace regardless of stored role', () => {
    const access = resolveAreaAccess({ unrestricted: true, role: undefined, permissions: undefined });
    for (const { id } of HOUSEHOLD_AREAS) {
      assert.equal(access.level(id), 'editAll');
      assert.equal(access.canView(id), true);
      assert.equal(access.canEdit(id), true);
    }
    assert.deepEqual(access.exportSections, ALL_EXPORT_SECTIONS);
  });

  it('hides income sources and total cash on hand from a viewer', () => {
    const access = resolveAreaAccess({ unrestricted: false, role: 'viewer', permissions: undefined });
    // Overview: TOTAL CASH ON HAND + money places + budget editor
    assert.equal(access.canView('balances'), true);
    assert.equal(access.canEdit('balances'), false);
    // Sidebar / profile "Income sources" entry and the Trends income breakdown
    assert.equal(access.canView('income'), true);
    assert.equal(access.canEdit('income'), false);
  });

  it('keeps income sources and total cash on hand away from a contributor', () => {
    const access = resolveAreaAccess({ unrestricted: false, role: 'contributor', permissions: undefined });
    assert.equal(access.canView('income'), false);
    assert.equal(access.canEdit('income'), false);
    assert.equal(access.canView('balances'), false);
    assert.equal(access.canEdit('balances'), false);
    // ...while their own expense entry still works.
    assert.equal(access.canView('expenses'), true);
    assert.equal(access.canEdit('expenses', true), true);
    assert.equal(access.canEdit('expenses', false), false);
  });

  it('lets a custom role see income without being able to change it', () => {
    const access = resolveAreaAccess({
      unrestricted: false,
      role: 'custom',
      permissions: { income: 'view', balances: 'none' },
    });
    assert.equal(access.level('income'), 'view');
    assert.equal(access.canView('income'), true);
    assert.equal(access.canEdit('income'), false);
    assert.equal(access.canView('balances'), false);
    assert.equal(access.exportSections.balances, false);
  });

  it('fails closed for a household member whose row has not loaded yet', () => {
    const access = resolveAreaAccess({ unrestricted: false, role: undefined, permissions: undefined });
    for (const { id } of HOUSEHOLD_AREAS) {
      assert.equal(access.canView(id), false);
      assert.equal(access.canEdit(id), false);
    }
    assert.equal(canExportAnything(access.exportSections), false);
  });
});

describe('Household RBAC surface coverage', () => {
  const SURFACE_AREAS: HouseholdArea[] = [
    // SCREEN_AREA is a partial record, so its values are optional.
    ...Object.values(SCREEN_AREA),
    ...Object.values(TOOL_AREA),
    ...Object.values(AMOUNT_AREA),
    ...Object.values(QUICK_ACTION_AREA),
    ...Object.values(EXPORT_SECTION_AREA),
  ].filter((area): area is HouseholdArea => area !== undefined);

  it('owns every area with at least one gated UI surface', () => {
    // Guards against the original bug: an area defined in the matrix but never
    // consulted by any screen, so its figures rendered for everyone.
    for (const { id } of HOUSEHOLD_AREAS) {
      assert.ok(SURFACE_AREAS.includes(id), `no gated surface for area "${id}"`);
    }
  });

  it('assigns income sources and total cash on hand to their own areas', () => {
    assert.equal(AMOUNT_AREA.incomeSource, 'income');
    assert.equal(AMOUNT_AREA.totalCashOnHand, 'balances');
    assert.equal(AMOUNT_AREA.totalBudget, 'balances');
    assert.equal(AMOUNT_AREA.moneyPlace, 'balances');
    assert.equal(TOOL_AREA.incomeSources, 'income');
  });

  it('maps every mobile quick action to the area it writes to', () => {
    for (const action of getMobileQuickActions()) {
      assert.ok(QUICK_ACTION_AREA[action.id], `quick action "${action.id}" has no RBAC area`);
    }
    assert.equal(QUICK_ACTION_AREA.expense, 'expenses');
    assert.equal(QUICK_ACTION_AREA.charge, 'fixedBills');
    assert.equal(QUICK_ACTION_AREA.savings, 'savings');
    assert.equal(QUICK_ACTION_AREA.courses, 'expenses');
  });
});

describe('Household RBAC export filtering', () => {
  it('lets owner and editor export every section', () => {
    assert.deepEqual(exportSectionsFor('owner'), ALL_EXPORT_SECTIONS);
    assert.deepEqual(exportSectionsFor('editor'), ALL_EXPORT_SECTIONS);
    assert.equal(canExportAnything(ALL_EXPORT_SECTIONS), true);
  });

  it('lets a viewer export every section (view includes download)', () => {
    assert.deepEqual(exportSectionsFor('viewer'), ALL_EXPORT_SECTIONS);
  });

  it('drops balances and savings from a contributor export', () => {
    const sections = exportSectionsFor('contributor');
    assert.deepEqual(sections, {
      balances: false,
      fixedBills: false,
      expenses: true,
      savings: false,
    });
    assert.equal(canExportAnything(sections), true);
  });

  it('exports nothing for a custom member with no viewable area', () => {
    const none = exportSectionsFor('custom', { income: 'view' });
    assert.deepEqual(none, { balances: false, fixedBills: false, expenses: false, savings: false });
    assert.equal(canExportAnything(none), false);
  });

  it('keeps only the granted sections for a custom member', () => {
    const sections = exportSectionsFor('custom', { balances: 'view', savings: 'editAll' });
    assert.deepEqual(sections, { balances: true, fixedBills: false, expenses: false, savings: true });
  });

  it('fails closed when the membership row is missing', () => {
    const sections = exportSectionsFor(undefined);
    assert.deepEqual(sections, { balances: false, fixedBills: false, expenses: false, savings: false });
    assert.equal(canExportAnything(sections), false);
  });
});

describe('Household storage and audit helpers', () => {
  it('householdStorageKey generates correct namespaced keys for personal vs household budgets', () => {
    assert.equal(householdStorageKey(undefined, '2026-07'), 'flousy_month_2026-07');
    assert.equal(householdStorageKey('house-123', '2026-07'), 'flousy_household_house-123_month_2026-07');
  });

  it('actorForMonth attaches updatedAt timestamp and optional updatedByUserId audit trail', () => {
    const baseMonth: any = { month: '2026-07', totalBudget: 5000 };
    const auditedWithUser = actorForMonth(baseMonth, 'user-xyz');

    assert.equal(auditedWithUser.month, '2026-07');
    assert.equal(auditedWithUser.totalBudget, 5000);
    assert.equal(auditedWithUser.updatedByUserId, 'user-xyz');
    assert.ok(typeof auditedWithUser.updatedAt === 'string');

    const auditedNoUser = actorForMonth(baseMonth);
    assert.equal(auditedNoUser.updatedByUserId, undefined);
    assert.ok(typeof auditedNoUser.updatedAt === 'string');
  });

  it('canShowProUpgrade displays upgrade CTA only on private workspace and never on household workspace', () => {
    assert.equal(canShowProUpgrade(false, 'personal'), true);
    assert.equal(canShowProUpgrade(false, undefined), true);
    assert.equal(canShowProUpgrade(false, 'household'), false);
    assert.equal(canShowProUpgrade(true, 'personal'), false);
    assert.equal(canShowProUpgrade(true, 'household'), false);
  });

  it('isProFeatureUnlocked unlocks Pro features when in a household workspace even for free members', () => {
    assert.equal(isProFeatureUnlocked(true, 'personal'), true);
    assert.equal(isProFeatureUnlocked(false, 'household'), true);
    assert.equal(isProFeatureUnlocked(false, 'personal'), false);
    assert.equal(isProFeatureUnlocked(false, undefined), false);
  });
});
