import { after, before, beforeEach, describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestContext,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';

const projectId = process.env.GCLOUD_PROJECT || 'smartjib-rules-test';
let environment: RulesTestEnvironment;

const validMonth = (revision = 1, mutationId = 'seed-mutation') => ({
  totalBudget: 1000,
  bankPart: 1000,
  homePart: 0,
  walletPart: 0,
  strategyId: '50-30-20',
  monthlySavingsTarget: 200,
  variableExpenses: [],
  fixedExpenses: [],
  activeCategories: ['Groceries'],
  revision,
  lastMutationId: mutationId,
  updatedAt: new Date().toISOString(),
});

const ledger = (
  mutationId: string,
  actorId: string,
  workspace: 'personal' | 'household',
  workspaceId: string,
  baseRevision: number,
  nextRevision: number,
  kind = 'month',
) => ({
  mutationId,
  actorId,
  workspace,
  workspaceId,
  monthKey: '2026-09',
  kind,
  baseRevision,
  nextRevision,
  createdAt: new Date().toISOString(),
});

function firestore(context: RulesTestContext): Firestore {
  return context.firestore() as unknown as Firestore;
}

async function seed(callback: (db: Firestore) => Promise<void>) {
  await environment.withSecurityRulesDisabled(async (context) => callback(firestore(context)));
}

before(async () => {
  environment = await initializeTestEnvironment({
    projectId,
    firestore: { rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8') },
  });
});

beforeEach(async () => {
  await environment.clearFirestore();
});

after(async () => {
  await environment.cleanup();
});

describe('revisioned personal finance rules', () => {
  it('requires an immutable ledger row and an exact revision increment', async () => {
    const db = firestore(environment.authenticatedContext('alice', { email: 'alice@example.com', email_verified: true }));
    const monthRef = doc(db, 'users/alice/months/2026-09');
    const firstLedger = doc(db, 'users/alice/ledger/create-1');
    const create = writeBatch(db);
    create.set(firstLedger, ledger('create-1', 'alice', 'personal', 'alice', 0, 1));
    create.set(monthRef, validMonth(1, 'create-1'));
    await assertSucceeds(create.commit());
    await assertFails(setDoc(
      doc(db, 'users/alice/ledger/orphan'),
      ledger('orphan', 'alice', 'personal', 'alice', 1, 2),
    ));
    await assertFails(deleteDoc(firstLedger));

    await assertFails(updateDoc(monthRef, { bankPart: 900, revision: 2, lastMutationId: 'missing-ledger' }));
    await assertFails(updateDoc(monthRef, { bankPart: 900, revision: 3, lastMutationId: 'create-1' }));

    const second = writeBatch(db);
    second.set(doc(db, 'users/alice/ledger/update-2'), ledger('update-2', 'alice', 'personal', 'alice', 1, 2));
    second.update(monthRef, { bankPart: 900, revision: 2, lastMutationId: 'update-2' });
    await assertSucceeds(second.commit());
    await assertFails(updateDoc(doc(db, 'users/alice/ledger/update-2'), { kind: 'rewritten' }));
  });

  it('requires savings revisions to be coupled to a ledger row', async () => {
    const db = firestore(environment.authenticatedContext('alice', { email_verified: true }));
    const savingsRef = doc(db, 'users/alice/data/savings');
    await assertFails(setDoc(savingsRef, { goals: [], revision: 1, lastMutationId: 'none' }));
    const batch = writeBatch(db);
    batch.set(doc(db, 'users/alice/ledger/savings-1'), {
      ...ledger('savings-1', 'alice', 'personal', 'alice', 0, 1, 'savings'),
      monthKey: 'savings',
    });
    batch.set(savingsRef, { goals: [], revision: 1, lastMutationId: 'savings-1' });
    await assertSucceeds(batch.commit());
  });
});

describe('household invitations and RBAC rules', () => {
  const household = {
    id: 'home',
    name: 'Home',
    ownerId: 'owner',
    planOwnerId: 'owner',
    entitlementOwnerId: 'owner',
    currency: 'MAD',
    moneyPlaces: [{ id: 'bank', name: 'Bank', icon: 'account_balance' }],
    activeCategories: ['Groceries'],
    monthStartDate: 1,
    createdAt: new Date().toISOString(),
  };

  async function seedHousehold() {
    await seed(async (db) => {
      await setDoc(doc(db, 'households/home'), household);
      for (const [uid, role] of [['owner', 'owner'], ['editor', 'editor'], ['viewer', 'viewer'], ['contributor', 'contributor']] as const) {
        await setDoc(doc(db, `households/home/members/${uid}`), {
          id: uid, userId: uid, email: `${uid}@example.com`, displayName: uid,
          role, status: 'active', joinedAt: new Date().toISOString(),
        });
      }
      await setDoc(doc(db, 'households/home/months/2026-09'), validMonth());
    });
  }

  it('allows viewers to read, blocks their writes, and hides finance from contributors', async () => {
    await seedHousehold();
    const viewer = firestore(environment.authenticatedContext('viewer', { email_verified: true }));
    const contributor = firestore(environment.authenticatedContext('contributor', { email_verified: true }));
    await assertSucceeds(getDoc(doc(viewer, 'households/home/months/2026-09')));
    await assertFails(updateDoc(doc(viewer, 'households/home/months/2026-09'), { bankPart: 1 }));
    await assertFails(getDoc(doc(contributor, 'households/home/months/2026-09')));
  });

  it('accepts only an unexpired, verified-email invitation in the same atomic batch', async () => {
    await seedHousehold();
    const invite = {
      id: 'invite-ok', householdId: 'home', memberId: 'pending-member',
      email: 'new@example.com', role: 'viewer', status: 'pending',
      createdBy: 'owner', createdAt: new Date().toISOString(),
      expiresAtMs: Date.now() + 60_000,
    };
    await seed(async (db) => { await setDoc(doc(db, 'householdInvites/invite-ok'), invite); });
    const recipient = firestore(environment.authenticatedContext('new-user', {
      email: 'new@example.com', email_verified: true,
    }));

    await assertFails(updateDoc(doc(recipient, 'householdInvites/invite-ok'), {
      status: 'accepted', acceptedAt: new Date().toISOString(),
      acceptedByUserId: 'new-user', acceptedEmail: 'new@example.com',
    }));

    const batch = writeBatch(recipient);
    batch.set(doc(recipient, 'households/home/members/new-user'), {
      id: 'new-user', userId: 'new-user', displayName: 'New', email: 'new@example.com',
      role: 'viewer', status: 'active', inviteId: 'invite-ok', joinedAt: new Date().toISOString(),
    });
    batch.update(doc(recipient, 'householdInvites/invite-ok'), {
      status: 'accepted', acceptedAt: new Date().toISOString(),
      acceptedByUserId: 'new-user', acceptedEmail: 'new@example.com',
    });
    await assertSucceeds(batch.commit());
  });

  it('rejects expired invitations and unverified recipients', async () => {
    await seedHousehold();
    const expired = {
      id: 'expired', householdId: 'home', memberId: 'pending-expired',
      email: 'late@example.com', role: 'editor', status: 'pending',
      createdBy: 'owner', createdAt: new Date().toISOString(), expiresAtMs: Date.now() - 1,
    };
    await seed(async (db) => { await setDoc(doc(db, 'householdInvites/expired'), expired); });
    for (const claims of [
      { email: 'late@example.com', email_verified: true },
      { email: 'late@example.com', email_verified: false },
    ]) {
      const db = firestore(environment.authenticatedContext('late-user', claims));
      const batch = writeBatch(db);
      batch.set(doc(db, 'households/home/members/late-user'), {
        id: 'late-user', userId: 'late-user', displayName: 'Late', email: 'late@example.com',
        role: 'editor', status: 'active', inviteId: 'expired', joinedAt: new Date().toISOString(),
      });
      batch.update(doc(db, 'householdInvites/expired'), {
        status: 'accepted', acceptedAt: new Date().toISOString(),
        acceptedByUserId: 'late-user', acceptedEmail: 'late@example.com',
      });
      await assertFails(batch.commit());
    }
  });
});

describe('atomic household invoice approval rules', () => {
  beforeEach(async () => {
    await seed(async (db) => {
      await setDoc(doc(db, 'households/home'), {
        name: 'Home', ownerId: 'owner', planOwnerId: 'owner', entitlementOwnerId: 'owner',
        currency: 'MAD', moneyPlaces: [{ id: 'bank', name: 'Bank', icon: 'account_balance' }],
        activeCategories: ['Groceries'], createdAt: new Date().toISOString(),
      });
      await setDoc(doc(db, 'households/home/members/owner'), {
        id: 'owner', userId: 'owner', email: 'owner@example.com', displayName: 'Owner', role: 'owner', status: 'active',
      });
      await setDoc(doc(db, 'households/home/members/contributor'), {
        id: 'contributor', userId: 'contributor', email: 'contributor@example.com', displayName: 'Contributor', role: 'contributor', status: 'active',
      });
      await setDoc(doc(db, 'households/home/months/2026-09'), validMonth());
      for (const id of ['invoice-only', 'invoice-atomic']) {
        await setDoc(doc(db, `households/home/invoices/${id}`), {
          id, name: 'Groceries', amount: 100, category: 'Groceries', date: '2026-09-02',
          place: 'bank', payerMemberId: 'contributor', submitterId: 'contributor',
          status: 'submitted', createdAt: new Date().toISOString(),
        });
      }
    });
  });

  it('rejects a status-only approval and accepts approval with its expense revision and ledger', async () => {
    const db = firestore(environment.authenticatedContext('owner', { email_verified: true }));
    await assertFails(updateDoc(doc(db, 'households/home/invoices/invoice-only'), {
      status: 'approved', reviewedAt: new Date().toISOString(), reviewedByUserId: 'owner',
      postedExpenseId: 'invoice-invoice-only', postedMonthKey: '2026-09',
    }));

    const mutationId = 'invoice-approval-invoice-atomic';
    const expense = {
      id: 'invoice-invoice-atomic', name: 'Groceries', amount: 100, type: 'Groceries',
      date: '2026-09-02', place: 'bank', sourceType: 'invoice', sourceId: 'invoice-atomic',
    };
    const batch = writeBatch(db);
    batch.set(doc(db, `households/home/ledger/${mutationId}`), ledger(mutationId, 'owner', 'household', 'home', 1, 2, 'invoice-approval'));
    batch.set(doc(db, 'households/home/months/2026-09'), {
      ...validMonth(2, mutationId), bankPart: 900, variableExpenses: [expense],
    });
    batch.update(doc(db, 'households/home/invoices/invoice-atomic'), {
      status: 'approved', reviewedAt: new Date().toISOString(), reviewedByUserId: 'owner',
      postedExpenseId: 'invoice-invoice-atomic', postedMonthKey: '2026-09',
    });
    await assertSucceeds(batch.commit());
  });
});

describe('90-day launch-trial claim rules', () => {
  const DAY_MS = 86_400_000;
  const TRIAL_MS = 90 * DAY_MS;

  const freeProfile = () => ({
    plan: 'free',
    currency: 'MAD',
    onboardingComplete: true,
  });

  const claim = (claimedAtMs: number) => ({
    plan: 'pro',
    planSource: 'launch_trial',
    proTrialClaimedAt: new Date(claimedAtMs).toISOString(),
    proTrialClaimedAtMs: claimedAtMs,
    proTrialEndsAtMs: claimedAtMs + TRIAL_MS,
  });

  const household = (ownerId: string) => ({
    name: 'Home', ownerId, planOwnerId: ownerId, entitlementOwnerId: ownerId,
    currency: 'MAD', moneyPlaces: [{ id: 'bank', name: 'Bank', icon: 'account_balance' }],
    activeCategories: ['Groceries'], createdAt: new Date().toISOString(),
  });

  it('accepts exactly the shaped claim and rejects every distortion of it', async () => {
    await seed(async (db) => setDoc(doc(db, 'users/tess'), freeProfile()));
    const db = firestore(environment.authenticatedContext('tess', { email: 'tess@example.com', email_verified: true }));
    const ref = doc(db, 'users/tess');
    const now = Date.now();

    // Wrong end stamp: 91 days instead of 90 — the client cannot buy itself time.
    await assertFails(updateDoc(ref, { ...claim(now), proTrialEndsAtMs: now + TRIAL_MS + DAY_MS }));
    // Backdated/forward-dated claim instant outside the 5-minute window.
    await assertFails(updateDoc(ref, claim(now - 6 * 60_000)));
    await assertFails(updateDoc(ref, claim(now + 6 * 60_000)));
    // Self-declared billing entitlement is not a thing a client can write.
    await assertFails(updateDoc(ref, { ...claim(now), planSource: 'billing' }));
    // Bare plan flip without the stamps stays forbidden.
    await assertFails(updateDoc(ref, { plan: 'pro' }));
    // Missing the ms twin.
    await assertFails(updateDoc(ref, {
      plan: 'pro', planSource: 'launch_trial',
      proTrialClaimedAt: new Date(now).toISOString(), proTrialEndsAtMs: now + TRIAL_MS,
    }));
    // The exact claim shape near server time succeeds.
    await assertSucceeds(updateDoc(ref, claim(Date.now())));
  });

  it('freezes the trial stamps after the claim — no extension, no re-claim', async () => {
    const claimedAtMs = Date.now() - 10 * DAY_MS;
    await seed(async (db) => setDoc(doc(db, 'users/tess'), { ...freeProfile(), ...claim(claimedAtMs) }));
    const db = firestore(environment.authenticatedContext('tess', { email: 'tess@example.com', email_verified: true }));
    const ref = doc(db, 'users/tess');

    // Any attempt to move the window is refused…
    await assertFails(updateDoc(ref, { proTrialEndsAtMs: claimedAtMs + 2 * TRIAL_MS }));
    await assertFails(updateDoc(ref, { proTrialClaimedAtMs: Date.now() }));
    await assertFails(updateDoc(ref, { planSource: 'billing' }));
    // …including erasing the stamps to claim again.
    await assertFails(updateDoc(ref, { proTrialEndsAtMs: deleteField() }));
    // Unrelated profile edits still work while the stamps ride along unchanged.
    await assertSucceeds(updateDoc(ref, { onboardingComplete: true }));
  });

  it('lets an active trial create a household and blocks a lapsed one', async () => {
    const activeClaim = claim(Date.now() - DAY_MS);
    const lapsedClaim = claim(Date.now() - 91 * DAY_MS);
    await seed(async (db) => {
      await setDoc(doc(db, 'users/active-triallist'), { ...freeProfile(), ...activeClaim });
      await setDoc(doc(db, 'users/lapsed-triallist'), { ...freeProfile(), ...lapsedClaim });
      await setDoc(doc(db, 'users/billing-pro'), { ...freeProfile(), plan: 'pro', planSource: 'billing' });
    });

    const active = firestore(environment.authenticatedContext('active-triallist', { email_verified: true }));
    await assertSucceeds(setDoc(doc(active, 'households/active-home'), household('active-triallist')));

    // plan still reads 'pro', but the window has passed: entitlement is gone.
    const lapsed = firestore(environment.authenticatedContext('lapsed-triallist', { email_verified: true }));
    await assertFails(setDoc(doc(lapsed, 'households/lapsed-home'), household('lapsed-triallist')));

    // A billing-sourced entitlement (Admin SDK write, no window) never lapses.
    const billing = firestore(environment.authenticatedContext('billing-pro', { email_verified: true }));
    await assertSucceeds(setDoc(doc(billing, 'households/billing-home'), household('billing-pro')));
  });
});
