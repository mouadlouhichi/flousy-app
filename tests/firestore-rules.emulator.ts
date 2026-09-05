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
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';
import { normalizeMonth, type MonthBudget } from '../src/lib/store';

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
  // The month the mutation advances: `mutationTargetAgrees` refuses a row
  // whose month does not name it back, so a row replayed for any other month
  // must say so - exactly as the client's outbox does.
  monthKey = '2026-09',
) => ({
  mutationId,
  actorId,
  workspace,
  workspaceId,
  monthKey,
  kind,
  baseRevision,
  nextRevision,
  createdAt: new Date().toISOString(),
});

function firestore(context: RulesTestContext): Firestore {
  return context.firestore() as unknown as Firestore;
}

/**
 * A context this product can actually produce.
 *
 * `verifiedEmail()` reads `request.auth.token.email` and `email_verified` as required
 * claims on purpose: the app signs people in with a password or Google, so a caller
 * without them is not a user, and the rule must not read "no claim" as "some other
 * address". The consequence for this file is sharp - a context missing the claim does not
 * fail the way a wrong password fails, it aborts the whole rule and the client receives a
 * bare permission-denied. Every emulated user therefore goes through here.
 */
function asUser(uid: string, claims: Record<string, unknown> = {}): Firestore {
  return firestore(environment.authenticatedContext(uid, {
    email: `${uid}@example.com`,
    email_verified: true,
    ...claims,
  }));
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
    const db = asUser('alice');
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
    const db = asUser('alice');
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
    const db = asUser('alice');
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
    const db = asUser('trial-user');

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
    const db = asUser('expired-user');
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

  it('lets a launch-trial Pro user create a household and their own owner row in one batch', async () => {
    // The exact flow that was broken in production. `memberCreateAuthorized`
    // folded three branches into one expression costing ~1034, over the
    // 1000-expression cap, so the engine refused the batch with a bare
    // permission-denied before evaluating any branch — and the founding owner,
    // who needs only the household root, was paying for the invitation
    // machinery of a branch that could never apply to them.
    const nowMs = Date.now();
    await seed(async (db) => {
      await setDoc(doc(db, 'users/founder'), {
        plan: 'pro', currency: 'MAD', onboardingComplete: true,
        entitlementSource: 'launch_trial', entitlementStatus: 'trialing',
        entitlementStartedAtMs: nowMs, entitlementEndsAtMs: nowMs + 7_776_000_000,
        displayName: 'Founder', monthStartDate: 27,
      });
    });
    const founder = asUser('founder', { email: 'founder@example.com' });
    const batch = writeBatch(founder);
    batch.set(doc(founder, 'households/fresh'), {
      name: 'Founder Home',
      ownerId: 'founder',
      planOwnerId: 'founder',
      entitlementOwnerId: 'founder',
      entitlementSource: 'launch_trial',
      entitlementStatus: 'trialing',
      entitlementEndsAtMs: nowMs + 7_776_000_000,
      currency: 'MAD',
      monthStartDate: 27,
      moneyPlaces: [{ id: 'bank', name: 'Bank', icon: 'account_balance' }],
      activeCategories: ['Groceries'],
      onboardingComplete: false,
      schemaVersion: 2,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    batch.set(doc(founder, 'households/fresh/members/founder'), {
      id: 'founder', userId: 'founder', displayName: 'Founder',
      email: 'founder@example.com', role: 'owner', status: 'active',
      avatarColor: '#00685f', joinedAt: new Date().toISOString(),
    });
    await assertSucceeds(batch.commit());
  });

  it('still refuses a self-authored owner row in a household somebody else owns', async () => {
    await seedHousehold();
    const intruder = asUser('intruder', { email: 'intruder@example.com' });
    await assertFails(setDoc(doc(intruder, 'households/home/members/intruder'), {
      id: 'intruder', userId: 'intruder', displayName: 'Intruder',
      email: 'intruder@example.com', role: 'owner', status: 'active',
      joinedAt: new Date().toISOString(),
    }));
  });

  it('allows viewers to read, blocks their writes, and hides finance from contributors', async () => {
    await seedHousehold();
    const viewer = asUser('viewer');
    const contributor = asUser('contributor');
    await assertSucceeds(getDoc(doc(viewer, 'households/home/months/2026-09')));
    await assertFails(updateDoc(doc(viewer, 'households/home/months/2026-09'), { bankPart: 1 }));
    await assertFails(getDoc(doc(contributor, 'households/home/months/2026-09')));
  });

  it('lets an owner import months, flush the outbox and tear the workspace down', async () => {
    // The three flows a real owner reported as broken, in the order they run.
    // None of them was an authorization failure: the month rules folded every
    // writer kind into one expression costing ~1574, over the 1000-expression
    // per-request cap, so the engine refused them before evaluating anything.
    await seedHousehold();
    const owner = asUser('owner');

    // 1. Import: create a month document that does not exist yet.
    const importBatch = writeBatch(owner);
    importBatch.set(doc(owner, 'households/home/ledger/import-1'),
      ledger('import-1', 'owner', 'household', 'home', 0, 1, 'month', '2026-08'));
    importBatch.set(doc(owner, 'households/home/months/2026-08'), validMonth(1, 'import-1'));
    await assertSucceeds(importBatch.commit());

    // 2. Sync: an ordinary edit to an open period, which is what an outbox
    //    flush replays. This is the write the import failure cascaded from.
    const flush = writeBatch(owner);
    flush.set(doc(owner, 'households/home/ledger/flush-1'),
      ledger('flush-1', 'owner', 'household', 'home', 1, 2, 'month', '2026-08'));
    flush.update(doc(owner, 'households/home/months/2026-08'), {
      bankPart: 900, totalBudget: 1000, revision: 2, lastMutationId: 'flush-1',
      updatedAt: new Date().toISOString(),
    });
    await assertSucceeds(flush.commit());

    // 3. Teardown: the owner deletes month documents, then the household root.
    await assertSucceeds(deleteDoc(doc(owner, 'households/home/months/2026-08')));
    await assertSucceeds(deleteDoc(doc(owner, 'households/home/months/2026-09')));
    await assertSucceeds(deleteDoc(doc(owner, 'households/home')));
  });

  it('lets an editor make an ordinary shared-month edit', async () => {
    await seedHousehold();
    const editor = asUser('editor');
    const batch = writeBatch(editor);
    batch.set(doc(editor, 'households/home/ledger/editor-edit'),
      ledger('editor-edit', 'editor', 'household', 'home', 1, 2, 'month'));
    batch.update(doc(editor, 'households/home/months/2026-09'), {
      bankPart: 800, revision: 2, lastMutationId: 'editor-edit',
      updatedAt: new Date().toISOString(),
    });
    await assertSucceeds(batch.commit());
  });

  it('still refuses a viewer and a non-member the same shared-month edit', async () => {
    await seedHousehold();
    for (const uid of ['viewer', 'contributor', 'stranger']) {
      const db = asUser(uid);
      const batch = writeBatch(db);
      batch.set(doc(db, `households/home/ledger/${uid}-edit`),
        ledger(`${uid}-edit`, uid, 'household', 'home', 1, 2, 'month'));
      batch.update(doc(db, 'households/home/months/2026-09'), {
        bankPart: 1, revision: 2, lastMutationId: `${uid}-edit`,
      });
      await assertFails(batch.commit());
    }
  });

  it('lets only the household owner close or reopen a shared period', async () => {
    await seedHousehold();
    const owner = asUser('owner');
    const editor = asUser('editor');
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

  it('accepts the close/reopen the client actually sends: full-document set in a transaction', async () => {
    // commitFinanceMutation() writes the WHOLE month document with set(), never
    // a key patch — so the close/reopen branches must accept that shape. The
    // tests above only proved patches; a rule that demands patch-shaped writes
    // would pass them and still refuse every real close from the app with a
    // bare permission-denied the client can only report as "rules behind".
    await seedHousehold();
    const owner = asUser('owner');
    const monthRef = doc(owner, 'households/home/months/2026-09');

    const closeMonth = {
      ...validMonth(2, 'owner-close'),
      periodStatus: 'closed',
      closedAt: new Date().toISOString(),
      closedByUserId: 'owner',
      updatedByUserId: 'owner',
    };
    await assertSucceeds(runTransaction(owner, async (tx) => {
      tx.set(doc(owner, 'households/home/ledger/owner-close'),
        ledger('owner-close', 'owner', 'household', 'home', 1, 2, 'month-close'));
      tx.set(monthRef, closeMonth);
    }));

    // A close smuggling a finance change is not a state-only transition, even
    // when it arrives as a full document: periodStateOnly() must refuse it.
    await assertFails(runTransaction(owner, async (tx) => {
      tx.set(doc(owner, 'households/home/ledger/owner-dirty-close'),
        ledger('owner-dirty-close', 'owner', 'household', 'home', 2, 3, 'month-close'));
      tx.set(monthRef, { ...closeMonth, bankPart: 1, revision: 3, lastMutationId: 'owner-dirty-close' });
    }));

    // Reopen as a full-document set with the lock fields absent entirely.
    const reopenMonth = {
      ...validMonth(3, 'owner-reopen'),
      periodStatus: 'open',
      updatedByUserId: 'owner',
    };
    await assertSucceeds(runTransaction(owner, async (tx) => {
      tx.set(doc(owner, 'households/home/ledger/owner-reopen'),
        ledger('owner-reopen', 'owner', 'household', 'home', 2, 3, 'month-reopen'));
      tx.set(monthRef, reopenMonth);
    }));
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
    const recipient = asUser('new-user', { email: 'new@example.com' });

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
      const db = asUser('late-user', claims);
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
    const db = asUser('owner');
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


describe('custom role per-area grant rules', () => {
  const memberDoc = (uid: string, extra: Record<string, unknown> = {}) => ({
    id: uid, userId: uid, email: `${uid}@example.com`, displayName: uid,
    role: 'custom', status: 'active', joinedAt: new Date().toISOString(), ...extra,
  });

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
        id: 'owner', userId: 'owner', email: 'owner@example.com',
        displayName: 'Owner', role: 'owner', status: 'active',
      });
      // Expense clerk: may record spending (and the balance movement it causes)
      // but must not touch budgets, transfers, savings, or debts.
      await setDoc(doc(db, 'households/home/members/clerk'), memberDoc('clerk', {
        permissions: { dashboard: 'view', expenses: 'editAll', invoices: 'editOwn' },
      }));
      // Savings-only member.
      await setDoc(doc(db, 'households/home/members/saver'), memberDoc('saver', {
        permissions: { savings: 'editAll' },
      }));
      // Invoice-only member: no finance grant at all.
      await setDoc(doc(db, 'households/home/members/runner'), memberDoc('runner', {
        permissions: { invoices: 'editOwn' },
      }));
      // Legacy custom member whose document never stored a matrix.
      await setDoc(doc(db, 'households/home/members/legacy'), memberDoc('legacy'));
      await setDoc(doc(db, 'households/home/months/2026-09'), validMonth());
    });
  });

  it('opens finance reads only to custom members holding a finance grant', async () => {
    const clerk = asUser('clerk');
    const runner = asUser('runner');
    const legacy = asUser('legacy');
    await assertSucceeds(getDoc(doc(clerk, 'households/home/months/2026-09')));
    await assertFails(getDoc(doc(runner, 'households/home/months/2026-09')));
    await assertFails(getDoc(doc(legacy, 'households/home/months/2026-09')));
  });

  it('lets an expenses grant record spending with its balance movement, and nothing else', async () => {
    const clerk = asUser('clerk');
    const monthRef = doc(clerk, 'households/home/months/2026-09');
    const expense = {
      id: 'exp-1', name: 'Groceries', amount: 100, type: 'Groceries',
      date: '2026-09-02', place: 'bank',
    };

    // Granted: variableExpenses + derived balance split + sync bookkeeping.
    const spend = writeBatch(clerk);
    spend.set(doc(clerk, 'households/home/ledger/clerk-spend'), ledger('clerk-spend', 'clerk', 'household', 'home', 1, 2));
    spend.set(monthRef, { ...validMonth(2, 'clerk-spend'), bankPart: 900, variableExpenses: [expense] });
    await assertSucceeds(spend.commit());

    // Not granted: rewriting the budget (balances area).
    const budget = writeBatch(clerk);
    budget.set(doc(clerk, 'households/home/ledger/clerk-budget'), ledger('clerk-budget', 'clerk', 'household', 'home', 2, 3));
    budget.set(monthRef, { ...validMonth(3, 'clerk-budget'), bankPart: 900, variableExpenses: [expense], totalBudget: 9999 });
    await assertFails(budget.commit());

    // Not granted: debts.
    const debts = writeBatch(clerk);
    debts.set(doc(clerk, 'households/home/ledger/clerk-debts'), ledger('clerk-debts', 'clerk', 'household', 'home', 2, 3));
    debts.set(monthRef, {
      ...validMonth(3, 'clerk-debts'), bankPart: 900, variableExpenses: [expense],
      debts: [{ id: 'd1', name: 'Loan', amount: 50 }],
    });
    await assertFails(debts.commit());

    // Not granted: closing the period (owner/editor ledger kind + state keys).
    const close = writeBatch(clerk);
    close.set(doc(clerk, 'households/home/ledger/clerk-close'), ledger('clerk-close', 'clerk', 'household', 'home', 2, 3, 'month-close'));
    close.update(monthRef, {
      periodStatus: 'closed', closedAt: new Date().toISOString(), closedByUserId: 'clerk',
      revision: 3, lastMutationId: 'clerk-close',
    });
    await assertFails(close.commit());
  });

  it('scopes the savings grant to savings keys and the savings document', async () => {
    const saver = asUser('saver');
    const clerk = asUser('clerk');
    const monthRef = doc(saver, 'households/home/months/2026-09');

    // Granted: a savings deposit moves money out of the wallet split.
    const deposit = writeBatch(saver);
    deposit.set(doc(saver, 'households/home/ledger/saver-deposit'), ledger('saver-deposit', 'saver', 'household', 'home', 1, 2));
    deposit.set(monthRef, {
      ...validMonth(2, 'saver-deposit'), bankPart: 900,
      savingsActivity: [{ id: 's1', amount: 100, date: '2026-09-02', kind: 'deposit' }],
    });
    await assertSucceeds(deposit.commit());

    // Not granted: expense rows.
    const spend = writeBatch(saver);
    spend.set(doc(saver, 'households/home/ledger/saver-spend'), ledger('saver-spend', 'saver', 'household', 'home', 2, 3));
    spend.set(monthRef, {
      ...validMonth(3, 'saver-spend'), bankPart: 800,
      savingsActivity: [{ id: 's1', amount: 100, date: '2026-09-02', kind: 'deposit' }],
      variableExpenses: [{ id: 'exp-2', name: 'Cafe', amount: 20, type: 'Groceries', date: '2026-09-02', place: 'bank' }],
    });
    await assertFails(spend.commit());

    // The savings goals document follows the same grant.
    const goals = writeBatch(saver);
    goals.set(doc(saver, 'households/home/ledger/saver-goals'), {
      ...ledger('saver-goals', 'saver', 'household', 'home', 0, 1, 'savings-bootstrap'), monthKey: 'savings',
    });
    goals.set(doc(saver, 'households/home/data/savings'), { goals: [], revision: 1, lastMutationId: 'saver-goals' });
    await assertSucceeds(goals.commit());

    const clerkGoals = writeBatch(clerk);
    clerkGoals.set(doc(clerk, 'households/home/ledger/clerk-goals'), {
      ...ledger('clerk-goals', 'clerk', 'household', 'home', 1, 2, 'savings'), monthKey: 'savings',
    });
    clerkGoals.set(doc(clerk, 'households/home/data/savings'), { goals: [], revision: 2, lastMutationId: 'clerk-goals' });
    await assertFails(clerkGoals.commit());
  });

  it('gates invoice submission on the invoices grant', async () => {
    const invoice = (id: string, submitterId: string) => ({
      id, name: 'Groceries', amount: 50, category: 'Groceries', date: '2026-09-02',
      place: 'bank', submitterId, status: 'submitted', createdAt: new Date().toISOString(),
    });
    const runner = asUser('runner');
    await assertSucceeds(setDoc(doc(runner, 'households/home/invoices/inv-runner'), invoice('inv-runner', 'runner')));
    // No invoices grant on the saver matrix.
    const saver = asUser('saver');
    await assertFails(setDoc(doc(saver, 'households/home/invoices/inv-saver'), invoice('inv-saver', 'saver')));
    // Legacy custom member without a stored map gets nothing server-side.
    const legacy = asUser('legacy');
    await assertFails(setDoc(doc(legacy, 'households/home/invoices/inv-legacy'), invoice('inv-legacy', 'legacy')));
  });

  it('accepts only well-formed permission maps written by the owner', async () => {
    const owner = asUser('owner');
    const memberRef = doc(owner, 'households/home/members/clerk');
    await assertSucceeds(updateDoc(memberRef, { permissions: { expenses: 'editAll', invoices: 'editOwn' } }));
    // Unknown level, unknown area, and over-broad management grants all fail.
    await assertFails(updateDoc(memberRef, { permissions: { expenses: 'superuser' } }));
    await assertFails(updateDoc(memberRef, { permissions: { vault: 'editAll' } }));
    await assertFails(updateDoc(memberRef, { permissions: { members: 'editAll' } }));
    await assertFails(updateDoc(memberRef, { permissions: { invoices: 'editAll' } }));
    // A custom member cannot rewrite their own grants.
    const clerk = asUser('clerk');
    await assertFails(updateDoc(doc(clerk, 'households/home/members/clerk'), {
      permissions: { expenses: 'editAll', balances: 'editAll' },
    }));
  });

  it('binds invitation acceptance to the exact invited permission map', async () => {
    const invitePermissions = { expenses: 'editAll', invoices: 'editOwn' };
    await seed(async (db) => {
      await setDoc(doc(db, 'householdInvites/invite-custom'), {
        id: 'invite-custom', householdId: 'home', memberId: 'pending-custom',
        email: 'joiner@example.com', role: 'custom', permissions: invitePermissions,
        status: 'pending', createdBy: 'owner', createdAt: new Date().toISOString(),
        expiresAtMs: Date.now() + 60_000,
      });
    });
    const joiner = asUser('joiner', { email: 'joiner@example.com' });
    const accept = (permissions: Record<string, string>) => {
      const batch = writeBatch(joiner);
      batch.set(doc(joiner, 'households/home/members/joiner'), {
        id: 'joiner', userId: 'joiner', displayName: 'Joiner', email: 'joiner@example.com',
        role: 'custom', permissions, status: 'active', inviteId: 'invite-custom',
        joinedAt: new Date().toISOString(),
      });
      batch.update(doc(joiner, 'householdInvites/invite-custom'), {
        status: 'accepted', acceptedAt: new Date().toISOString(),
        acceptedByUserId: 'joiner', acceptedEmail: 'joiner@example.com',
      });
      return batch.commit();
    };
    // Self-elevated variation of the invited grants is rejected.
    await assertFails(accept({ ...invitePermissions, balances: 'editAll' }));
    await assertSucceeds(accept(invitePermissions));
  });
});

describe('household plan-owner authorization and recovery', () => {
  const DAY_MS = 24 * 60 * 60 * 1000;
  const proProfile = {
    plan: 'pro', currency: 'MAD', onboardingComplete: true,
    entitlementSource: 'admin', entitlementStatus: 'active',
  };

  const householdDoc = (extra: Record<string, unknown> = {}) => ({
    name: 'Home', ownerId: 'owner', planOwnerId: 'owner', entitlementOwnerId: 'owner',
    currency: 'MAD', moneyPlaces: [{ id: 'bank', name: 'Bank', icon: 'account_balance' }],
    activeCategories: ['Groceries'], createdAt: new Date().toISOString(), ...extra,
  });

  /**
   * One finance write: an immutable ledger row and the month it advances.
   *
   * The month is *updated*, never `set()`: `allow create` on a month demands
   * `revision == 1`, so an overwrite of an existing period would be refused for
   * a reason that has nothing to do with what these cases are about.
   */
  function monthWrite(db: Firestore, actorId: string, monthRefPath: string, revision = 2) {
    const mutationId = `write-${actorId}-${revision}`;
    const batch = writeBatch(db);
    batch.set(doc(db, `households/home/ledger/${mutationId}`), ledger(mutationId, actorId, 'household', 'home', revision - 1, revision));
    batch.update(doc(db, monthRefPath), { bankPart: 900, revision, lastMutationId: mutationId });
    return batch.commit();
  }

  async function seedShared(callback: (db: Firestore) => Promise<void>) {
    await seed(async (db) => {
      await callback(db);
      await setDoc(doc(db, 'households/home/months/2026-09'), validMonth());
    });
  }

  it('authorizes a household whose document never stored a plan owner', async () => {
    // Legacy shape (and the casing a console edit leaves behind): the rules used
    // to abort on `.data.entitlementOwnerId` and `.plan == 'pro'`, which locked
    // every member out of a workspace their own client still showed as editable.
    await seedShared(async (db) => {
      await setDoc(doc(db, 'users/owner'), { plan: 'Pro ', currency: 'MAD', onboardingComplete: true });
      await setDoc(doc(db, 'households/home'), {
        name: 'Home', ownerId: 'owner', currency: 'MAD',
        moneyPlaces: [{ id: 'bank', name: 'Bank', icon: 'account_balance' }],
        activeCategories: ['Groceries'], createdAt: new Date().toISOString(),
      });
    });
    const owner = asUser('owner');
    await assertSucceeds(getDoc(doc(owner, 'households/home')));
    await assertSucceeds(monthWrite(owner, 'owner', 'households/home/months/2026-09'));
  });

  it('lets the household owner write with no membership row of their own', async () => {
    await seedShared(async (db) => {
      await setDoc(doc(db, 'users/owner'), proProfile);
      await setDoc(doc(db, 'households/home'), householdDoc());
      await setDoc(doc(db, 'households/home/members/someone-else'), {
        id: 'someone-else', userId: 'someone-else', email: 'other@example.com',
        displayName: 'Other', role: 'editor', status: 'active',
      });
    });
    const owner = asUser('owner');
    await assertSucceeds(monthWrite(owner, 'owner', 'households/home/months/2026-09'));
    // Ownership is not a wildcard: an unrelated account stays out.
    const stranger = asUser('stranger');
    await assertFails(monthWrite(stranger, 'stranger', 'households/home/months/2026-09'));
  });

  it('denies a household whose plan owner no longer exists, without breaking reads', async () => {
    await seedShared(async (db) => {
      await setDoc(doc(db, 'users/editor'), { plan: 'free', currency: 'MAD', onboardingComplete: true });
      await setDoc(doc(db, 'households/home'), householdDoc({ entitlementOwnerId: 'deleted-user' }));
      await setDoc(doc(db, 'households/home/members/editor'), {
        id: 'editor', userId: 'editor', email: 'editor@example.com',
        displayName: 'Editor', role: 'editor', status: 'active',
      });
    });
    const editor = asUser('editor');
    // `get(users/deleted-user)` used to abort; a missing sponsor must read as
    // "no entitlement", never as an error that also takes the reads with it.
    await assertSucceeds(getDoc(doc(editor, 'households/home')));
    await assertSucceeds(getDoc(doc(editor, 'households/home/months/2026-09')));
    await assertFails(monthWrite(editor, 'editor', 'households/home/months/2026-09'));
  });

  it('recovers a household stranded behind a lapsed sponsor, and only its owner', async () => {
    const expiredAtMs = Date.now() - DAY_MS;
    await seedShared(async (db) => {
      await setDoc(doc(db, 'users/owner'), proProfile);
      await setDoc(doc(db, 'users/ex-partner'), {
        plan: 'pro', currency: 'MAD', onboardingComplete: true,
        entitlementSource: 'launch_trial', entitlementStatus: 'trialing',
        entitlementEndsAtMs: expiredAtMs,
      });
      await setDoc(doc(db, 'households/home'), householdDoc({
        entitlementOwnerId: 'ex-partner', entitlementSource: 'launch_trial',
        entitlementStatus: 'trialing', entitlementEndsAtMs: expiredAtMs,
      }));
      await setDoc(doc(db, 'households/home/members/editor'), {
        id: 'editor', userId: 'editor', email: 'editor@example.com',
        displayName: 'Editor', role: 'editor', status: 'active',
      });
    });
    const owner = asUser('owner');
    const editor = asUser('editor');
    await assertFails(monthWrite(owner, 'owner', 'households/home/months/2026-09'));

    const rebind = {
      entitlementOwnerId: 'owner', entitlementSource: 'admin', entitlementStatus: 'active',
      // The ex-partner's trial window has to go: the projection may not outlive
      // the profile it is copied from.
      entitlementEndsAtMs: deleteField(),
      updatedAt: new Date().toISOString(),
    };
    await assertFails(updateDoc(doc(editor, 'households/home'), rebind));
    await assertSucceeds(updateDoc(doc(owner, 'households/home'), rebind));
    await assertSucceeds(monthWrite(owner, 'owner', 'households/home/months/2026-09'));
  });

  it('accepts only a rebinding the caller can actually pay for', async () => {
    // The projected expiry has to be the profile's own value, copied: the
    // client never invents one, and neither may a test.
    const endsAtMs = Date.now() + DAY_MS;
    await seed(async (db) => {
      await setDoc(doc(db, 'users/payer'), {
        plan: 'pro', currency: 'MAD', onboardingComplete: true,
        entitlementSource: 'launch_trial', entitlementStatus: 'trialing',
        entitlementEndsAtMs: endsAtMs,
      });
      await setDoc(doc(db, 'households/home'), householdDoc({
        ownerId: 'payer', planOwnerId: 'payer', entitlementOwnerId: 'someone-else',
      }));
      await setDoc(doc(db, 'households/home/months/2026-09'), validMonth());
    });
    const payer = asUser('payer');
    // A longer expiry than the profile carries is a forged grant, not a repair.
    await assertFails(updateDoc(doc(payer, 'households/home'), {
      entitlementOwnerId: 'payer', entitlementSource: 'launch_trial', entitlementStatus: 'trialing',
      entitlementEndsAtMs: endsAtMs + 365 * DAY_MS,
      updatedAt: new Date().toISOString(),
    }));
    // So is a plan this account does not hold.
    await assertFails(updateDoc(doc(payer, 'households/home'), {
      entitlementOwnerId: 'payer', entitlementSource: 'stripe', entitlementStatus: 'active',
      entitlementEndsAtMs: deleteField(),
      updatedAt: new Date().toISOString(),
    }));
    // A rebinding may not smuggle configuration changes with it: the projection
    // is a complete write on its own, and `ownerId`/`createdAt` are frozen.
    await assertFails(updateDoc(doc(payer, 'households/home'), {
      entitlementOwnerId: 'payer', entitlementSource: 'launch_trial', entitlementStatus: 'trialing',
      entitlementEndsAtMs: endsAtMs, currency: 'EUR',
      updatedAt: new Date().toISOString(),
    }));
    await assertFails(updateDoc(doc(payer, 'households/home'), {
      entitlementOwnerId: 'payer', entitlementSource: 'launch_trial', entitlementStatus: 'trialing',
      entitlementEndsAtMs: endsAtMs, createdAt: '2020-01-01T00:00:00.000Z',
      updatedAt: new Date().toISOString(),
    }));
    await assertSucceeds(updateDoc(doc(payer, 'households/home'), {
      entitlementOwnerId: 'payer', entitlementSource: 'launch_trial', entitlementStatus: 'trialing',
      entitlementEndsAtMs: endsAtMs,
      updatedAt: new Date().toISOString(),
    }));
  });

  it('keeps household settings frozen while nobody pays for the workspace', async () => {
    await seed(async (db) => {
      await setDoc(doc(db, 'users/owner'), { plan: 'free', currency: 'MAD', onboardingComplete: true });
      await setDoc(doc(db, 'households/home'), householdDoc({
        entitlementOwnerId: 'lapsed-user', entitlementStatus: 'expired',
        entitlementEndsAtMs: Date.now() - DAY_MS,
      }));
    });
    const owner = asUser('owner');
    await assertFails(updateDoc(doc(owner, 'households/home'), { currency: 'EUR' }));
    // ...but the workspace's own data never becomes unreadable.
    await assertSucceeds(getDoc(doc(owner, 'households/home')));
  });

  it('lets an owner delete their own membership row, but nobody else delete an owner row', async () => {
    // Tearing down a workspace has to remove the founder's own row. The rule
    // used to forbid deleting ANY role:'owner' row, so the teardown always
    // failed on the last member and the household could never be removed -
    // this is the refusal the reported log named. Self-deletion strands
    // nobody: householdOwner() reads `ownerId` off the root, not the member
    // row, so the owner keeps full access and can write the row back.
    await seed(async (db) => {
      await setDoc(doc(db, 'users/owner'), { plan: 'pro', currency: 'MAD', onboardingComplete: true });
      await setDoc(doc(db, 'users/second'), { plan: 'pro', currency: 'MAD', onboardingComplete: true });
      await setDoc(doc(db, 'households/home'), householdDoc());
      await setDoc(doc(db, 'households/home/members/owner'), {
        userId: 'owner', role: 'owner', status: 'active', displayName: 'Owner',
      });
      await setDoc(doc(db, 'households/home/members/second'), {
        userId: 'second', role: 'owner', status: 'active', displayName: 'Second',
      });
    });
    const owner = asUser('owner');
    // A co-owner's row is still protected from another owner.
    await assertFails(deleteDoc(doc(owner, 'households/home/members/second')));
    // The caller's own owner row is removable, and the household root - which
    // the teardown deletes next - remains deletable without it.
    await assertSucceeds(deleteDoc(doc(owner, 'households/home/members/owner')));
    await assertSucceeds(deleteDoc(doc(owner, 'households/home')));
  });

  it('refuses an invitation query filtered by household, and allows the one the teardown uses', async () => {
    // A query is authorized against `allow list` without reading documents, so
    // the query's constraints must imply the rule. householdInvites allows
    // listing by `createdBy == request.auth.uid` only. Filtering by
    // householdId - which the workspace teardown used to do as its very first
    // step - is refused outright, taking the whole delete with it.
    await seed(async (db) => {
      await setDoc(doc(db, 'users/owner'), { plan: 'pro', currency: 'MAD', onboardingComplete: true });
      await setDoc(doc(db, 'households/home'), householdDoc());
      await setDoc(doc(db, 'householdInvites/invite-1'), {
        householdId: 'home',
        createdBy: 'owner',
        email: 'guest@example.com',
        role: 'editor',
        status: 'pending',
        expiresAtMs: Date.now() + 86_400_000,
      });
    });
    const owner = asUser('owner');
    const invites = collection(owner, 'householdInvites');
    await assertFails(getDocs(query(invites, where('householdId', '==', 'home'))));
    await assertSucceeds(getDocs(query(invites, where('createdBy', '==', 'owner'))));
  });

  it('only lets a savings ledger row go once the savings document it describes is gone', async () => {
    // Tearing a workspace down is many separate requests, not one batch, so
    // `existsAfter` sees live state on each. A savings ledger row may only be
    // deleted after `data/savings`; deleting the ledger first - as the client
    // used to - leaves rows that can never be removed and a delete that can
    // never finish. This pins the dependency order the client must follow.
    await seed(async (db) => {
      await setDoc(doc(db, 'users/owner'), { plan: 'pro', currency: 'MAD', onboardingComplete: true });
      await setDoc(doc(db, 'households/home'), householdDoc());
      await setDoc(doc(db, 'households/home/data/savings'), {
        goals: [], revision: 1, lastMutationId: 'savings-1',
      });
      await setDoc(doc(db, 'households/home/ledger/savings-1'), {
        ...ledger('savings-1', 'owner', 'household', 'home', 0, 1, 'savings'),
        monthKey: 'savings',
      });
    });
    const owner = asUser('owner');
    const savingsLedger = doc(owner, 'households/home/ledger/savings-1');
    await assertFails(deleteDoc(savingsLedger));
    await assertSucceeds(deleteDoc(doc(owner, 'households/home/data/savings')));
    await assertSucceeds(deleteDoc(savingsLedger));
  });
});

/*
 * Regression for the production refusal of 2026-09-04:
 *
 *   [household-month-write] refused  households/<hid>/months/2026-08
 *     mutationId: bootstrap-<uuid>, code: permission-denied
 *   [import] personal -> household import failed  code: permission-denied
 *
 * with a diagnostic context in which every input was right: the caller owned the
 * household, held an `owner/active` membership row, was the household's sponsor,
 * and the sponsor profile was `pro / launch_trial / trialing` with an end time in
 * the future. The rules refused anyway, because the helpers that answer those
 * questions returned map literals with BARE keys (`{ owner: ..., paid: ... }`),
 * and the rules language resolves a bare key as an expression - the function
 * `owner(uid)`, an unbound name, or the `let present` boolean - not as the string.
 * Building the record aborted ("Null value error" / "Type error. Received: [bool]
 * Expected: [string]"), and an aborted rule is a bare permission-denied.
 *
 * These cases write what `saveHouseholdMonthBudget()` and the outbox actually
 * write - a `runTransaction` carrying a full `normalizeMonth()` document and a
 * `bootstrap` ledger row - and go through every record-returning helper:
 * `monthFinanceWriterFacts`, `monthCustomWriterFacts`, `mutationLedger`,
 * `householdAccess` and `householdRootFacts`.
 */
describe('household month bootstrap by an entitled launch-trial owner (map-literal regression)', () => {
  const HID = '74d7b746-7544-4e82-ab77-ab15df9fa980';
  const OWNER = '06LjPNwwSsP2zsPTJwlhQvd942E2';
  const TRIAL_MS = 7_776_000_000;

  function launchTrialProfile(nowMs: number) {
    return {
      plan: 'pro', currency: 'MAD', onboardingComplete: true, displayName: 'Owner',
      entitlementSource: 'launch_trial', entitlementStatus: 'trialing',
      entitlementStartedAtMs: nowMs, entitlementEndsAtMs: nowMs + TRIAL_MS,
    };
  }

  async function seedReportedHousehold(extraMembers: Record<string, Record<string, unknown>> = {}) {
    const nowMs = Date.now();
    await seed(async (db) => {
      await setDoc(doc(db, `users/${OWNER}`), launchTrialProfile(nowMs));
      await setDoc(doc(db, `households/${HID}`), {
        id: HID, name: 'Home', ownerId: OWNER, planOwnerId: OWNER, entitlementOwnerId: OWNER,
        entitlementSource: 'launch_trial', entitlementStatus: 'trialing', entitlementEndsAtMs: nowMs + TRIAL_MS,
        currency: 'MAD', monthStartDate: 1, schemaVersion: 2, onboardingComplete: true,
        moneyPlaces: [{ id: 'bank', name: 'Bank', icon: 'account_balance' }],
        activeCategories: ['Groceries'], createdAt: new Date().toISOString(),
      });
      await setDoc(doc(db, `households/${HID}/members/${OWNER}`), {
        id: OWNER, userId: OWNER, email: `${OWNER}@example.com`, displayName: 'Owner',
        role: 'owner', status: 'active', joinedAt: new Date().toISOString(),
      });
      for (const [uid, member] of Object.entries(extraMembers)) {
        await setDoc(doc(db, `households/${HID}/members/${uid}`), {
          id: uid, userId: uid, email: `${uid}@example.com`, displayName: uid,
          status: 'active', joinedAt: new Date().toISOString(), ...member,
        });
      }
    });
  }

  /** A personal month as the app stores it: what the import reads and copies. */
  function personalMonth(monthKey: string, extra: Partial<MonthBudget> = {}) {
    const raw: Partial<MonthBudget> = {
      totalBudget: 12000, bankPart: 9000, homePart: 0, walletPart: 500,
      strategyId: '50-30-20', monthlySavingsTarget: 2400,
      placeBalances: { cash_jar: 150 },
      variableExpenses: [{ id: 'v1', name: 'Groceries', amount: 320.5, type: 'Groceries', date: `${monthKey}-03`, place: 'bank', person: 'Self' }],
      fixedExpenses: [{ id: 'f1', name: 'Rent', amount: 4000, type: 'Housing', date: `${monthKey}-01`, place: 'bank', paidAmount: 4000 }],
      activeCategories: ['Groceries', 'Housing'],
      ...extra,
    };
    return normalizeMonth(raw, monthKey);
  }

  /** Byte-for-byte the transaction `saveHouseholdMonthBudget()` runs. */
  function bootstrapMonth(db: Firestore, uid: string, hid: string, monthKey: string, month: ReturnType<typeof normalizeMonth>, mutationId = `bootstrap-${monthKey}-${uid}`) {
    return runTransaction(db, async (transaction) => {
      const monthRef = doc(db, `households/${hid}/months/${monthKey}`);
      const snapshot = await transaction.get(monthRef);
      if (snapshot.exists()) return false;
      const next = JSON.parse(JSON.stringify({
        ...normalizeMonth(month, monthKey),
        revision: 1,
        lastMutationId: mutationId,
        updatedByUserId: uid,
        updatedAt: new Date().toISOString(),
      }));
      transaction.set(monthRef, next);
      transaction.set(doc(db, `households/${hid}/ledger/${mutationId}`), {
        mutationId, actorId: uid, workspace: 'household', workspaceId: hid, monthKey,
        kind: 'bootstrap', baseRevision: 0, nextRevision: 1, createdAt: next.updatedAt,
      });
      return true;
    });
  }

  it('lets the reported owner import two personal months in parallel, exactly as the onboarding import does', async () => {
    await seedReportedHousehold();
    const owner = asUser(OWNER);
    // `importPersonalBudgetIntoHousehold` fires one transaction per month and
    // awaits them together; the report named 2026-08 first and 2026-09 second.
    await assertSucceeds(Promise.all([
      bootstrapMonth(owner, OWNER, HID, '2026-08', personalMonth('2026-08')),
      bootstrapMonth(owner, OWNER, HID, '2026-09', personalMonth('2026-09')),
    ]));
    const stored = await getDoc(doc(owner, `households/${HID}/months/2026-08`));
    if (stored.data()?.revision !== 1 || stored.data()?.periodStatus !== 'open') {
      throw new Error(`bootstrap did not land: ${JSON.stringify(stored.data())}`);
    }
  });

  it('then lets the same owner flush an ordinary edit and close the period through the record helpers', async () => {
    await seedReportedHousehold();
    const owner = asUser(OWNER);
    await assertSucceeds(bootstrapMonth(owner, OWNER, HID, '2026-09', personalMonth('2026-09')));

    // Outbox flush: `monthFinanceWriterFacts` + `mutationLedger` (`present`/`kind`).
    const flush = writeBatch(owner);
    flush.set(doc(owner, `households/${HID}/ledger/flush-1`), {
      ...ledger('flush-1', OWNER, 'household', HID, 1, 2, 'month'),
    });
    flush.update(doc(owner, `households/${HID}/months/2026-09`), {
      bankPart: 8500, revision: 2, lastMutationId: 'flush-1', updatedAt: new Date().toISOString(),
    });
    await assertSucceeds(flush.commit());

    // Close: `monthCloseReopenByOwner` -> `monthUpdatePreconditions` -> `mutationLedger`.
    const close = writeBatch(owner);
    close.set(doc(owner, `households/${HID}/ledger/close-1`), ledger('close-1', OWNER, 'household', HID, 2, 3, 'month-close'));
    close.update(doc(owner, `households/${HID}/months/2026-09`), {
      periodStatus: 'closed', closedAt: new Date().toISOString(), closedByUserId: OWNER,
      revision: 3, lastMutationId: 'close-1', updatedAt: new Date().toISOString(),
    });
    await assertSucceeds(close.commit());
  });

  it('still refuses the same bootstrap from a stranger, a viewer and an expired trial', async () => {
    await seedReportedHousehold({ viewer: { role: 'viewer' } });
    await assertFails(bootstrapMonth(asUser('stranger'), 'stranger', HID, '2026-08', personalMonth('2026-08')));
    await assertFails(bootstrapMonth(asUser('viewer'), 'viewer', HID, '2026-08', personalMonth('2026-08')));

    // Same household, sponsor trial over: the record's `paid` fact must now say no,
    // and say it as a decision rather than an abort.
    await seed(async (db) => {
      await updateDoc(doc(db, `users/${OWNER}`), { entitlementEndsAtMs: Date.now() - 1 });
    });
    await assertFails(bootstrapMonth(asUser(OWNER), OWNER, HID, '2026-08', personalMonth('2026-08')));
  });

  it('a bootstrap row can seed a month but never replay over one', async () => {
    await seedReportedHousehold();
    const owner = asUser(OWNER);
    await assertSucceeds(bootstrapMonth(owner, OWNER, HID, '2026-09', personalMonth('2026-09')));
    // A retry of the import is a no-op by design (`snapshot.exists()` short-circuits);
    // a forced overwrite carrying a `bootstrap` row must be refused by `mutationLedger.kind`.
    const overwrite = writeBatch(owner);
    overwrite.set(doc(owner, `households/${HID}/ledger/bootstrap-again`), ledger('bootstrap-again', OWNER, 'household', HID, 1, 2, 'bootstrap'));
    overwrite.update(doc(owner, `households/${HID}/months/2026-09`), {
      bankPart: 1, revision: 2, lastMutationId: 'bootstrap-again',
    });
    await assertFails(overwrite.commit());
  });

  it('a custom member holding editAll bootstraps and edits through the custom-writer record', async () => {
    await seedReportedHousehold({
      clerk: { role: 'custom', permissions: { expenses: 'editAll', budget: 'editAll', savings: 'none', debts: 'none', invoices: 'none' } },
    });
    const clerk = asUser('clerk');
    await assertSucceeds(bootstrapMonth(clerk, 'clerk', HID, '2026-08', personalMonth('2026-08')));
    const edit = writeBatch(clerk);
    edit.set(doc(clerk, `households/${HID}/ledger/clerk-1`), ledger('clerk-1', 'clerk', 'household', HID, 1, 2, 'month', '2026-08'));
    edit.update(doc(clerk, `households/${HID}/months/2026-08`), {
      bankPart: 100, revision: 2, lastMutationId: 'clerk-1',
    });
    await assertSucceeds(edit.commit());
  });

  it('importing a personal month that was closed keeps it closed in the household', async () => {
    // `normalizeMonth` carries `periodStatus: 'closed'` across; the create rule
    // must accept a closed bootstrap as long as its audit fields are present,
    // otherwise the import silently drops every closed month.
    await seedReportedHousehold();
    const owner = asUser(OWNER);
    const closed = personalMonth('2026-07', {
      periodStatus: 'closed', closedAt: '2026-08-01T00:00:00.000Z', closedByUserId: OWNER,
    });
    await assertSucceeds(bootstrapMonth(owner, OWNER, HID, '2026-07', closed));
    // ...but a closed month with no record of who closed it is a malformed document.
    const orphan = personalMonth('2026-06', { periodStatus: 'closed' });
    await assertFails(bootstrapMonth(owner, OWNER, HID, '2026-06', orphan));
  });

  it('the owner manages membership rows through the root-facts record', async () => {
    // `householdRootFacts` is the same shape of helper, used by the member rules.
    await seedReportedHousehold({ editor: { role: 'editor' } });
    const owner = asUser(OWNER);
    await assertSucceeds(updateDoc(doc(owner, `households/${HID}/members/editor`), { role: 'viewer' }));
    await assertSucceeds(setDoc(doc(owner, `households/${HID}/members/profile-kid`), {
      id: 'profile-kid', displayName: 'Kid', role: 'profile', status: 'active',
      joinedAt: new Date().toISOString(),
    }));
  });
});
