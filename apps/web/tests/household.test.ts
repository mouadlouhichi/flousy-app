import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  HOUSEHOLD_AREAS,
  permissionsFor,
  canView,
  canEdit,
  SCREEN_AREA,
  type HouseholdArea,
  type HouseholdPermissions,
} from '../src/lib/household-rbac';
import {
  householdStorageKey,
  actorForMonth,
  canShowProUpgrade,
  isProFeatureUnlocked,
  type HouseholdRole,
} from '../src/lib/household';

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
