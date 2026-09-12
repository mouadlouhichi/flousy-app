import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  daratPhonesMatch,
  DARAT_MAX_MEMBERS,
  DARAT_MIN_MEMBERS,
  PHONE_RE,
  daratAllRoundDates,
  daratBuildRounds,
  daratCircleFromSnapshot,
  daratExpectedPot,
  daratFixedRecipient,
  daratNextRound,
  daratRandomOrder,
  daratRandomRecipient,
  daratResolveBid,
  daratRoundAmount,
  daratRoundDate,
  daratTotalRounds,
  isLooseDaratPhone,
  normalizeDaratCircle,
  normalizeDaratInvite,
  normalizeDaratMember,
  normalizeDaratRound,
  resolveDaratRoster,
  validateDaratCreate,
  type DaratCircle,
} from '../src/lib/darat';
import { buildDaratCreateDefaults } from '../src/lib/darat-firestore';

describe('darat: amounts & math', () => {
  it('round amounts to 2 decimals', () => {
    assert.equal(daratRoundAmount(1.234), 1.23);
    assert.equal(daratRoundAmount(1.236), 1.24);
    assert.equal(daratRoundAmount(0.1 + 0.2), 0.3);
    assert.equal(daratRoundAmount(NaN), 0);
  });

  it('computes the expected pot from contribution × members', () => {
    assert.equal(daratExpectedPot(500, 10), 5000);
    assert.equal(daratExpectedPot(333.333, 3), 1000); // 999.999 rounds up
    assert.equal(daratExpectedPot(-5, 5), 0);
  });

  it('enforces the documented member limits', () => {
    assert.equal(DARAT_MIN_MEMBERS, 2);
    assert.equal(DARAT_MAX_MEMBERS, 20);
  });
});

describe('darat: round dates', () => {
  it('returns the start date for round 1', () => {
    assert.equal(daratRoundDate('2026-09-15', 1, 'monthly'), '2026-09-15');
  });

  it('adds whole months for monthly frequency, preserving day-of-month', () => {
    assert.equal(daratRoundDate('2026-01-31', 2, 'monthly'), '2026-02-28');
    // A 12-round monthly circle ending in December of the same year.
    assert.equal(daratRoundDate('2026-01-15', 12, 'monthly'), '2026-12-15');
    // 13th round crosses the year boundary.
    assert.equal(daratRoundDate('2026-01-15', 13, 'monthly'), '2027-01-15');
  });

  it('adds weeks for weekly / biweekly', () => {
    assert.equal(daratRoundDate('2026-09-01', 2, 'weekly'), '2026-09-08');
    assert.equal(daratRoundDate('2026-09-01', 3, 'biweekly'), '2026-09-29');
  });

  it('schedules all rounds for a 10-member monthly circle', () => {
    const dates = daratAllRoundDates('2026-09-01', 10, 'monthly');
    assert.equal(dates.length, 10);
    assert.equal(dates[0], '2026-09-01');
    assert.equal(dates[9], '2027-06-01');
  });

  it('total rounds equals member count', () => {
    assert.equal(daratTotalRounds(['a', 'b', 'c', 'd']), 4);
    assert.equal(daratTotalRounds([]), 0);
  });
});

describe('darat: random rotation', () => {
  const members = ['a', 'b', 'c', 'd', 'e'];
  const seed = 'circle-2026';

  it('produces a deterministic permutation for the same seed', () => {
    const a = daratRandomOrder(members, seed);
    const b = daratRandomOrder(members, seed);
    assert.deepEqual(a, b);
  });

  it('is a permutation (same set, different order)', () => {
    const out = daratRandomOrder(members, seed);
    assert.equal(out.length, members.length);
    assert.deepEqual([...out].sort(), [...members].sort());
  });

  it('different seeds usually produce different orders', () => {
    const a = daratRandomOrder(members, 'seed-A');
    const b = daratRandomOrder(members, 'seed-B');
    assert.notDeepEqual(a, b);
  });

  it('randomRecipient returns a stable sequence from the order', () => {
    const order = ['a', 'b', 'c', 'd', 'e'];
    assert.equal(daratRandomRecipient(order, 1), 'a');
    assert.equal(daratRandomRecipient(order, 2), 'b');
    assert.equal(daratRandomRecipient(order, 5), 'e');
    assert.equal(daratRandomRecipient(order, 6), 'a'); // wraps (not used in practice, but stable)
  });
});

describe('darat: fixed-order rotation', () => {
  it('picks the agreed recipient by round number', () => {
    const order = ['x', 'y', 'z'];
    assert.equal(daratFixedRecipient(order, 1), 'x');
    assert.equal(daratFixedRecipient(order, 2), 'y');
    assert.equal(daratFixedRecipient(order, 3), 'z');
  });

  it('returns null when the order is empty', () => {
    assert.equal(daratFixedRecipient([], 1), null);
  });
});

describe('darat: bidding rotation', () => {
  const memberOrder = ['a', 'b', 'c', 'd'];
  const pot = 4000;

  it('lowest bid wins', () => {
    const result = daratResolveBid(
      { a: 200, b: 100, c: 300, d: 150 },
      pot,
      memberOrder,
    );
    assert.equal(result.winnerId, 'b');
    assert.equal(result.discount, 100);
    // 100 / 3 = 33.33..., rounded to 2 decimals
    assert.equal(result.redistribution.a, 33.33);
    assert.equal(result.redistribution.c, 33.33);
    assert.equal(result.redistribution.d, 33.33);
  });

  it('zero bid is allowed and wins against non-zero bids', () => {
    const result = daratResolveBid({ a: 0, b: 10 }, pot, memberOrder);
    assert.equal(result.winnerId, 'a');
    assert.equal(result.discount, 0);
    // All non-winners share the 0 discount equally → all get 0
    assert.deepEqual(result.redistribution, { b: 0, c: 0, d: 0 });
  });

  it('ties are broken by member order', () => {
    const result = daratResolveBid({ c: 50, a: 50, b: 200 }, pot, memberOrder);
    assert.equal(result.winnerId, 'a'); // a appears before c in memberOrder
  });

  it('the discount is capped at the pot', () => {
    // a bids the pot + something; b bids a tiny amount. a must still be the winner
    // (lower bid) and discount capped to pot.
    const result = daratResolveBid({ a: 0, b: 9999 }, pot, memberOrder);
    assert.equal(result.winnerId, 'a');
    assert.equal(result.discount, 0); // a bid 0, so no discount
    // Now flip: a bids 9999, b bids 0 → b wins (lowest) at 0, no cap needed.
    const flipped = daratResolveBid({ a: 9999, b: 0 }, pot, memberOrder);
    assert.equal(flipped.winnerId, 'b');
    assert.equal(flipped.discount, 0);
    // And the true cap: a bids pot + 100, b bids 0 — but b is lower, so a never wins.
    // Force a to win with everyone else equal: only a bids the cap and b matches.
    const tie = daratResolveBid({ a: pot + 100, b: pot + 100 }, pot, memberOrder);
    assert.equal(tie.winnerId, 'a'); // a wins by memberOrder tie-break
    assert.equal(tie.discount, pot); // capped
  });

  it('no bids yields a noBids result with no winner', () => {
    const result = daratResolveBid({}, pot, memberOrder);
    assert.equal(result.winnerId, null);
    assert.equal(result.noBids, true);
  });

  it('invalid bids are filtered out', () => {
    const result = daratResolveBid(
      { a: -1, b: NaN, c: Infinity, d: 75 } as Record<string, number>,
      pot,
      memberOrder,
    );
    assert.equal(result.winnerId, 'd');
  });
});

describe('darat: buildRounds', () => {
  const baseInput = {
    memberOrder: ['a', 'b', 'c', 'd'],
    startDate: '2026-09-15',
    frequency: 'monthly' as const,
    contribution: 500,
    rotation: 'random' as const,
    fixedOrder: null,
    randomSeed: 'circle-2026',
  };

  it('builds one round per member with the right pot', () => {
    const rounds = daratBuildRounds(baseInput);
    assert.equal(rounds.length, 4);
    assert.equal(rounds[0].pot, 2000);
    assert.equal(rounds[3].pot, 2000);
  });

  it('every member is the recipient of exactly one round (random)', () => {
    const rounds = daratBuildRounds(baseInput);
    const recipients = rounds.map((r) => r.recipientId).sort();
    assert.deepEqual(recipients, ['a', 'b', 'c', 'd']);
  });

  it('fixed rotation uses the agreed order', () => {
    const rounds = daratBuildRounds({
      ...baseInput,
      rotation: 'fixed',
      fixedOrder: ['c', 'a', 'd', 'b'],
    });
    assert.equal(rounds[0].recipientId, 'c');
    assert.equal(rounds[1].recipientId, 'a');
    assert.equal(rounds[2].recipientId, 'd');
    assert.equal(rounds[3].recipientId, 'b');
  });

  it('bidding rotation resolves the discount and sets it on the winning round', () => {
    const rounds = daratBuildRounds({
      ...baseInput,
      rotation: 'bidding',
      bidsByRound: {
        1: { a: 200, b: 50, c: 0, d: 300 },
      },
    });
    assert.equal(rounds[0].recipientId, 'c');
    assert.equal(rounds[0].discount, 0);
  });

  it('refuses to build a circle with fewer than 2 members', () => {
    const rounds = daratBuildRounds({ ...baseInput, memberOrder: ['a'] });
    assert.equal(rounds.length, 0);
  });

  it('every round initializes with pending payments for every member', () => {
    const rounds = daratBuildRounds(baseInput);
    for (const round of rounds) {
      for (const uid of baseInput.memberOrder) {
        assert.equal(round.payments[uid], 'pending');
      }
    }
  });
});

describe('darat: phone validation', () => {
  it('PHONE_RE is the loose, separator-tolerant pattern', () => {
    // The pattern itself: leading `+` optional, then 8+ allowed
    // characters. We don't unit-test the digit-count check here —
    // that lives in `isLooseDaratPhone` below — but we do verify
    // the pattern compiles and accepts the canonical shapes.
    assert.match('+212 6 12 34 56 78', PHONE_RE);
    assert.match('0612345678', PHONE_RE);
    assert.match('(212) 612-345-678', PHONE_RE);
    assert.doesNotMatch('abc', PHONE_RE);
  });

  it('isLooseDaratPhone accepts the documented shapes', () => {
    assert.equal(isLooseDaratPhone('+212 6 12 34 56 78'), true);
    assert.equal(isLooseDaratPhone('+212612345678'), true);
    assert.equal(isLooseDaratPhone('0612345678'), true);
    assert.equal(isLooseDaratPhone('(212) 612-345-678'), true);
    assert.equal(isLooseDaratPhone('+1-555-123-4567'), true);
  });

  it('isLooseDaratPhone rejects too-short and non-digit values', () => {
    assert.equal(isLooseDaratPhone(''), true); // empty is a "no value" — not a shape error
    assert.equal(isLooseDaratPhone('123'), false); // < 8 chars
    assert.equal(isLooseDaratPhone('+212 6 12'), false); // < 8 digits
    assert.equal(isLooseDaratPhone('abcdefgh'), false); // no digits
    assert.equal(isLooseDaratPhone('  +   --  '), false); // separators but no digits
  });

  it('isLooseDaratPhone tolerates whitespace, parentheses, dashes, and a leading +', () => {
    // Different cosmetic renderings of the same number all pass.
    for (const v of [
      '+212612345678',
      '+212 6 12 34 56 78',
      '(212) 612-345-678',
      '+1-555-123-4567',
      '  + 44 (0) 7700 900123  ',
    ]) {
      assert.equal(isLooseDaratPhone(v), true, `expected "${v}" to be a valid phone`);
    }
  });
});

describe('darat: validation', () => {
  const ok = {
    name: 'Family savings',
    contribution: 500,
    frequency: 'monthly' as const,
    rotation: 'random' as const,
    startDate: '2099-01-01',
    members: [{ displayName: 'M1', phone: '+212612345678' }],
    sourcePlaceId: 'bank',
    organizerEmail: 'organizer@example.com',
    currency: 'MAD',
  };

  it('accepts a valid input', () => {
    const r = validateDaratCreate(ok);
    assert.equal(r.ok, true);
  });

  it('rejects missing name', () => {
    const r = validateDaratCreate({ ...ok, name: '' });
    assert.equal(r.ok, false);
    assert.equal(r.error, 'nameRequired');
  });

  it('rejects zero contribution', () => {
    const r = validateDaratCreate({ ...ok, contribution: 0 });
    assert.equal(r.ok, false);
    assert.equal(r.error, 'amountInvalid');
  });

  it('rejects negative contribution', () => {
    const r = validateDaratCreate({ ...ok, contribution: -10 });
    assert.equal(r.ok, false);
    assert.equal(r.error, 'amountInvalid');
  });

  it('rejects too few members', () => {
    const r = validateDaratCreate({ ...ok, members: [] });
    assert.equal(r.ok, false);
    assert.equal(r.error, 'membersTooFew');
  });

  it('rejects too many members', () => {
    const many = Array.from({ length: 30 }, (_, i) => ({
      displayName: `M${i}`,
      phone: `+2126000000${String(i).padStart(2, '0')}`,
    }));
    const r = validateDaratCreate({ ...ok, members: many });
    assert.equal(r.ok, false);
    assert.equal(r.error, 'membersTooMany');
  });

  it('rejects malformed start date', () => {
    const r = validateDaratCreate({ ...ok, startDate: 'not-a-date' });
    assert.equal(r.ok, false);
    assert.equal(r.error, 'startDateInvalid');
  });

  it('rejects missing source place', () => {
    const r = validateDaratCreate({ ...ok, sourcePlaceId: '' });
    assert.equal(r.ok, false);
    assert.equal(r.error, 'placeRequired');
  });

  it('rejects missing organizer email', () => {
    const r = validateDaratCreate({ ...ok, organizerEmail: '' });
    assert.equal(r.ok, false);
    assert.equal(r.error, 'noOrganizer');
  });

  it('rejects past start dates', () => {
    const r = validateDaratCreate({ ...ok, startDate: '2020-01-01', nowMs: 1_700_000_000_000 });
    assert.equal(r.ok, false);
    assert.equal(r.error, 'startDateInvalid');
  });

  it('rejects a member with a malformed phone', () => {
    const r = validateDaratCreate({
      ...ok,
      members: [{ displayName: 'A', phone: 'abc' }],
    });
    assert.equal(r.ok, false);
    assert.equal(r.error, 'phoneFormat');
  });

  it('rejects a member with too few digits', () => {
    const r = validateDaratCreate({
      ...ok,
      members: [{ displayName: 'A', phone: '+212 6 12' }],
    });
    assert.equal(r.ok, false);
    assert.equal(r.error, 'phoneFormat');
  });

  it('rejects a member with an empty phone', () => {
    const r = validateDaratCreate({
      ...ok,
      members: [{ displayName: 'A', phone: '   ' }],
    });
    assert.equal(r.ok, false);
    assert.equal(r.error, 'phoneFormat');
  });

  it('accepts phones with common separators (spaces, dashes, parens)', () => {
    const r = validateDaratCreate({
      ...ok,
      members: [{ displayName: 'A', phone: '+212 (6) 12-34-56-78' }],
    });
    assert.equal(r.ok, true);
  });

  it('does not block the form when two invitees share a phone', () => {
    // The duplicate check moved to the client (per-row) form only;
    // the server is permissive because the join gate is the UUID
    // code, not the phone. Two family members reached only by code
    // should be a valid create.
    const r = validateDaratCreate({
      ...ok,
      members: [
        { displayName: 'A', phone: '+212 6 12 34 56 78' },
        { displayName: 'B', phone: '+212612345678' },
      ],
    });
    assert.equal(r.ok, true);
  });
});

describe('darat: normalizers', () => {
  it('fills missing fields on a circle from an older document', () => {
    const normalized = normalizeDaratCircle({
      id: 'c1',
      name: 'Old',
      organizerId: 'u1',
      contribution: 100,
      memberOrder: ['u1', 'u2'],
      // frequency, rotation, currency, etc. all missing
    });
    assert.equal(normalized.frequency, 'monthly');
    assert.equal(normalized.rotation, 'random');
    assert.equal(normalized.currency, 'MAD');
    assert.equal(normalized.status, 'active');
    assert.equal(normalized.closedAt, null);
    assert.equal(normalized.fixedOrder, null);
  });

  it('normalizes a round with missing fields', () => {
    const r = normalizeDaratRound({ number: 2, date: '2026-10-01' });
    assert.equal(r.recipientId, null);
    assert.equal(r.status, 'pending');
    assert.deepEqual(r.payments, {});
  });

  it('normalizes a payment status with a bogus value to pending', () => {
    const r = normalizeDaratRound({ number: 1, date: '2026-10-01', payments: { u1: 'busted' as never } });
    assert.equal(r.payments.u1, 'pending');
  });

  it('normalizes a member', () => {
    const m = normalizeDaratMember({ uid: 'u1' });
    assert.equal(m.status, 'active');
    assert.equal(m.isOrganizer, false);
    assert.equal(m.email, '');
    assert.equal(m.phone, '');
  });

  it('normalizes a member that already carries a phone', () => {
    const m = normalizeDaratMember({ uid: 'u1', phone: '+212 6 12 34 56 78' });
    assert.equal(m.phone, '+212 6 12 34 56 78');
  });

  it('normalizes an invite', () => {
    const inv = normalizeDaratInvite({ id: 'i1' });
    assert.equal(inv.status, 'pending');
    assert.equal(inv.acceptedAt, null);
    assert.equal(inv.phone, '');
  });
});

describe('darat: next round lookup', () => {
  const baseCircle: DaratCircle = normalizeDaratCircle({
    id: 'c1',
    name: 'Test',
    organizerId: 'u1',
    contribution: 100,
    frequency: 'monthly',
    rotation: 'fixed',
    startDate: '2026-01-01',
    fixedOrder: ['u1', 'u2', 'u3'],
    memberOrder: ['u1', 'u2', 'u3'],
  });
  const circle: DaratCircle = {
    ...baseCircle,
    rounds: daratBuildRounds({
      memberOrder: baseCircle.memberOrder,
      startDate: baseCircle.startDate,
      frequency: baseCircle.frequency,
      contribution: baseCircle.contribution,
      rotation: 'fixed',
      fixedOrder: baseCircle.fixedOrder,
      randomSeed: null,
    }),
  };

  it('finds the next round and flags the recipient correctly', () => {
    // Round 1 (Jan 1) is before today (Jan 15), so the next round is round 2 (Feb 1).
    // Round 2's recipient is fixedOrder[1] = 'u2'.
    const r = daratNextRound(circle, 'u2', '2026-01-15');
    assert.equal(r?.round.number, 2);
    assert.equal(r?.isRecipient, true);

    // u1 queries the same next round: they are not the recipient.
    const u1View = daratNextRound(circle, 'u1', '2026-01-15');
    assert.equal(u1View?.round.number, 2);
    assert.equal(u1View?.isRecipient, false);
  });

  it('returns round 1 when today equals the start date', () => {
    const r = daratNextRound(circle, 'u1', '2026-01-01');
    assert.equal(r?.round.number, 1);
    assert.equal(r?.isRecipient, true);
  });

  it('returns null when no round is upcoming', () => {
    const r = daratNextRound(circle, 'u1', '2030-01-01');
    assert.equal(r, null);
  });
});

describe('darat: roster resolution', () => {
  const organizer = normalizeDaratMember({ uid: 'uid-org', displayName: 'Organizer', isOrganizer: true, phone: '' });
  const joined = normalizeDaratMember({ uid: 'uid-amy', displayName: 'Amy', phone: '+212 6 12 34 56 78' });
  const circle = { organizerId: 'uid-org', memberOrder: ['uid-org', '+212612345678', '+212699999999'] };

  it('pairs phone placeholders with accepted member rows so names show', () => {
    const roster = resolveDaratRoster(circle, { [organizer.uid]: organizer, [joined.uid]: joined });
    assert.deepEqual(roster.map((entry) => entry.id), ['uid-org', 'uid-amy', '+212699999999']);
    assert.equal(roster[1].displayName, 'Amy');
    assert.equal(roster[1].joined, true);
    assert.equal(roster[2].joined, false);
    assert.equal(roster[2].status, 'invited');
  });

  it('flags organizer and left members', () => {
    const left = normalizeDaratMember({ uid: 'uid-amy', displayName: 'Amy', phone: '+212 6 12 34 56 78', status: 'left' });
    const roster = resolveDaratRoster(circle, { [organizer.uid]: organizer, [left.uid]: left });
    assert.equal(roster[0].isOrganizer, true);
    assert.equal(roster[1].status, 'left');
  });

  it('appends accepted members the order never referenced', () => {
    const extra = normalizeDaratMember({ uid: 'uid-zed', displayName: 'Zed', phone: '' });
    const roster = resolveDaratRoster(circle, { [organizer.uid]: organizer, [extra.uid]: extra });
    assert.deepEqual(roster.map((entry) => entry.id).slice(-1), ['uid-zed']);
  });

  it('does not mistake uids for phones', () => {
    const roster = resolveDaratRoster({ organizerId: 'uid-org', memberOrder: ['uid-org'] }, { [organizer.uid]: organizer });
    assert.equal(roster.length, 1);
    assert.equal(roster[0].joined, true);
  });
});

describe('darat: circle doc id integrity (create → read)', () => {
  const createInput = {
    name: 'Family savings',
    contribution: 500,
    frequency: 'monthly' as const,
    rotation: 'random' as const,
    startDate: '2099-01-01',
    members: [{ displayName: 'M1', phone: '+212612345678' }],
    sourcePlaceId: 'bank',
    organizerId: 'uid-org',
    organizerEmail: 'organizer@example.com',
    organizerDisplayName: 'Organizer',
    currency: 'MAD',
  };

  it('stamps the allocated circle id into the document body', () => {
    // Regression: the create path used to persist `id: ''` inside the
    // circle doc; every reader then saw `circle.id === ''`, the post-create
    // detail navigation failed with "Circle not found", and clicking the
    // card after a reload crashed with
    // `Invalid document reference … but circles has 1`.
    const { circle } = buildDaratCreateDefaults(createInput, 'circle_abc123');
    assert.equal(circle.id, 'circle_abc123');
  });

  it('refuses to build a body without an allocated circle id', () => {
    assert.throws(() => buildDaratCreateDefaults(createInput, ''));
  });

  it('organizer opt-out: memberOrder and rounds carry the invitees only', () => {
    // The owner can run a circle without a seat in the rotation: no
    // organizer entry in memberOrder, rounds over the invitees only.
    const { circle, rounds } = buildDaratCreateDefaults(
      { ...createInput, members: [
        { displayName: 'M1', phone: '+212612345678' },
        { displayName: 'M2', phone: '+212612345679' },
      ], organizerParticipates: false },
      'circle_optout',
    );
    assert.equal(circle.id, 'circle_optout');
    assert.ok(!circle.memberOrder.includes('uid-org'));
    assert.equal(circle.memberOrder.length, 2);
    assert.equal(rounds.length, 2);
  });

  it('organizer opt-out with fewer than 2 invitees is refused', () => {
    assert.throws(() =>
      buildDaratCreateDefaults({ ...createInput, organizerParticipates: false }, 'circle_bad'));
  });

  it('the snapshot id wins over a stored (possibly empty) id field', () => {
    // Circles created before the create-path fix still carry `id: ''`
    // inside the document. Reads must merge snapshot data first and stamp
    // the snapshot id last, or the stored field shadows the real id and
    // `doc(db, 'circles', '')` throws "… but circles has 1".
    const healed = daratCircleFromSnapshot('circle_real', { id: '', name: 'Legacy' });
    assert.equal(healed.id, 'circle_real');
    // A healthy doc keeps its path id even if the stored field disagreed.
    const healthy = daratCircleFromSnapshot('circle_real', { id: 'circle_other', name: 'X' });
    assert.equal(healthy.id, 'circle_real');
  });
});

describe('daratPhonesMatch', () => {
  it('matches local and international spellings of the same number', () => {
    assert.equal(daratPhonesMatch('0617337910', '+212617337910'), true);
    assert.equal(daratPhonesMatch('+212 617 337 910', '0617337910'), true);
    assert.equal(daratPhonesMatch('212617337910', '617337910'), true);
  });

  it('rejects different numbers and too-short inputs', () => {
    assert.equal(daratPhonesMatch('0617337910', '0664809073'), false);
    assert.equal(daratPhonesMatch('0617337910', '+212664809073'), false);
    assert.equal(daratPhonesMatch('123', '123'), false);
    assert.equal(daratPhonesMatch('', '0617337910'), false);
  });
});
