// DIAG (temporary): one `it` per helper probe, each writing to its own
// collection with a single `allow` statement. The emulator's per-request
// evaluation line is then one short status per probe.
import { after, before, beforeEach, describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import {
  assertFails,
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
    for (const id of ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9',
      'p20', 'p21', 'p22', 'p23', 'p24', 'p25', 'p26', 'p27', 'p28', 'p29', 'p30']) {
      await setDoc(doc(db, `diag/${id}/doc`), {
        n: 0, lastMutationId: 'seed-mutation', revision: 1,
        householdId: 'home', email: 'owner@example.com',
      });
    }
  });
});

after(async () => { await environment.cleanup(); });

const probes = [
  ['p1 facts.paid', 'monthFinanceWriterFacts.paid'],
  ['p2 monthOrdinaryUpdateOk', 'monthOrdinaryUpdateOk'],
  ['p3 activeProEntitlement', 'activeProEntitlement'],
  ['p4 householdAccess.paid', 'householdAccess.paid'],
  ['p5 monthUpdateByCustomMember', 'monthUpdateByCustomMember'],
  ['p6 monthCloseReopenByOwner', 'monthCloseReopenByOwner'],
  ['p7 mutationLedger.present', 'mutationLedger.present'],
  ['p8 memberUpdateByOwner', 'memberUpdateByOwner'],
  ['p9 invitationJoinOk', 'invitationJoinOk'],
  ['p20 exists household', 'exists(householdPath)'],
  ['p21 exists member', 'exists(memberPath)'],
  ['p22 get household.ownerId', 'get(household).ownerId'],
  ['p23 get member.role', 'get(member).role'],
  ['p24 sponsor', 'householdSponsor(get(household))'],
  ['p25 get ledger.kind', 'get(ledger).kind'],
  ['p26 existsAfter ledger', 'existsAfter(ledger)'],
  ['p27 mutationLedger.kind', 'mutationLedger.kind'],
  ['p28 incoming fields', 'incoming fields'],
  ['p29 id.size', 'id.size'],
  ['p30 periodClosed(incoming)', 'periodClosed(incoming)'],
];

for (const [name] of probes) {
  const id = name.split(' ')[0];
  it(`probe: ${name}`, async () => {
    const owner = asUser('owner');
    await updateDoc(doc(owner, `diag/${id}/doc`), { n: 1, revision: 2 });
  });
}

it('control: a stranger update to a diag doc is a plain permission-denied', async () => {
  const stranger = asUser('stranger');
  await assertFails(updateDoc(doc(stranger, 'diag/p1/doc'), { n: 1 }));
});
