import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  AREA_LEVEL_OPTIONS,
  HOUSEHOLD_AREAS,
  LEGACY_CUSTOM_FALLBACK,
  hasFinanceView,
  hasMonthEditGrant,
  permissionsFor,
  sanitizePermissions,
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
  computeHouseholdContributions,
  type HouseholdMember,
} from '../src/lib/household';
import { normalizeMonth } from '../src/lib/store';

function makeMember(id: string, overrides: Partial<HouseholdMember> = {}): HouseholdMember {
  return {
    id,
    displayName: id,
    role: 'editor',
    status: 'active',
    avatarColor: '#00685f',
    ...overrides,
  };
}

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

  it('honors the custom matrix, clamped to enforceable levels', () => {
    const attempted: HouseholdPermissions = {
      dashboard: 'editAll', // read surface: clamps to view
      balances: 'view',
      savings: 'editAll',
    };
    assert.equal(canView('custom', 'dashboard', attempted), true);
    assert.equal(canEdit('custom', 'dashboard', attempted), false);
    assert.equal(canView('custom', 'balances', attempted), true);
    assert.equal(canEdit('custom', 'balances', attempted), false);
    assert.equal(canEdit('custom', 'savings', attempted), true);
    // A stored map is exhaustive: areas it omits are denied, including invoices.
    assert.equal(canEdit('custom', 'invoices', attempted, true), false);
  });

  it('keeps legacy custom members on the contributor-equivalent fallback', () => {
    // Documents created before the matrix editor returned stored no map.
    assert.equal(canEdit('custom', 'invoices', undefined, true), true);
    assert.equal(canView('custom', 'expenses', undefined), false);
    assert.deepEqual(permissionsFor('custom'), permissionsFor('custom', LEGACY_CUSTOM_FALLBACK));
  });

  it('clamps every requested level onto AREA_LEVEL_OPTIONS', () => {
    const sanitized = sanitizePermissions({
      members: 'editAll', // management stays owner-only: clamps to view
      settings: 'editOwn', // clamps to view
      expenses: 'editOwn', // rules cannot attribute month rows: clamps to view
      invoices: 'editAll', // approval stays owner/editor: clamps to editOwn
      income: 'editAll', // allowed as-is
      debts: 'view', // allowed as-is
    });
    assert.equal(sanitized.members, 'view');
    assert.equal(sanitized.settings, 'view');
    assert.equal(sanitized.expenses, 'view');
    assert.equal(sanitized.invoices, 'editOwn');
    assert.equal(sanitized.income, 'editAll');
    assert.equal(sanitized.debts, 'view');
    assert.equal(sanitized.balances, 'none');
    for (const { id } of HOUSEHOLD_AREAS) {
      assert.ok(AREA_LEVEL_OPTIONS[id].includes(sanitized[id]), id);
    }
  });

  it('derives writer and finance-view predicates from the sanitized matrix', () => {
    assert.equal(hasMonthEditGrant(sanitizePermissions({ expenses: 'editAll' })), true);
    assert.equal(hasMonthEditGrant(sanitizePermissions({ expenses: 'view', invoices: 'editOwn' })), false);
    assert.equal(hasFinanceView(sanitizePermissions({ dashboard: 'view' })), true);
    assert.equal(hasFinanceView(sanitizePermissions({ invoices: 'editOwn', members: 'view' })), false);
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

  it('resolves custom gates from the stored map without elevation paths', () => {
    const access = resolveAreaAccess({
      unrestricted: false,
      role: 'custom',
      permissions: { income: 'view', balances: 'editAll', members: 'editAll' },
    });
    assert.equal(access.canView('income'), true);
    assert.equal(access.canEdit('income'), false);
    assert.equal(access.canEdit('balances'), true);
    // Management surfaces clamp to view no matter what the document says.
    assert.equal(access.canEdit('members'), false);
    assert.equal(access.canView('members'), true);
    // Areas the map omits stay closed, including the invoice queue.
    assert.equal(access.canEdit('invoices', true), false);
    assert.equal(access.canView('expenses'), false);
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
    assert.deepEqual(
      exportSectionsFor('custom', { savings: 'editAll' }),
      { ...none, savings: true },
    );
    assert.deepEqual(exportSectionsFor('custom'), none);
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
    for (const role of ['editor', 'viewer', 'contributor', 'custom']) {
      assert.equal(isAssignableMemberRole(role), true, role);
    }
    for (const role of ['owner', 'profile', '', 'admin']) {
      assert.equal(isAssignableMemberRole(role), false, role);
    }
  });
});

describe('Household contribution settle-up math', () => {
  const mouad = makeMember('mouad', { displayName: 'louhichi mouad', userId: 'uid-mouad', role: 'owner' });
  const luigi = makeMember('luigi', { displayName: 'Luigi Family', userId: 'uid-luigi', role: 'editor' });
  const members = [mouad, luigi];

  it('attributes explicit payer ids and balances sum to zero', () => {
    const month = normalizeMonth({
      variableExpenses: [
        { id: 'e1', name: 'Groceries', amount: 300, type: 'Groceries', date: '2026-09-01', place: 'bank', payerMemberId: 'mouad' },
        { id: 'e2', name: 'Bus', amount: 100, type: 'Transport', date: '2026-09-02', place: 'wallet', payerMemberId: 'luigi' },
      ],
    }, '2026-09');
    const result = computeHouseholdContributions(month, members);
    assert.equal(result.rows.length, 2);
    assert.equal(result.rows[0].paid, 300);
    assert.equal(result.rows[0].balance, 100);
    assert.equal(result.rows[1].paid, 100);
    assert.equal(result.rows[1].balance, -100);
    assert.equal(Math.round(result.rows.reduce((sum, r) => sum + r.balance, 0) * 100) / 100, 0);
    assert.equal(result.pooledTotal, 0);
    assert.equal(result.unattributedTotal, 0);
  });

  it("resolves the default 'self' payer through createdByUserId", () => {
    // The default expense flow: nobody taps a named payer badge.
    const month = normalizeMonth({
      variableExpenses: [
        { id: 'e1', name: 'Groceries', amount: 300, type: 'Groceries', date: '2026-09-01', place: 'bank', payerMemberId: 'self', createdByUserId: 'uid-mouad' },
        { id: 'e2', name: 'Bus', amount: 100, type: 'Transport', date: '2026-09-02', place: 'wallet', payerMemberId: 'self', createdByUserId: 'uid-luigi' },
      ],
      fixedExpenses: [
        { id: 'f1', name: 'Rent', amount: 1000, type: 'Rent', place: 'bank', status: 'paid', payerMemberId: 'self', createdByUserId: 'uid-mouad' },
      ],
    }, '2026-09');
    const result = computeHouseholdContributions(month, members);
    // mouad: 300 variable + 1000 fixed; luigi: 100. Total 1400, share 700.
    assert.equal(result.rows[0].paid, 1300);
    assert.equal(result.rows[1].paid, 100);
    assert.equal(result.rows[0].balance, 600);
    assert.equal(result.rows[1].balance, -600);
    assert.equal(result.unattributedTotal, 0);
  });

  it("keeps pooled 'household' payments visible but out of the split", () => {
    const month = normalizeMonth({
      variableExpenses: [
        { id: 'e1', name: 'Groceries', amount: 300, type: 'Groceries', date: '2026-09-01', place: 'bank', payerMemberId: 'household' },
        { id: 'e2', name: 'Bus', amount: 100, type: 'Transport', date: '2026-09-02', place: 'wallet', payerMemberId: 'mouad' },
      ],
    }, '2026-09');
    const result = computeHouseholdContributions(month, members);
    assert.equal(result.pooledTotal, 300);
    assert.equal(result.unattributedTotal, 0);
    // Only the attributed 100 is split: 50/50.
    assert.equal(result.rows[0].paid, 100);
    assert.equal(result.rows[0].balance, 50);
    assert.equal(result.rows[1].paid, 0);
    assert.equal(result.rows[1].balance, -50);
  });

  it('reports unresolvable payers as unattributed instead of hiding the money', () => {
    const month = normalizeMonth({
      variableExpenses: [
        // 'self' with no resolvable audit stamp (legacy row).
        { id: 'e1', name: 'Old', amount: 500, type: 'Other', date: '2026-09-01', place: 'bank', payerMemberId: 'self' },
        // Payer was removed from the household (now inactive).
        { id: 'e2', name: 'Gone', amount: 60, type: 'Other', date: '2026-09-02', place: 'bank', payerMemberId: 'ex-member' },
        // Legacy personal payer id.
        { id: 'e3', name: 'Legacy', amount: 40, type: 'Other', date: '2026-09-03', place: 'bank', payerMemberId: 'legacy-0' },
        { id: 'e4', name: 'Mine', amount: 200, type: 'Other', date: '2026-09-04', place: 'bank', payerMemberId: 'mouad' },
      ],
    }, '2026-09');
    const roster = [...members, makeMember('ex-member', { status: 'inactive' })];
    const result = computeHouseholdContributions(month, roster);
    assert.equal(result.unattributedTotal, 600);
    // Only 200 is split; the 600 cannot silently distort anyone's balance.
    assert.equal(result.rows[0].paid, 200);
    assert.equal(result.rows[0].balance, 100);
    assert.equal(result.rows[1].paid, 0);
    assert.equal(result.rows[1].balance, -100);
  });

  it('counts fixed bills by lifecycle: planned 0, partial paidAmount, paid full', () => {
    const month = normalizeMonth({
      fixedExpenses: [
        { id: 'f1', name: 'Rent', amount: 1000, type: 'Rent', place: 'bank', status: 'paid', payerMemberId: 'mouad' },
        { id: 'f2', name: 'Net', amount: 200, type: 'Internet', place: 'bank', status: 'planned', payerMemberId: 'mouad' },
        { id: 'f3', name: 'Gym', amount: 150, type: 'Gym', place: 'bank', status: 'partial', paidAmount: 50, payerMemberId: 'luigi' },
      ],
    }, '2026-09');
    const result = computeHouseholdContributions(month, members);
    assert.equal(result.rows[0].paid, 1000);
    assert.equal(result.rows[1].paid, 50);
    assert.equal(result.rows[0].balance, 475);
    assert.equal(result.rows[1].balance, -475);
  });

  it('excludes profile-role placeholders from rows and from the split', () => {
    const month = normalizeMonth({
      variableExpenses: [
        { id: 'e1', name: 'Kid', amount: 80, type: 'Other', date: '2026-09-01', place: 'bank', payerMemberId: 'kid-profile' },
        { id: 'e2', name: 'Mine', amount: 100, type: 'Other', date: '2026-09-02', place: 'bank', payerMemberId: 'mouad' },
      ],
    }, '2026-09');
    const roster = [...members, makeMember('kid-profile', { role: 'profile', displayName: 'Kid' })];
    const result = computeHouseholdContributions(month, roster);
    assert.equal(result.rows.length, 2);
    assert.equal(result.unattributedTotal, 80);
    assert.equal(result.rows[0].balance, 50);
    assert.equal(result.rows[1].balance, -50);
  });

  it('returns zero balances for an empty month and for a single member', () => {
    const empty = computeHouseholdContributions(normalizeMonth({}, '2026-09'), members);
    assert.deepEqual(empty.rows.map((r) => [r.paid, r.balance]), [[0, 0], [0, 0]]);
    assert.equal(empty.pooledTotal, 0);
    assert.equal(empty.unattributedTotal, 0);

    const month = normalizeMonth({
      variableExpenses: [
        { id: 'e1', name: 'Solo', amount: 999, type: 'Other', date: '2026-09-01', place: 'bank', payerMemberId: 'mouad' },
      ],
    }, '2026-09');
    const solo = computeHouseholdContributions(month, [mouad]);
    assert.equal(solo.rows[0].balance, 0);
  });

  it('keeps balances cent-precise on awkward splits', () => {
    const month = normalizeMonth({
      variableExpenses: [
        { id: 'e1', name: 'A', amount: 100.01, type: 'Other', date: '2026-09-01', place: 'bank', payerMemberId: 'mouad' },
        { id: 'e2', name: 'B', amount: 0.01, type: 'Other', date: '2026-09-02', place: 'bank', payerMemberId: 'luigi' },
      ],
    }, '2026-09');
    const result = computeHouseholdContributions(month, members);
    assert.equal(result.rows[0].balance, 50);
    assert.equal(result.rows[1].balance, -50);
  });
});
