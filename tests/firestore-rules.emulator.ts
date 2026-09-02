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

    // Onboarding/bootstrap is create-only: re-entering the flow cannot replace
    // an established month even when it attempts a valid revision + ledger.
    const bootstrapOverwrite = writeBatch(db);
    bootstrapOverwrite.set(
      doc(db, 'users/alice/ledger/bootstrap-overwrite'),
      ledger('bootstrap-overwrite', 'alice', 'personal', 'alice', 2, 3, 'bootstrap'),
    );
    bootstrapOverwrite.update(monthRef, {
      totalBudget: 1,
      revision: 3,
      lastMutationId: 'bootstrap-overwrite',
    });
    await assertFails(bootstrapOverwrite.commit());
  });

  it('freezes a closed month until a state-only reopen is ledgered', async () => {
    const db = firestore(environment.authenticatedContext('alice', { email_verified: true }));
    const monthRef = doc(db, 'users/alice/months/2026-09');

    const create = writeBatch(db);
    create.set(doc(db, 'users/alice/ledger/lock-create'), ledger('lock-create', 'alice', 'personal', 'alice', 0, 1));
    create.set(monthRef, validMonth(1, 'lock-create'));
    await assertSucceeds(create.commit());

    const close = writeBatch(db);
    close.set(doc(db, 'users/alice/ledger/lock-close'), ledger('lock-close', 'alice', 'personal', 'alice', 1, 2, 'month-close'));
    close.update(monthRef, {
      periodStatus: 'closed',
      closedAt: new Date().toISOString(),
      closedByUserId: 'alice',
      revision: 2,
      lastMutationId: 'lock-close',
    });
    await assertSucceeds(close.commit());

    const editClosed = writeBatch(db);
    editClosed.set(doc(db, 'users/alice/ledger/locked-edit'), ledger('locked-edit', 'alice', 'personal', 'alice', 2, 3));
    editClosed.update(monthRef, { bankPart: 900, revision: 3, lastMutationId: 'locked-edit' });
    await assertFails(editClosed.commit());

    const unsafeReopen = writeBatch(db);
    unsafeReopen.set(doc(db, 'users/alice/ledger/unsafe-reopen'), ledger('unsafe-reopen', 'alice', 'personal', 'alice', 2, 3, 'month-reopen'));
    unsafeReopen.update(monthRef, {
      periodStatus: 'open',
      bankPart: 900,
      revision: 3,
      lastMutationId: 'unsafe-reopen',
    });
    await assertFails(unsafeReopen.commit());

    const reopen = writeBatch(db);
    reopen.set(doc(db, 'users/alice/ledger/lock-reopen'), ledger('lock-reopen', 'alice', 'personal', 'alice', 2, 3, 'month-reopen'));
    reopen.update(monthRef, {
      periodStatus: 'open',
      closedAt: deleteField(),
      closedByUserId: deleteField(),
      revision: 3,
      lastMutationId: 'lock-reopen',
    });
    await assertSucceeds(reopen.commit());

    const editOpen = writeBatch(db);
    editOpen.set(doc(db, 'users/alice/ledger/open-edit'), ledger('open-edit', 'alice', 'personal', 'alice', 3, 4));
    editOpen.update(monthRef, { bankPart: 900, revision: 4, lastMutationId: 'open-edit' });
    await assertSucceeds(editOpen.commit());
  });

  it('requires savings revisions to be coupled to a ledger row', async () => {
    const db = firestore(environment.authenticatedContext('alice', { email_verified: true }));
    const savingsRef = doc(db, 'users/alice/data/savings');
    await assertFails(setDoc(savingsRef, { goals: [], revision: 1, lastMutationId: 'none' }));
    const batch = writeBatch(db);
    batch.set(doc(db, 'users/alice/ledger/savings-1'), {
      ...ledger('savings-1', 'alice', 'personal', 'alice', 0, 1, 'savings-bootstrap'),
      monthKey: 'savings',
    });
    batch.set(savingsRef, { goals: [], revision: 1, lastMutationId: 'savings-1' });
    await assertSucceeds(batch.commit());

    const bootstrapOverwrite = writeBatch(db);
    bootstrapOverwrite.set(doc(db, 'users/alice/ledger/savings-bootstrap-overwrite'), {
      ...ledger('savings-bootstrap-overwrite', 'alice', 'personal', 'alice', 1, 2, 'savings-bootstrap'),
      monthKey: 'savings',
    });
    bootstrapOverwrite.update(savingsRef, { goals: [], revision: 2, lastMutationId: 'savings-bootstrap-overwrite' });
    await assertFails(bootstrapOverwrite.commit());

    const update = writeBatch(db);
    update.set(doc(db, 'users/alice/ledger/savings-update'), {
      ...ledger('savings-update', 'alice', 'personal', 'alice', 1, 2, 'savings'),
      monthKey: 'savings',
    });
    update.update(savingsRef, { goals: [], revision: 2, lastMutationId: 'savings-update' });
    await assertSucceeds(update.commit());
  });
});

describe('launch-trial entitlement rules', () => {
  it('allows one server-time-bounded 90-day claim and makes it immutable', async () => {
    await seed(async (db) => {
      await setDoc(doc(db, 'users/trial-user'), {
        plan: 'free', currency: 'MAD', onboardingComplete: true,
      });
    });
    const db = firestore(environment.authenticatedContext('trial-user', { email_verified: true }));

    await assertFails(updateDoc(doc(db, 'users/trial-user'), {
      plan: 'pro', proTrialClaimedAt: new Date().toISOString(),
    }));

    const startedAtMs = Date.now();
    const endsAtMs = startedAtMs + 90 * 24 * 60 * 60 * 1000;
    await assertSucceeds(updateDoc(doc(db, 'users/trial-user'), {
      plan: 'pro',
      entitlementSource: 'launch_trial',
      entitlementStatus: 'trialing',
      entitlementStartedAtMs: startedAtMs,
      entitlementEndsAtMs: endsAtMs,
    }));

    await assertFails(updateDoc(doc(db, 'users/trial-user'), {
      entitlementEndsAtMs: endsAtMs + 1,
    }));
    await assertFails(updateDoc(doc(db, 'users/trial-user'), {
      entitlementStatus: 'active',
    }));

    await assertSucceeds(setDoc(doc(db, 'households/trial-home'), {
      name: 'Trial Home', ownerId: 'trial-user', planOwnerId: 'trial-user',
      entitlementOwnerId: 'trial-user', entitlementSource: 'launch_trial',
      entitlementStatus: 'trialing', entitlementEndsAtMs: endsAtMs,
      currency: 'MAD', moneyPlaces: [{ id: 'bank', name: 'Bank', icon: 'account_balance' }],
      activeCategories: ['Groceries'], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    }));
  });

  it('rejects household creation for an expired trial projection', async () => {
    const expiredAtMs = Date.now() - 1;
    await seed(async (db) => {
      await setDoc(doc(db, 'users/expired-user'), {
        plan: 'pro', currency: 'MAD', onboardingComplete: true,
        entitlementSource: 'launch_trial', entitlementStatus: 'trialing',
        entitlementStartedAtMs: expiredAtMs - 90 * 24 * 60 * 60 * 1000,
        entitlementEndsAtMs: expiredAtMs,
      });
    });
    const db = firestore(environment.authenticatedContext('expired-user', { email_verified: true }));
    await assertFails(setDoc(doc(db, 'households/expired-home'), {
      name: 'Expired Home', ownerId: 'expired-user', planOwnerId: 'expired-user',
      entitlementOwnerId: 'expired-user', entitlementSource: 'launch_trial',
      entitlementStatus: 'trialing', entitlementEndsAtMs: expiredAtMs,
      currency: 'MAD', moneyPlaces: [{ id: 'bank', name: 'Bank', icon: 'account_balance' }],
      activeCategories: ['Groceries'], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    }));
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
      await setDoc(doc(db, 'users/owner'), {
        plan: 'pro', currency: 'MAD', onboardingComplete: true,
        entitlementSource: 'admin', entitlementStatus: 'active',
      });
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

  it('lets only the household owner close or reopen a shared period', async () => {
    await seedHousehold();
    const owner = firestore(environment.authenticatedContext('owner', { email_verified: true }));
    const editor = firestore(environment.authenticatedContext('editor', { email_verified: true }));
    const monthPath = 'households/home/months/2026-09';

    const close = writeBatch(owner);
    close.set(doc(owner, 'households/home/ledger/shared-close'), ledger('shared-close', 'owner', 'household', 'home', 1, 2, 'month-close'));
    close.update(doc(owner, monthPath), {
      periodStatus: 'closed',
      closedAt: new Date().toISOString(),
      closedByUserId: 'owner',
      revision: 2,
      lastMutationId: 'shared-close',
    });
    await assertSucceeds(close.commit());

    const editorReopen = writeBatch(editor);
    editorReopen.set(doc(editor, 'households/home/ledger/editor-reopen'), ledger('editor-reopen', 'editor', 'household', 'home', 2, 3, 'month-reopen'));
    editorReopen.update(doc(editor, monthPath), {
      periodStatus: 'open',
      closedAt: deleteField(),
      closedByUserId: deleteField(),
      revision: 3,
      lastMutationId: 'editor-reopen',
    });
    await assertFails(editorReopen.commit());

    const ownerReopen = writeBatch(owner);
    ownerReopen.set(doc(owner, 'households/home/ledger/shared-reopen'), ledger('shared-reopen', 'owner', 'household', 'home', 2, 3, 'month-reopen'));
    ownerReopen.update(doc(owner, monthPath), {
      periodStatus: 'open',
      closedAt: deleteField(),
      closedByUserId: deleteField(),
      revision: 3,
      lastMutationId: 'shared-reopen',
    });
    await assertSucceeds(ownerReopen.commit());
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
      await setDoc(doc(db, 'users/owner'), {
        plan: 'pro', currency: 'MAD', onboardingComplete: true,
        entitlementSource: 'admin', entitlementStatus: 'active',
      });
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
