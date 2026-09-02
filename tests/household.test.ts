import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  permissionsFor,
  canView,
  canEdit,
  type HouseholdArea,
} from '../src/lib/household-rbac';
import {
  householdStorageKey,
  actorForMonth,
  canShowProUpgrade,
  isProFeatureUnlocked,
} from '../src/lib/household';

const AREAS: HouseholdArea[] = [
  'dashboard', 'balances', 'expenses', 'savings', 'debts', 'invoices', 'settings', 'roles',
];

describe('Household RBAC permissions', () => {
  it('grants owners all permissions and prevents editors from managing roles', () => {
    const ownerPerms = permissionsFor('owner');
    const editorPerms = permissionsFor('editor');
    for (const area of AREAS) {
      assert.equal(ownerPerms[area], 'editAll');
      assert.equal(canEdit('owner', area), true);
      assert.equal(editorPerms[area], area === 'roles' ? 'view' : 'editAll');
    }
    assert.equal(canEdit('editor', 'roles'), false);
    assert.equal(canView('editor', 'roles'), true);
  });

  it('keeps viewers read-only and hides configuration and roles', () => {
    const viewerPerms = permissionsFor('viewer');
    for (const area of AREAS) {
      const expected = area === 'settings' || area === 'roles' ? 'hidden' : 'view';
      assert.equal(viewerPerms[area], expected);
      assert.equal(canEdit('viewer', area), false);
    }
    assert.equal(canView('viewer', 'dashboard'), true);
    assert.equal(canView('viewer', 'settings'), false);
  });

  it('restricts contributors to their own invoice boundary', () => {
    const contributorPerms = permissionsFor('contributor');
    assert.equal(contributorPerms.invoices, 'editOwn');
    for (const area of AREAS.filter((area) => area !== 'invoices')) {
      assert.equal(contributorPerms[area], 'hidden');
    }
    assert.equal(canEdit('contributor', 'invoices', undefined, false), false);
    assert.equal(canEdit('contributor', 'invoices', undefined, true), true);
    assert.equal(canView('contributor', 'expenses'), false);
  });

  it('does not honor legacy custom maps that Firestore cannot enforce', () => {
    const attemptedCustom = { dashboard: 'editAll' as const, savings: 'editAll' as const };
    assert.equal(canView('custom', 'dashboard', attemptedCustom), false);
    assert.equal(canEdit('custom', 'savings', attemptedCustom), false);
    assert.equal(canEdit('custom', 'invoices', attemptedCustom, true), true);
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

  it('canShowProUpgrade displays upgrade CTA only on private workspace', () => {
    assert.equal(canShowProUpgrade(false, 'personal'), true);
    assert.equal(canShowProUpgrade(false, undefined), true);
    assert.equal(canShowProUpgrade(false, 'household'), false);
    assert.equal(canShowProUpgrade(true, 'personal'), false);
  });

  it('isProFeatureUnlocked unlocks Pro features in household workspaces', () => {
    assert.equal(isProFeatureUnlocked(true, 'personal'), true);
    assert.equal(isProFeatureUnlocked(false, 'household'), true);
    assert.equal(isProFeatureUnlocked(false, 'personal'), false);
    assert.equal(isProFeatureUnlocked(false, undefined), false);
  });
});
