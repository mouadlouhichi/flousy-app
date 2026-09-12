import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { householdPayerOptions, type HouseholdMember } from '../src/lib/household';

const labels = { me: 'Me', funds: 'Household funds' };
const member = (overrides: Partial<HouseholdMember>): HouseholdMember => ({
  id: 'm',
  displayName: 'Member',
  role: 'editor',
  status: 'active',
  avatarColor: '#000',
  ...overrides,
});

describe('householdPayerOptions', () => {
  it('shows only "Me" when the roster holds just the signed-in owner', () => {
    const roster = [member({ id: 'uid-mouad', userId: 'uid-mouad', displayName: 'Mouad', role: 'owner' })];
    assert.deepEqual(
      householdPayerOptions(roster, 'uid-mouad', labels).map((payer) => payer.id),
      ['self'],
    );
  });

  it('adds pooled funds and the other members once someone else shares the budget', () => {
    const roster = [
      member({ id: 'uid-mouad', userId: 'uid-mouad', displayName: 'Mouad', role: 'owner' }),
      member({ id: 'member-sara', userId: 'uid-sara', displayName: 'Sara' }),
      member({ id: 'member-kid', displayName: 'Kid', role: 'profile' }),
    ];
    const payers = householdPayerOptions(roster, 'uid-mouad', labels);
    assert.deepEqual(payers.map((payer) => payer.id), ['self', 'household', 'member-sara', 'member-kid']);
    assert.equal(payers[1].label, 'Household funds');
    assert.equal(payers[2].label, 'Sara');
  });

  it('skips invited and inactive rows', () => {
    const roster = [
      member({ id: 'uid-mouad', userId: 'uid-mouad', displayName: 'Mouad', role: 'owner' }),
      member({ id: 'member-pending', displayName: 'Pending', status: 'invited' }),
      member({ id: 'member-gone', displayName: 'Gone', status: 'inactive' }),
    ];
    assert.deepEqual(householdPayerOptions(roster, 'uid-mouad', labels).map((payer) => payer.id), ['self']);
  });

  it('recognises the owner by row id when the row predates userId', () => {
    const roster = [member({ id: 'uid-mouad', displayName: 'Mouad', role: 'owner' })];
    assert.deepEqual(householdPayerOptions(roster, 'uid-mouad', labels).map((payer) => payer.id), ['self']);
  });
});
