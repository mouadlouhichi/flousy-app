// DIAG (temporary): one `it` per helper probe. A probe that aborts prints its
// emulator evaluation text through the failing assertion; a probe that
// evaluates cleanly to true passes silently. This is how the aborting
// subexpression is isolated without a local emulator.
import { after, before, beforeEach, describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestContext,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc, type Firestore } from 'firebase/firestore';

const projectId = 'smartjib-rules-test';
let environment: RulesTestEnvironment;

function firestore(context: RulesTestContext): Firestore {
  return context.firestore() as unknown as Firestore;
}
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
    await setDoc(doc(db, 'households/home/months/2026-09'), {
      totalBudget: 1000, bankPart: 1000, homePart: 0, walletPart: 0,
      variableExpenses: [], fixedExpenses: [], activeCategories: ['Groceries'],
      revision: 1, lastMutationId: 'seed-mutation', updatedAt: new Date().toISOString(),
    });
    await setDoc(doc(db, 'households/home/ledger/seed-mutation'), {
      mutationId: 'seed-mutation', actorId: 'owner', workspace: 'household',
      workspaceId: 'home', monthKey: '2026-09', kind: 'month',
      baseRevision: 0, nextRevision: 1, createdAt: new Date().toISOString(),
    });
    await setDoc(doc(db, 'householdInvites/invite-ok'), {
      id: 'invite-ok', householdId: 'home', memberId: 'pending',
      email: 'owner@example.com', role: 'viewer', status: 'pending',
      createdBy: 'owner', createdAt: new Date().toISOString(),
      expiresAtMs: Date.now() + 60_000,
    });
    for (const id of ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9', 'p10',
      'p20', 'p21', 'p22', 'p23', 'p24', 'p25', 'p26', 'p27', 'p28', 'p29', 'p30']) {
      await setDoc(doc(db, `diag/${id}`), {
        n: 0, lastMutationId: 'seed-mutation', revision: 1,
        householdId: 'home', email: 'owner@example.com',
        inviteId: id == 'p9' ? 'invite-ok' : '',
      });
    }
  });
});

after(async () => { await environment.cleanup(); });

const probes: [string, (db: Firestore, id: string) => Promise<unknown>][] = [
  ['p1 facts.paid', async (db, id) => updateDoc(doc(db, `diag/${id}`), { n: 1 })],
  ['p2 monthOrdinaryUpdateOk', async (db, id) => updateDoc(doc(db, `diag/${id}`), { n: 1, revision: 2 })],
  ['p3 activeProEntitlement', async (db, id) => updateDoc(doc(db, `diag/${id}`), { n: 1 })],
  ['p4 householdAccess.paid', async (db, id) => updateDoc(doc(db, `diag/${id}`), { n: 1 })],
  ['p5 monthUpdateByCustomMember', async (db, id) => updateDoc(doc(db, `diag/${id}`), { n: 1 })],
  ['p6 monthCloseReopenByOwner', async (db, id) => updateDoc(doc(db, `diag/${id}`), { n: 1, revision: 2 })],
  ['p7 mutationLedger.present', async (db, id) => updateDoc(doc(db, `diag/${id}`), { n: 1 })],
  ['p8 memberUpdateByOwner', async (db, id) => updateDoc(doc(db, `diag/${id}`), { role: 'viewer', n: 1 })],
  ['p9 invitationJoinOk', async (db, id) => updateDoc(doc(db, `diag/${id}`), { n: 1 })],
  ['p10 householdSponsorBindingValid', async (db, id) => updateDoc(doc(db, `diag/${id}`), { n: 1 })],
];

for (const [name, run] of probes) {
  const id = name.split(' ')[0];
  it(`probe: ${name}`, async () => {
    const owner = asUser('owner');
    await run(owner, id); // true => passes; abort/false => fails with emulator text
  });
}

for (const id of ['p20', 'p21', 'p22', 'p23', 'p24', 'p25', 'p26', 'p27', 'p28', 'p29', 'p30']) {
  it(`probe: ${id}`, async () => {
    const owner = asUser('owner');
    await updateDoc(doc(owner, `diag/${id}`), { n: 1 });
  });
}

// creates with no pre-seeded doc
const creates: [string, (db: Firestore, id: string) => Promise<unknown>][] = [
  ['p11 monthCreateByFinanceWriter', async (db, id) => setDoc(doc(db, `diag/${id}`), { n: 1 })],
  ['p12 householdLedgerGate', async (db, id) => setDoc(doc(db, `diag/${id}`), { kind: 'month', n: 1 })],
  ['p13 memberCreateByInvitee', async (db, id) => setDoc(doc(db, `diag/${id}`), { n: 1 })],
];
for (const [name, run] of creates) {
  const id = name.split(' ')[0];
  it(`probe: ${name}`, async () => {
    const owner = asUser('owner');
    await run(owner, id);
  });
}

it('control: a stranger update to a diag doc is a plain permission-denied', async () => {
  const stranger = asUser('stranger');
  await assertFails(updateDoc(doc(stranger, 'diag/p1'), { n: 1 }));
});
