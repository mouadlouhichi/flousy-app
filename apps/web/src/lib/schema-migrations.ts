/**
 * The legacy-document contract: what a stored document must hold, and what to do
 * when it does not.
 *
 * `firestore.rules` and the app's types both describe required data, and neither
 * one can create it. A household created before `moneyPlaces` existed, or a member
 * row created before `avatarColor` did, reads fine - the normalizers fill the gap
 * in memory - and then *every write to it is refused*, because the write carries
 * the stored shape with it. That is the class of bug this file exists for: the
 * document is not corrupt, it is merely older than the feature, and the user sees a
 * permission error rather than a schema gap.
 *
 * Two things follow, and they are deliberately separate:
 *
 * - `repairable` fields have a value derivable from the document itself, so the app
 *   can write it on the owner's behalf and the workspace is whole again. The value
 *   must be the one the reader already assumes - the test suite pins that equality -
 *   or the migration would visibly change somebody's budget.
 * - `reportOnly` fields cannot be derived without guessing facts the app does not
 *   have (who owned this household, when was it created, when did it expire). Those
 *   are named, never invented, and `scripts/db-migrations.mjs` is where they are
 *   resolved by the person who has the information.
 *
 * A new feature that adds a required field to a persisted type belongs here, and
 * `tests/schema-migrations.test.ts` fails when a field the rules demand of a stored
 * document is not in this model.
 */
import { DEFAULT_MONEY_PLACES, type MoneyPlaceConfig } from './store';

/**
 * The categories a household starts with. Exported from here rather than from the
 * data layer so the reader's defaults and the migration's defaults are one value:
 * a backfilled document must be indistinguishable from the one the app would have
 * shown in memory.
 */
export const HOUSEHOLD_DEFAULT_CATEGORIES = [
  'Groceries', 'Transport', 'Rent', 'Entertainment', 'Health',
  'Utilities', 'Dining Out', 'Shopping', 'Subscriptions',
];

/** The avatar colour a member row gets when it never had one (`db.ts`'s owner row uses the same). */
export const HOUSEHOLD_DEFAULT_AVATAR_COLOR = '#00685f';

/**
 * Registry keys, not Firestore paths. `householdMembers` is stored at
 * `households/{householdId}/members`; the script maps each key to the collection id it
 * really addresses, and `tests/schema-migrations.test.ts` pins both spellings against
 * `firestore.rules` so the two can never drift apart in silence.
 */
export type PersistedCollection = 'households' | 'householdMembers' | 'householdInvites';

export interface SchemaField {
  /** Field name as stored in the document. */
  field: string;
  /**
   * What stops working while the document has no value for it. Written for the
   * person running the migration script: a refusal with no cause is what sent
   * users to a support thread in the first place.
   */
  breaks: string;
  /**
   * The value to store, or `null` when no value can be derived from the document.
   * `null` means "reported, never guessed".
   */
  repair: (document: Readonly<Record<string, unknown>>) => unknown | null;
}

export interface SchemaModel {
  collection: PersistedCollection;
  /**
   * Firestore rules reject an *update* whose post-image lacks these, so a document
   * older than the field cannot be edited at all - which is why an empty value
   * counts as missing: the stored shape is what the write must reproduce.
   */
  fields: readonly SchemaField[];
}

/** A value the app's readers treat as "not stored": absent, or present but blank. */
function needsValue(document: Readonly<Record<string, unknown>>, field: string): boolean {
  if (!Object.prototype.hasOwnProperty.call(document, field)) return true;
  const value = document[field];
  if (value === undefined || value === null) return true;
  if (typeof value === 'string' && value.trim() === '') return true;
  if (Array.isArray(value) && value.length === 0) return true;
  return false;
}

const householdModel: SchemaModel = {
  collection: 'households',
  fields: [
    {
      field: 'currency',
      breaks: '`validHouseholdConfig()` requires it on every household write, so a workspace created '
        + 'before the field existed refuses settings changes, renames and plan-owner repairs alike.',
      repair: (document) => (needsValue(document, 'currency') ? 'MAD' : null),
    },
    {
      field: 'moneyPlaces',
      breaks: 'required by `validHouseholdConfig()`, and it is what the cash-location tabs read; an '
        + 'absent list means the workspace has no place to move money from.',
      repair: (document) => (needsValue(document, 'moneyPlaces')
        ? DEFAULT_MONEY_PLACES.map((place) => ({ ...place })) as MoneyPlaceConfig[]
        : null),
    },
    {
      field: 'activeCategories',
      breaks: 'required by `validHouseholdConfig()`; the category pickers fall back to the defaults in '
        + 'memory, so the gap is invisible until a write is refused.',
      repair: (document) => (needsValue(document, 'activeCategories') ? [...HOUSEHOLD_DEFAULT_CATEGORIES] : null),
    },
    {
      field: 'name',
      breaks: '`boundedText(incoming().name, 100)` on create and the roster header; a blank name renders '
        + 'an untitled workspace.',
      repair: (document) => (needsValue(document, 'name') ? 'Household' : null),
    },
    {
      field: 'planOwnerId',
      breaks: 'the household update rule compares it against the stored value: `ownerId` is present but '
        + '`planOwnerId` is not, and the reader silently borrows the owner while the write has nothing to '
        + 'compare. Derived from `ownerId`, which is what the field means for a document that predates it.',
      repair: (document) => (needsValue(document, 'planOwnerId')
        ? (needsValue(document, 'ownerId') ? null : String(document.ownerId))
        : null),
    },
    {
      field: 'entitlementOwnerId',
      breaks: 'the account whose plan pays for the workspace. `householdEntitled()` reads it, so a '
        + 'household that never stored one is refused on every shared write until it is bound - which is '
        + 'what the in-app repair does, under rules that allow the write.',
      repair: (document) => {
        if (!needsValue(document, 'entitlementOwnerId')) return null;
        const fallback = !needsValue(document, 'planOwnerId')
          ? String(document.planOwnerId)
          : !needsValue(document, 'ownerId') ? String(document.ownerId) : '';
        return fallback || null;
      },
    },
    {
      field: 'ownerId',
      breaks: 'the only identity the rules trust. Nothing in the document says who it was, and guessing '
        + 'would hand a workspace to the wrong account - resolve it in the console or the script, where '
        + 'the operator can see the member rows.',
      repair: () => null,
    },
    {
      field: 'createdAt',
      breaks: 'frozen on every update (`incoming().get(\'createdAt\', \'\') == existing().get(...)`), and the '
        + 'in-memory reader substitutes the epoch. Writing that date into the document would make the '
        + 'guess permanent, so it is reported instead.',
      repair: () => null,
    },
  ],
};

const memberModel: SchemaModel = {
  collection: 'householdMembers',
  fields: [
    {
      field: 'userId',
      breaks: 'the row is keyed by member id and the rules compare `incoming().userId` against the '
        + 'authenticated uid; a row with no `userId` cannot be claimed or edited by the account it belongs '
        + 'to. Derived from the document id, which is how every writer keys it.',
      repair: (document) => (needsValue(document, 'userId')
        ? (needsValue(document, 'id') ? null : String(document.id))
        : null),
    },
    {
      field: 'displayName',
      breaks: 'the roster label and every "by X" line; readers fall back to the email, so a blank value '
        + 'shows an empty avatar.',
      repair: (document) => {
        if (!needsValue(document, 'displayName')) return null;
        const email = typeof document.email === 'string' ? document.email.trim() : '';
        const local = email.split('@')[0] ?? '';
        return local || null;
      },
    },
    {
      field: 'avatarColor',
      breaks: 'cosmetic only - `backgroundColor: undefined` paints an unstyled chip - but it is required by '
        + 'the member type, so a row written before the field existed is incomplete forever.',
      repair: (document) => (needsValue(document, 'avatarColor') ? HOUSEHOLD_DEFAULT_AVATAR_COLOR : null),
    },
  ],
};

const inviteModel: SchemaModel = {
  collection: 'householdInvites',
  fields: [
    {
      field: 'expiresAtMs',
      breaks: 'the acceptance rule compares it against `request.time.toMillis()`. Invites written before '
        + 'numeric expiry only hold `expiresAt`, and a missing property aborts the evaluation, so the '
        + 'recipient is refused with a bare permission error rather than "this invitation is old". '
        + 'Backfilled from the stored ISO date, which is the same instant.',
      repair: (document) => {
        if (!needsValue(document, 'expiresAtMs')) return null;
        const iso = typeof document.expiresAt === 'string' ? document.expiresAt.trim() : '';
        if (!iso) return null;
        const parsed = Date.parse(iso);
        return Number.isFinite(parsed) ? parsed : null;
      },
    },
  ],
};

export const SCHEMA_MODELS: Record<PersistedCollection, SchemaModel> = {
  households: householdModel,
  householdMembers: memberModel,
  householdInvites: inviteModel,
};

export interface DocumentMigration {
  /** Fields to write, each already derived from this document. Empty means the document is whole. */
  patch: Record<string, unknown>;
  /** Fields with no value in the document and nothing to derive it from. */
  unresolved: string[];
  /** Every field examined that was blank or absent, whether or not it could be filled. */
  missing: string[];
}

/**
 * Compare one stored document against a model. Returns the write that would make it
 * whole and the list of gaps only a human can close; both empty for a document that
 * already matches the current shape, so running the migration repeatedly is safe.
 */
export function planDocumentMigration(
  collection: PersistedCollection,
  document: Record<string, unknown> | null | undefined,
): DocumentMigration {
  const model = SCHEMA_MODELS[collection];
  const patch: Record<string, unknown> = {};
  const unresolved: string[] = [];
  const missing: string[] = [];
  if (!document || !model) return { patch, unresolved, missing };
  for (const field of model.fields) {
    if (!needsValue(document, field.field)) continue;
    missing.push(field.field);
    const value = field.repair(document);
    if (value === null || value === undefined) unresolved.push(field.field);
    else patch[field.field] = value;
  }
  return { patch, unresolved, missing };
}

/** Why the maintenance script should not touch a document at all (nothing to add). */
export function documentNeedsMigration(
  collection: PersistedCollection,
  document: Record<string, unknown> | null | undefined,
): boolean {
  const plan = planDocumentMigration(collection, document);
  return Object.keys(plan.patch).length > 0 || plan.unresolved.length > 0;
}

/**
 * The fields a *client* may write for a household: the ones the household's own
 * owner is allowed to add under the published rules, which is everything derived
 * from the document itself. `unresolved` gaps stay with the script, because the
 * app would have to invent them.
 */
export function planHouseholdBackfill(household: Partial<import('./household').Household> | null | undefined): Record<string, unknown> {
  const { patch } = planDocumentMigration('households', (household ?? {}) as Record<string, unknown>);
  return patch;
}
