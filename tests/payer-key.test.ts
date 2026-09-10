import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { localizePersonName, payerKey } from '../src/lib/localized-labels';
import en from '../messages/en.json';
import fr from '../messages/fr.json';
import ar from '../messages/ar.json';
import type { Messages } from '../src/lib/i18n-core';

/**
 * Regression: the Household Member Spending card showed two "Self" rows.
 * The expense modal stores the LOCALIZED payer label ("Me" / "Moi" / "أنا")
 * as `person`, older rows carry "Self", and imports may carry the id — all of
 * which are the same person and must collapse to one key.
 */
describe('payerKey', () => {
  it('collapses every self spelling to one key', () => {
    for (const label of [undefined, '', 'Self', 'self', 'Me', 'me', 'Moi', 'أنا']) {
      assert.equal(payerKey(label), 'self', `label ${JSON.stringify(label)}`);
    }
    assert.equal(payerKey('Me', 'self'), 'self');
    assert.equal(payerKey(undefined, 'self'), 'self');
  });

  it('prefers the stable member id over the display-name snapshot', () => {
    assert.equal(payerKey('Sara', 'member-42'), 'member-42');
    assert.equal(payerKey('Sara'), 'Sara');
  });

  it('recognises pooled household money in every locale', () => {
    assert.equal(payerKey(en.household.funds), 'household');
    assert.equal(payerKey(fr.household.funds), 'household');
    assert.equal(payerKey(ar.household.funds), 'household');
    assert.equal(payerKey('x', 'household'), 'household');
  });

  it('localizes the self aliases with the current catalog', () => {
    assert.equal(localizePersonName('Me', fr as unknown as Messages), fr.modals.expense.self);
    assert.equal(localizePersonName('Moi', en as unknown as Messages), en.modals.expense.self);
    assert.equal(localizePersonName('Household funds', fr as unknown as Messages), fr.household.funds);
    assert.equal(localizePersonName('Sara', en as unknown as Messages), 'Sara');
  });
});
