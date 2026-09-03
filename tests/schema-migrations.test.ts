import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  HOUSEHOLD_DEFAULT_AVATAR_COLOR,
  HOUSEHOLD_DEFAULT_CATEGORIES,
  SCHEMA_MODELS,
  planDocumentMigration,
} from '../src/lib/schema-migrations';
import { normalizeHousehold } from '../src/lib/household';
import { DEFAULT_MONEY_PLACES as APP_DEFAULT_MONEY_PLACES } from '../src/lib/store';

/**
 * The legacy-document contract, tested from both ends.
 *
 * A feature that adds a required field to a persisted type works perfectly for the
 * accounts that create data afterwards and silently breaks for everyone else: the
 * readers default the missing value in memory, while `firestore.rules` compares the
 * stored shape and refuses the write. That is a permission error the user cannot
 * see the cause of - the failure mode this repository keeps being asked about.
 *
 * So the model in `src/lib/schema-migrations.ts` is the single list of fields that
 * must exist on a stored document, the app writes back what it can derive from the
 * document itself, and `scripts/db-migrations.mjs` is the project-level pass for the
 * rest. These tests keep the three from drifting apart, and keep the migration's
 * values identical to the reader's - a migration that "completes" a document by
 * changing what it displays would be worse than the gap it closed.
 */

const householdFields = () => SCHEMA_MODELS.households.fields.map((field) => field.field);

describe('the household migration matches what the reader assumes', () => {
  it('completes a document written before the configuration fields existed', () => {
    const legacy = {
      name: 'Family',
      ownerId: 'owner-1',
      createdAt: '2024-05-01T00:00:00.000Z',
      updatedAt: '2024-05-02T00:00:00.000Z',
    };
    const plan = planDocumentMigration('households', legacy);
    assert.deepEqual(Object.keys(plan.patch).sort(), [
      'activeCategories', 'currency', 'entitlementOwnerId', 'moneyPlaces', 'planOwnerId',
    ].sort());
    assert.deepEqual(plan.unresolved, []);
    assert.equal(plan.patch.currency, 'MAD');
    assert.deepEqual(plan.patch.activeCategories, HOUSEHOLD_DEFAULT_CATEGORIES);
    assert.deepEqual(plan.patch.moneyPlaces, APP_DEFAULT_MONEY_PLACES);
    assert.equal(plan.patch.planOwnerId, 'owner-1', 'a household predating plan ownership meant its owner');
    assert.equal(plan.patch.entitlementOwnerId, 'owner-1');
  });

  it('produces exactly the document the reader was already showing', () => {
    for (const legacy of [
      {},
      { ownerId: 'o', name: 'X' },
      { name: '', ownerId: 'o', currency: '', moneyPlaces: [], activeCategories: [] },
      { ownerId: 'o', planOwnerId: 'p' },
    ]) {
      const { patch } = planDocumentMigration('households', legacy);
      const repaired = { ...legacy, ...patch } as Record<string, unknown>;
      const normalized = normalizeHousehold('h1', legacy) as unknown as Record<string, unknown>;
      // Only the repaired fields: a gap nobody may invent a value for stays a gap,
      // and the reader's fallback for it is deliberately not written down.
      assert.ok(Object.keys(patch).length > 0, JSON.stringify(legacy));
      for (const field of Object.keys(patch)) {
        assert.deepEqual(repaired[field], normalized[field], `${JSON.stringify(legacy)} -> ${field}`);
      }
    }
  });

  it('is idempotent, and never overwrites what the document already holds', () => {
    const complete = normalizeHousehold('h1', {
      name: 'Family',
      ownerId: 'owner-1',
      planOwnerId: 'owner-1',
      entitlementOwnerId: 'owner-1',
      currency: 'EUR',
      moneyPlaces: [{ id: 'bank', name: 'Bank', icon: 'account_balance' }],
      activeCategories: ['Groceries'],
      createdAt: '2024-05-01T00:00:00.000Z',
      updatedAt: '2024-05-02T00:00:00.000Z',
    });
    const plan = planDocumentMigration('households', complete as unknown as Record<string, unknown>);
    assert.deepEqual(plan.patch, {}, 'a whole document needs no write, so the repair can run on every load');
    assert.deepEqual(plan.unresolved, []);
    assert.deepEqual(planDocumentMigration('households', null), { patch: {}, unresolved: [], missing: [] });
  });

  it('reports what it must not invent', () => {
    // The owner of a household cannot be guessed from the household: writing the
    // wrong id there transfers the workspace. `createdAt` is the same story - the
    // reader falls back to the epoch, and freezing that guess into the document
    // would make a wrong date permanent.
    const orphan = { name: 'Family', currency: 'MAD', moneyPlaces: [{ id: 'bank', name: 'Bank' }], activeCategories: ['Groceries'] };
    const plan = planDocumentMigration('households', orphan);
    assert.deepEqual(plan.unresolved.sort(), ['createdAt', 'entitlementOwnerId', 'ownerId', 'planOwnerId'].sort());
    assert.ok(!('createdAt' in plan.patch));
    assert.ok(!('ownerId' in plan.patch));
    assert.equal(plan.patch.name, undefined, 'name was present, so it is untouched');
  });
});

describe('member rows and invitations', () => {
  it('derives a member row\'s identity from the row itself', () => {
    const plan = planDocumentMigration('householdMembers', {
      id: 'member-9',
      role: 'editor',
      status: 'active',
      email: 'sam@example.com',
    });
    assert.equal(plan.patch.userId, 'member-9');
    assert.equal(plan.patch.displayName, 'sam');
    assert.equal(plan.patch.avatarColor, HOUSEHOLD_DEFAULT_AVATAR_COLOR);
    assert.deepEqual(plan.unresolved, []);
  });

  it('leaves a retired row retired, and a named row named', () => {
    const plan = planDocumentMigration('householdMembers', {
      id: 'member-9',
      userId: 'real-user',
      displayName: 'Sam',
      avatarColor: '#123456',
      status: 'inactive',
      role: 'viewer',
    });
    assert.deepEqual(plan.patch, {});
    assert.deepEqual(plan.unresolved, []);
  });

  it('gives a legacy invitation the expiry it never stored, or reports it', () => {
    assert.equal(
      planDocumentMigration('householdInvites', {
        email: 'sam@example.com',
        status: 'pending',
        expiresAt: '2026-01-02T03:04:05.000Z',
      }).patch.expiresAtMs,
      Date.parse('2026-01-02T03:04:05.000Z'),
      'the numeric expiry is the stored instant, not a fresh window',
    );
    const noDates = planDocumentMigration('householdInvites', { email: 'a@b.co', status: 'pending' });
    assert.deepEqual(noDates.patch, {});
    assert.deepEqual(noDates.unresolved, ['expiresAtMs'], 'an expiry is never invented: that would extend a claim window');
  });

  it('renders an absent role or status as nothing, never the text "undefined"', async () => {
    const { localizeHouseholdRole } = await import('../src/lib/localized-labels');
    const messages = (await import('../messages/en.json')).default;
    assert.equal(localizeHouseholdRole(undefined as unknown as string, messages), '');
    assert.equal(localizeHouseholdRole('editor', messages), messages.householdRoles.editor);
    // `memberStatus` is local to the panel, so its guard is pinned at the source: an
    // absent `status` must not fall through to the raw value and print "undefined".
    const panel = readFileSync('src/components/dashboard/profile/household-panel.tsx', 'utf8');
    assert.match(panel, /return typeof status === 'string' \? status : '';/);
  });
});

describe('the model, the rules and the maintenance script agree', () => {
  const rules = readFileSync('firestore.rules', 'utf8');

  it('covers every field the rules demand of a stored household', () => {
    const body = rules.slice(
      rules.indexOf('function validHouseholdConfig(data)'),
      rules.indexOf('function validHouseholdConfig(data)') + 400,
    );
    const demanded = [...body.matchAll(/'([a-zA-Z]+)' in data/g)].map((match) => match[1]);
    assert.deepEqual(demanded.sort(), ['activeCategories', 'currency', 'moneyPlaces'].sort(), 'the rules changed shape');
    for (const field of demanded) {
      assert.ok(householdFields().includes(field), `${field} is required by the rules but has no migration`);
    }
    // The identity fields the household update branch compares are read out of the
    // stored document too, so they belong to the contract.
    const update = rules.slice(rules.indexOf('allow update: if householdOwner(hid)'), rules.indexOf('allow delete: if householdOwner(hid)'));
    assert.match(update, /incoming\(\)\.get\('ownerId', ''\) == existing\(\)\.get\('ownerId', ''\)/);
    for (const field of ['ownerId', 'createdAt']) {
      assert.ok(householdFields().includes(field), `${field} is compared on every update but has no migration entry`);
    }
  });

  it('addresses each model by the collection the rules actually match', () => {
    // Registry keys are names for people, not paths: the model called `householdMembers`
    // lives at `households/{hid}/members`. That difference is only safe while something
    // checks it, so both spellings are pinned against the rules - renaming or inventing a
    // collection now fails a test instead of quietly migrating documents nobody reads.
    const script = readFileSync('scripts/db-migrations.mjs', 'utf8');
    const collectionIds = [...script.matchAll(/collectionId: '([^']+)'/g)].map((match) => match[1]);
    assert.deepEqual(collectionIds.sort(), ['householdInvites', 'households', 'members']);
    for (const collectionId of collectionIds) {
      assert.match(
        rules,
        new RegExp(`match \\/${collectionId}\\/\\{|match \\/${collectionId} \\{`),
        `the rules never match /${collectionId}, so a migration writing there would protect nothing`,
      );
    }
    assert.deepEqual(Object.keys(SCHEMA_MODELS).sort(), ['householdInvites', 'householdMembers', 'households']);
  });

  it('lists no field the household type does not have', () => {
    const sources = readFileSync('src/lib/household.ts', 'utf8');
    const interfaceBody = sources.slice(
      sources.indexOf('export interface Household {'),
      sources.indexOf('}', sources.indexOf('export interface Household {')),
    );
    for (const field of householdFields()) {
      assert.match(interfaceBody, new RegExp(`\\n\\s*${field}\\??[:,}]`), `${field} is not a field of Household`);
    }
    const memberBody = sources.slice(
      sources.indexOf('export interface HouseholdMember {'),
      sources.indexOf('}', sources.indexOf('export interface HouseholdMember {')),
    );
    for (const field of SCHEMA_MODELS.householdMembers.fields.map((item) => item.field)) {
      assert.match(memberBody, new RegExp(`\\n\\s*${field}\\??[:,}]`), `${field} is not a field of HouseholdMember`);
    }
  });

  it('is the same model the maintenance script writes', () => {
    // `scripts/db-migrations.mjs` is a plain script with no exported types, so the
    // comparison is textual - and that is the point: the two files must state the
    // same fields and the same values, or the app and the operator migrate
    // different documents.
    const script = readFileSync('scripts/db-migrations.mjs', 'utf8');
    const model = script.slice(script.indexOf('export const MODEL = {'));
    for (const key of Object.keys(SCHEMA_MODELS) as (keyof typeof SCHEMA_MODELS)[]) {
      const body = model.slice(
        model.indexOf(`${key}: {`),
        model.length,
      ).slice(0, model.slice(model.indexOf(`${key}: {`)).indexOf('\n  },') + 5);
      const scripted = [...body.matchAll(/field: '([a-zA-Z]+)'/g)].map((match) => match[1]);
      assert.deepEqual(
        scripted.sort(),
        SCHEMA_MODELS[key].fields.map((field) => field.field).sort(),
        `${key}: the script and the app migrate different fields`,
      );
    }
    for (const category of HOUSEHOLD_DEFAULT_CATEGORIES) {
      assert.ok(script.includes(`'${category}'`), `the script lacks the default category ${category}`);
    }
    for (const place of APP_DEFAULT_MONEY_PLACES) {
      assert.ok(script.includes(`'${place.id}'`) && script.includes(`'${place.name}'`), `the script lacks the place ${place.name}`);
    }
    assert.ok(script.includes(`'${HOUSEHOLD_DEFAULT_AVATAR_COLOR}'`), 'the script uses another avatar colour');
    assert.ok(script.includes(`'MAD'`), 'the script defaults another currency');
  });
});

describe('months and profiles need no migration, and this is why', () => {
  const rules = readFileSync('firestore.rules', 'utf8');

  it('keeps the rules that let a revision-less month be written for the first time', () => {
    // A month document predating `revision`/`lastMutationId` is not a frozen
    // document: the update branch accepts a first write that bootstraps them, and
    // every writer persists the normalized month after that. Remove that escape and
    // a month migration becomes mandatory - which is what this pins.
    assert.match(rules, /!\('revision' in existing\(\)\) && incoming\(\)\.revision == 1/);
    assert.match(rules, /!\('periodStatus' in incoming\(\)\)/);
  });

  it('keeps profile fields that older documents may lack optional', () => {
    const sources = readFileSync('src/lib/store.ts', 'utf8');
    const body = sources.slice(
      sources.indexOf('export interface UserProfile {'),
      sources.indexOf('\n}', sources.indexOf('export interface UserProfile {')),
    );
    const required = [...body.matchAll(/\n\s{2}([A-Za-z0-9_]+):/g)].map((match) => match[1]);
    assert.deepEqual(required.sort(), ['currency', 'onboardingComplete', 'plan'].sort(),
      'a new required profile field needs a migration entry, not just a type');
  });
});
