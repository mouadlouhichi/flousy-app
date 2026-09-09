/**
 * Client-side builders that take user-typed create input and produce the
 * Firestore-shaped document. Lives next to the UI so the pure library
 * (`./darat.ts`) stays free of Firebase.
 *
 * The actual validation, the rotation algorithms, and the normalizers all
 * come from `./darat.ts` — this file only orchestrates the fields the
 * organizer enters into the shape the rules expect to find on a create.
 */

import {
  DARAT_MAX_MEMBERS,
  DARAT_MIN_MEMBERS,
  daratBuildRounds,
  validateDaratCreate,
  type DaratCircle,
  type DaratFrequency,
  type DaratRotation,
  type DaratRound,
} from './darat';

export interface DaratCreateInput {
  name: string;
  contribution: number;
  frequency: DaratFrequency;
  rotation: DaratRotation;
  startDate: string;
  members: { displayName: string; phone: string }[];
  sourcePlaceId: string;
  fixedOrder?: string[] | null;
  randomSeed?: string | null;
}

export interface DaratCreateDefaultsInput extends DaratCreateInput {
  organizerId: string;
  organizerEmail: string;
  organizerDisplayName: string;
  currency: string;
  /**
   * The Firestore document id the circle will be written under. The ref is
   * created (and its id known) before the transaction runs, so the stored
   * `id` field can carry the real value. The create flow used to store an
   * empty string here — and every reader spreads the stored fields over the
   * snapshot id, so the empty value clobbered the real one and the detail
   * screen addressed `circles/` (an invalid reference).
   */
  circleId: string;
}

export interface DaratCreateDefaults {
  circle: Omit<DaratCircle, 'createdAt' | 'updatedAt'>;
  rounds: DaratRound[];
  errors: string[];
}

const DEFAULT_INVITE_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Build the document body for a new Darat circle. Validates the input and
 * returns the validated, default-filled object. The caller is responsible for
 * writing the document and the per-user pointer; this function does not
 * touch Firestore.
 */
export function buildDaratCreateDefaults(input: DaratCreateDefaultsInput): {
  circle: Omit<DaratCircle, 'createdAt' | 'updatedAt'>;
  rounds: DaratRound[];
} {
  // Validation
  if (typeof input.circleId !== 'string' || input.circleId.length === 0) {
    // The stored `id` field is what older documents carried as '' — the
    // bug that made every reader normalize the circle to an empty id
    // ("Circle not found", invalid `circles/` document references).
    // Refuse loudly instead of ever writing it again.
    throw new Error('darat create requires the Firestore document id (circleId)');
  }
  const v = validateDaratCreate({
    name: input.name,
    contribution: input.contribution,
    frequency: input.frequency,
    rotation: input.rotation,
    startDate: input.startDate,
    members: input.members,
    sourcePlaceId: input.sourcePlaceId,
    organizerEmail: input.organizerEmail,
    currency: input.currency,
    nowMs: Date.now(),
  });
  if (!v.ok) {
    throw new Error(`darat create validation failed: ${v.error}`);
  }

  const memberOrder = [
    input.organizerId,
    ...input.members.map((m) => m.phone.trim()),
  ];

  // Until each invitee accepts their invite we do not have a uid for them.
  // We use the phone (the only identity we have at create time) as the
  // placeholder in the round schedule; the rules normalize that to the
  // uid when the row is updated on accept.
  const knownUids = new Set([input.organizerId]);
  const memberOrderForRounds: string[] = [];
  for (const id of memberOrder) {
    if (knownUids.has(id) || /[\d]/.test(id)) {
      memberOrderForRounds.push(id);
    }
  }

  const randomSeed = input.rotation === 'random'
    ? (input.randomSeed ?? generateRandomSeed())
    : null;
  const fixedOrder = input.rotation === 'fixed' ? (input.fixedOrder ?? null) : null;

  const rounds = daratBuildRounds({
    memberOrder: memberOrderForRounds,
    startDate: input.startDate,
    frequency: input.frequency,
    contribution: input.contribution,
    rotation: input.rotation,
    fixedOrder,
    randomSeed,
  });

  const circle: Omit<DaratCircle, 'createdAt' | 'updatedAt'> = {
    // The real document id, passed in by the caller: the rules require the
    // stored `id` to be a string, and storing '' here used to clobber the
    // snapshot id on every read (see DaratCreateDefaultsInput.circleId).
    id: input.circleId,
    name: input.name.trim(),
    organizerId: input.organizerId,
    currency: input.currency,
    contribution: input.contribution,
    frequency: input.frequency,
    rotation: input.rotation,
    startDate: input.startDate,
    fixedOrder,
    randomSeed,
    memberOrder,
    rounds,
    status: 'active',
    closedAt: null,
  };

  return { circle, rounds };
}

/** A short, URL-safe random seed (e.g. "8f3k2m-9b"). */
export function generateRandomSeed(): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  for (let i = 0; i < 10; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
    if (i === 4) out += '-';
  }
  return out;
}

/** Re-export the member-count bounds so the form can show them inline. */
export { DARAT_MAX_MEMBERS, DARAT_MIN_MEMBERS };
