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
  isHouseholdEntitlementActive,
  monthStartDateFor,
  normalizeHouseholdName,
  isAssignableMemberRole,
} from '../src/lib/household';

describe('Household name validation', () => {
  it('trims valid names and enforces the Firestore size boundary', () => {
    assert.equal(normalizeHouseholdName('  The Silva family  '), 'The Silva family');
    assert.equal(normalizeHouseholdName(''), null);
    assert.equal(normalizeHouseholdName('   '), null);
    assert.equal(normalizeHouseholdName('a'.repeat(100)), 'a'.repeat(100));
    assert.equal(normalizeHouseholdName('a'.repeat(101)), null);
  });
});

describe('Authoritative workspace month start date', () => {
  it('reads personal periods from the profile and household periods from household configuration', () => {
    const profile = { monthStartDate: 15 };
    const household = { monthStartDate: 2 };
    assert.equal(monthStartDateFor(profile, 'personal', household), 15);
    assert.equal(monthStartDateFor(profile, 'household', household), 2);
  });

  it('never leaks a personal or legacy profile value into household configuration', () => {
    const profile = { monthStartDate: 15, householdMonthStartDate: 7 };
    assert.equal(monthStartDateFor(profile, 'household'), undefined);
    assert.equal(monthStartDateFor(profile, 'household', {}), undefined);
  });

  it('handles missing data without throwing', () => {
    assert.equal(monthStartDateFor(null, 'personal'), undefined);
    assert.equal(monthStartDateFor(undefined, 'household'), undefined);
    assert.equal(monthStartDateFor({}, 'personal'), undefined);
  });
});

describe('Household RBAC permissions', () => {
  it('grants owners every area and keeps owner-only configuration out of editor writes', () => {
    const owner = permissionsFor('owner');
    const editor = permissionsFor('editor');
    for (const { id } of HOUSEHOLD_AREAS) {
      assert.equal(owner[id], 'editAll');
      assert.equal(canEdit('owner', id), true);
      assert.equal(canView('editor', id), true);
    }
    assert.equal(editor.members, 'view');
    assert.equal(editor.settings, 'view');
    assert.equal(canEdit('editor', 'members'), false);
    assert.equal(canEdit('editor', 'settings'), false);
    assert.equal(canEdit('editor', 'expenses'), true);
  });

  it('keeps viewers read-only and excludes the editor-only invoice queue', () => {
    for (const { id } of HOUSEHOLD_AREAS) {
      assert.equal(canEdit('viewer', id, undefined, true), false);
    }
    assert.equal(canView('viewer', 'dashboard'), true);
    assert.equal(canView('viewer', 'balances'), true);
    assert.equal(canView('viewer', 'invoices'), false);
  });

  it('restricts contributors to their own invoice boundary', () => {
    assert.equal(canView('contributor', 'invoices'), true);
    assert.equal(canEdit('contributor', 'invoices', undefined, false), false);
    assert.equal(canEdit('contributor', 'invoices', undefined, true), true);
    for (const { id } of HOUSEHOLD_AREAS.filter(({ id }) => id !== 'invoices')) {
      assert.equal(accessLevel('contributor', id), 'none');
    }
  });

  it('ignores legacy custom maps that Firestore cannot enforce', () => {
    const attempted: HouseholdPermissions = {
      dashboard: 'editAll',
      balances: 'view',
      savings: 'editAll',
    };
    assert.equal(canView('custom', 'dashboard', attempted), false);
    assert.equal(canView('custom', 'balances', attempted), false);
    assert.equal(canEdit('custom', 'savings', attempted), false);
    assert.equal(canEdit('custom', 'invoices', attempted, true), true);
  });

  it('fails closed while the membership row is unavailable', () => {
    for (const { id } of HOUSEHOLD_AREAS) {
      assert.equal(accessLevel(undefined, id), 'none');
    }
  });
});

describe('resolveAreaAccess', () => {
  it('grants every surface in a personal workspace', () => {
    const access = resolveAreaAccess({ unrestricted: true, role: undefined });
    for (const { id } of HOUSEHOLD_AREAS) {
      assert.equal(access.level(id), 'editAll');
      assert.equal(access.canView(id), true);
      assert.equal(access.canEdit(id), true);
    }
    assert.deepEqual(access.exportSections, ALL_EXPORT_SECTIONS);
  });

  it('derives read-only viewer and restricted contributor gates from roles', () => {
    const viewer = resolveAreaAccess({ unrestricted: false, role: 'viewer' });
    assert.equal(viewer.canView('income'), true);
    assert.equal(viewer.canEdit('income'), false);

    const contributor = resolveAreaAccess({ unrestricted: false, role: 'contributor' });
    assert.equal(contributor.canView('income'), false);
    assert.equal(contributor.canView('balances'), false);
    assert.equal(contributor.canEdit('invoices', true), true);
    assert.equal(contributor.canEdit('expenses', true), false);
  });

  it('does not elevate a custom role through its stored map', () => {
    const access = resolveAreaAccess({
      unrestricted: false,
      role: 'custom',
      permissions: { income: 'view', balances: 'editAll' },
    });
    assert.equal(access.canView('income'), false);
    assert.equal(access.canEdit('balances'), false);
    assert.equal(access.canEdit('invoices', true), true);
  });
});

describe('Household RBAC surface coverage', () => {
  const surfaceAreas: HouseholdArea[] = [
    ...Object.values(SCREEN_AREA),
    ...Object.values(TOOL_AREA),
    ...Object.values(AMOUNT_AREA),
    ...Object.values(QUICK_ACTION_AREA),
    ...Object.values(EXPORT_SECTION_AREA),
  ].filter((area): area is HouseholdArea => area !== undefined);

  it('owns every area with at least one gated UI surface', () => {
    for (const { id } of HOUSEHOLD_AREAS) {
      assert.ok(surfaceAreas.includes(id), `no gated surface for area "${id}"`);
    }
  });

  it('assigns money figures and quick actions to their write boundaries', () => {
    assert.equal(AMOUNT_AREA.incomeSource, 'income');
    assert.equal(AMOUNT_AREA.totalCashOnHand, 'balances');
    assert.equal(TOOL_AREA.incomeSources, 'income');
    for (const action of getMobileQuickActions()) {
      assert.ok(QUICK_ACTION_AREA[action.id], `quick action "${action.id}" has no RBAC area`);
    }
  });
});

describe('Household RBAC export filtering', () => {
  it('allows finance readers and rejects invoice-only roles', () => {
    assert.deepEqual(exportSectionsFor('owner'), ALL_EXPORT_SECTIONS);
    assert.deepEqual(exportSectionsFor('editor'), ALL_EXPORT_SECTIONS);
    assert.deepEqual(exportSectionsFor('viewer'), ALL_EXPORT_SECTIONS);
    const none = { balances: false, fixedBills: false, expenses: false, savings: false };
    assert.deepEqual(exportSectionsFor('contributor'), none);
    assert.deepEqual(exportSectionsFor('custom', { savings: 'editAll' }), none);
    assert.deepEqual(exportSectionsFor(undefined), none);
    assert.equal(canExportAnything(none), false);
  });
});

describe('Household storage and audit helpers', () => {
  it('namespaces personal and household month caches', () => {
    assert.equal(householdStorageKey(undefined, '2026-07'), 'flousy_month_2026-07');
    assert.equal(householdStorageKey('house-123', '2026-07'), 'flousy_household_house-123_month_2026-07');
  });

  it('attaches audit metadata without mutating month fields', () => {
    const baseMonth: any = { month: '2026-07', totalBudget: 5000 };
    const audited = actorForMonth(baseMonth, 'user-xyz');
    assert.equal(audited.month, '2026-07');
    assert.equal(audited.totalBudget, 5000);
    assert.equal(audited.updatedByUserId, 'user-xyz');
    assert.equal(typeof audited.updatedAt, 'string');
    assert.equal(actorForMonth(baseMonth).updatedByUserId, undefined);
  });

  it('keeps upgrades personal and expires projected household trial access', () => {
    const now = Date.UTC(2026, 8, 2);
    const active = {
      entitlementSource: 'launch_trial' as const,
      entitlementStatus: 'trialing' as const,
      entitlementEndsAtMs: now + 1,
    };
    const expired = { ...active, entitlementEndsAtMs: now };

    assert.equal(canShowProUpgrade(false, 'personal'), true);
    assert.equal(canShowProUpgrade(false, 'household'), false);
    assert.equal(canShowProUpgrade(true, 'personal'), false);
    assert.equal(isProFeatureUnlocked(true, 'personal'), true);
    assert.equal(isHouseholdEntitlementActive(active, now), true);
    assert.equal(isHouseholdEntitlementActive(expired, now), false);
    assert.equal(isProFeatureUnlocked(false, 'household', active, now), true);
    assert.equal(isProFeatureUnlocked(false, 'household', expired, now), false);
    assert.equal(isProFeatureUnlocked(false, 'personal', active, now), false);
    // Legacy households have no projection and retain access/data.
    assert.equal(isHouseholdEntitlementActive({}, now), true);
  });
});

describe('Assignable member roles', () => {
  it('offers only roles backed by Firestore rules', () => {
    for (const role of ['editor', 'viewer', 'contributor']) {
      assert.equal(isAssignableMemberRole(role), true, role);
    }
    for (const role of ['owner', 'profile', 'custom', '', 'admin']) {
      assert.equal(isAssignableMemberRole(role), false, role);
    }
  });
});
