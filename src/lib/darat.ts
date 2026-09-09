/**
 * Darat (دارت) — rotating savings circles (a.k.a. daret, 9or3a, tontine, ROSCA).
 *
 * This file owns three things and only these three:
 *
 *  1. The TypeScript shape of a Darat circle, its members, its rounds and its
 *     invites. These match `firestore.rules` and the `Darat*` entries in
 *     `firebase-blueprint.json`; the test `tests/darat.test.ts` pins the
 *     equality.
 *
 *  2. Pure rotation algorithms (قرعة / random, agreed / fixed order, مزايدة /
 *     bidding). They take inputs, return outputs, and never touch Firebase or
 *     React. Same input → same output, every time, on the server and the
 *     client. That is what makes a Darat "the same" for every member of the
 *     circle even if they each open it on a different device.
 *
 *  3. Normalizers (`normalizeDarat*`) that fill missing fields on stored
 *     documents so a reader never fails just because the document predates a
 *     feature. The 5-part rule in the README applies: a new required field
 *     ships with its normaliser, its rules check, its schema-migrations entry
 *     and its tests.
 *
 * UI, Firestore writes and Reminders are separate concerns and live in their
 * own files. This file is pure: no DOM, no Firebase, no time-of-day globals
 * other than the explicit `nowMs` parameter.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DaratRotation = 'random' | 'fixed' | 'bidding';
export type DaratFrequency = 'weekly' | 'biweekly' | 'monthly';
export type DaratMemberStatus = 'active' | 'left' | 'removed';
export type DaratRoundStatus = 'pending' | 'collected' | 'paid_out' | 'closed';
export type DaratPaymentStatus = 'pending' | 'paid' | 'late' | 'refunded';

/** Maximum number of members a single Darat circle can hold. */
export const DARAT_MAX_MEMBERS = 20;
/** Minimum number of members for a circle to run (organizer + at least one other). */
export const DARAT_MIN_MEMBERS = 2;

/** Result of resolving a single round in a circle. */
export interface DaratRound {
  number: number;
  /** When this round is scheduled (YYYY-MM-DD). */
  date: string;
  /** Member id (uid) who receives the pot, or null if not yet determined. */
  recipientId: string | null;
  /** Pre-discount pot for this round (contribution × active members at that round). */
  pot: number;
  /**
   * For bidding circles only: the discount the winner offered, redistributed
   * to the other members. Always 0 for `random` and `fixed` circles.
   */
  discount: number;
  status: DaratRoundStatus;
  /** Per-member payment status, keyed by member id. */
  payments: Record<string, DaratPaymentStatus>;
}

/** A member of a Darat circle. */
export interface DaratMember {
  /** Firebase Auth uid. The organizer is also a member. */
  uid: string;
  /** Display name shown to other members. */
  displayName: string;
  /**
   * Phone number the organizer typed in. Stored for the organizer's reference
   * and to display in the circle roster. Not used for authentication: the
   * actual join gate is the UUID invitation code (see `DaratInvite`).
   * The rules accept any string; the create modal enforces the loose
   * `PHONE_RE` shape before writing.
   */
  phone: string;
  /**
   * Email of the Firebase account that owns this member row. Kept on the
   * roster so the household path can still resolve "who is this user?"
   * by email. The Darat invite flow does not rely on it any more — the
   * join gate is now the UUID code on `DaratInvite`.
   */
  email: string;
  /** Whether the member is currently active. Removed/left members keep their seat in history. */
  status: DaratMemberStatus;
  /** True for the user who created the circle. Exactly one per circle. */
  isOrganizer: boolean;
  /** ISO timestamp of when the member joined. */
  joinedAt: string;
  /** Money place id the user will fund their contributions from. */
  sourcePlaceId: string;
}

/** A Darat circle — the root document. */
export interface DaratCircle {
  id: string;
  name: string;
  organizerId: string;
  /** Currency code, e.g. "MAD". Single currency per circle. */
  currency: string;
  /** Amount each member pays per round. */
  contribution: number;
  frequency: DaratFrequency;
  rotation: DaratRotation;
  /** ISO date string (YYYY-MM-DD) of the first round. */
  startDate: string;
  /** For `fixed` rotation: the agreed order of uids, recipient of round 1 first. Optional for other types. */
  fixedOrder: string[] | null;
  /**
   * For `random` rotation: the seed used by the rotation algorithm. Replaying
   * with the same seed yields the same order — that is what keeps every
   * member's device in sync.
   */
  randomSeed: string | null;
  /** Member ids in the order they joined (used as a tie-breaker). */
  memberOrder: string[];
  rounds: DaratRound[];
  /** ms-since-epoch. */
  createdAt: number;
  /** ms-since-epoch. */
  updatedAt: number;
  status: 'active' | 'closed';
  /** ISO timestamp of when the circle was closed, or null. */
  closedAt: string | null;
}

/**
 * Expiring invitation to join a Darat circle, parallel to `HouseholdInvite`.
 *
 * The join gate is the `id` itself: `id` is a UUID generated client-side
 * when the organizer creates the circle, written at both
 * `/circles/{circleId}/invites/{id}` and the top-level
 * `/daratInvites/{id}` mirror, and surfaced to the recipient as either a
 * plain code to type or a same-origin share link
 * (`<origin>/dashboard/darat?join=<id>`).
 *
 * The phone number is stored for the organizer's reference (and to
 * display in the circle roster / invite list); it is **not** the gate.
 */
export interface DaratInvite {
  id: string;
  circleId: string;
  /** Loose phone number (8+ digits, separators allowed). See `PHONE_RE`. */
  phone: string;
  /**
   * The name the organizer typed for this invitee. The roster shows it until
   * the invitee accepts and their own member row exists — without it the
   * pending seat renders as an opaque placeholder instead of a person.
   */
  displayName: string;
  invitedByUid: string;
  /** ISO timestamp. */
  expiresAt: string;
  /** ISO timestamp; null if still pending. */
  acceptedAt: string | null;
  status: 'pending' | 'accepted' | 'expired' | 'revoked';
}

// ---------------------------------------------------------------------------
// Phone validation
// ---------------------------------------------------------------------------

/**
 * Loose phone-number regex. Accepts the common shapes people type:
 *   +212 6 12 34 56 78
 *   0612345678
 *   (212) 612-345-678
 *   +1-555-123-4567
 *
 * The rule is intentionally permissive on separators and country prefixes —
 * the user knows the number; we just need enough digits to tell a real
 * phone from a typo. The digit-count check (`>= 8` after stripping
 * non-digits) lives in `validateDaratPhone` so the two checks can be
 * reported separately if a stricter UI is ever wanted.
 *
 * The same regex is used on the client (the create modal) and inside the
 * Firestore rule (`isValidDaratPhone` helper). Keep them in sync.
 */
export const PHONE_RE = /^[+]?[\d\s().-]{8,}$/;

/**
 * Test a phone string against the loose shape. The two checks — allowed
 * characters and 8+ digits — are reported together so the form can show
 * a single "invalid phone" hint. Returns `true` when the value is empty
 * too: the form decides whether the field is required, not this helper.
 */
export function isLooseDaratPhone(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (trimmed.length === 0) return true; // "no value" is not a shape error
  if (!PHONE_RE.test(trimmed)) return false;
  // 8+ digits after stripping non-digits — the "real" phone check.
  const digits = trimmed.replace(/\D/g, '');
  return digits.length >= 8;
}

// ---------------------------------------------------------------------------
// Currency / amount helpers
// ---------------------------------------------------------------------------

/** Round an amount to 2 decimals, the precision used by every Darat field. */
export function daratRoundAmount(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

/** Expected pot for a round, given contribution and number of active members. */
export function daratExpectedPot(contribution: number, memberCount: number): number {
  return daratRoundAmount(Math.max(0, contribution) * Math.max(0, memberCount));
}

// ---------------------------------------------------------------------------
// Frequency → ms
// ---------------------------------------------------------------------------

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

function frequencyMs(frequency: DaratFrequency): number {
  switch (frequency) {
    case 'weekly': return WEEK_MS;
    case 'biweekly': return 2 * WEEK_MS;
    case 'monthly': return 30 * DAY_MS; // 30-day approximation; exact calendar math handled per-round
  }
}

/**
 * Compute the date for a given round number, given a circle's start date and
 * frequency. Round 1 == startDate, round N == startDate + (N-1) × frequency.
 *
 * Uses calendar-aware month math for `monthly` so the day-of-month is
 * preserved (Jan 31 + 1 month = Feb 28/29, not Mar 3). Caller may override
 * `nowMs` for deterministic tests.
 */
export function daratRoundDate(
  startDate: string,
  roundNumber: number,
  frequency: DaratFrequency,
): string {
  if (roundNumber <= 1) return startDate;
  const [y, m, d] = startDate.split('-').map(Number);
  if (!y || !m || !d) return startDate;
  const step = roundNumber - 1;
  if (frequency === 'monthly') {
    const targetMonth = m - 1 + step;
    const targetYear = y + Math.floor(targetMonth / 12);
    const monthIndex = ((targetMonth % 12) + 12) % 12;
    const lastDay = new Date(targetYear, monthIndex + 1, 0).getDate();
    const day = Math.min(d, lastDay);
    return formatYmd(targetYear, monthIndex + 1, day);
  }
  const weeks = frequency === 'weekly' ? step : step * 2;
  const date = new Date(Date.UTC(y, m - 1, d) + weeks * WEEK_MS);
  return date.toISOString().slice(0, 10);
}

function formatYmd(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Number of full rounds for a circle = number of active members at creation. */
export function daratTotalRounds(memberOrder: string[]): number {
  return Math.max(0, memberOrder.length);
}

/** All round dates for a circle, ordered by round number. */
export function daratAllRoundDates(
  startDate: string,
  totalRounds: number,
  frequency: DaratFrequency,
): string[] {
  const out: string[] = [];
  for (let i = 1; i <= totalRounds; i++) out.push(daratRoundDate(startDate, i, frequency));
  return out;
}

// ---------------------------------------------------------------------------
// Rotation algorithms
// ---------------------------------------------------------------------------

/**
 * Deterministic fair-random rotation: shuffle member ids using a seeded
 * Fisher–Yates so every device reproduces the same order.
 *
 * Uses a tiny xorshift32 PRNG keyed off `seed` so the output is stable
 * without pulling a crypto library. The seed is stored on the circle
 * (`randomSeed`); the organizer can regenerate it to re-shuffle.
 */
export function daratRandomOrder(memberIds: string[], seed: string): string[] {
  if (memberIds.length <= 1) return memberIds.slice();
  // xorshift32 with 4-word state expanded from the seed's 32-bit hash.
  const h = stringHash32(seed);
  let s0 = (h ^ 0x9e3779b9) >>> 0;
  let s1 = Math.imul(h, 0x85ebca6b) >>> 0;
  let s2 = Math.imul(h, 0x27d4eb2f) >>> 0;
  let s3 = (Math.imul(h, 0x85ebca6b) ^ 0xc2b2ae35) >>> 0;
  const rand = (): number => {
    let t = (s0 ^ (s0 << 11)) >>> 0;
    s0 = s1;
    s1 = s2;
    s2 = s3;
    t = (t ^ (t >>> 8)) >>> 0;
    s3 = (s3 ^ (s3 >>> 19)) ^ t;
    s3 = s3 >>> 0;
    return s3 / 0xffffffff;
  };
  const arr = memberIds.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

function stringHash32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** Returns the recipient uid for round N, given a random order. */
export function daratRandomRecipient(order: string[], roundNumber: number): string | null {
  if (order.length === 0) return null;
  const idx = (roundNumber - 1) % order.length;
  return order[idx] ?? null;
}

/** Fixed-order rotation: recipient is fixedOrder[roundNumber - 1] if present. */
export function daratFixedRecipient(fixedOrder: string[], roundNumber: number): string | null {
  if (fixedOrder.length === 0) return null;
  return fixedOrder[roundNumber - 1] ?? null;
}

/**
 * Bidding rotation: each member bids a discount (≥ 0, ≤ pot). The lowest
 * non-zero bid wins; ties are broken by the order in `memberOrder`.
 *
 * Returns the winning recipient uid, the discount, and the per-member share
 * the rest will receive. `bids` is a record keyed by uid; missing entries are
 * treated as "no bid" and exclude the member from the round.
 */
export interface DaratBidResult {
  winnerId: string | null;
  discount: number;
  /** Map of uid → share of the discount they receive. */
  redistribution: Record<string, number>;
  /** True when nobody bid. */
  noBids: boolean;
}

export function daratResolveBid(
  bids: Record<string, number>,
  pot: number,
  memberOrder: string[],
): DaratBidResult {
  const entries = Object.entries(bids)
    .filter(([, amount]) => Number.isFinite(amount) && amount >= 0)
    .map(([uid, amount]) => [uid, daratRoundAmount(amount)] as const);

  if (entries.length === 0) {
    return { winnerId: null, discount: 0, redistribution: {}, noBids: true };
  }

  // Lowest bid wins. Ties broken by the order in `memberOrder` (first wins).
  entries.sort(([aUid, a], [bUid, b]) => {
    if (a !== b) return a - b;
    return memberOrder.indexOf(aUid) - memberOrder.indexOf(bUid);
  });
  const [winnerId, rawDiscount] = entries[0];
  const cappedDiscount = Math.min(daratRoundAmount(rawDiscount), pot);
  const otherUids = memberOrder.filter((uid) => uid !== winnerId);
  const share = otherUids.length > 0 ? daratRoundAmount(cappedDiscount / otherUids.length) : 0;
  const redistribution: Record<string, number> = {};
  for (const uid of otherUids) redistribution[uid] = share;
  return { winnerId, discount: cappedDiscount, redistribution, noBids: false };
}

// ---------------------------------------------------------------------------
// Round construction
// ---------------------------------------------------------------------------

export interface BuildRoundsInput {
  memberOrder: string[];
  startDate: string;
  frequency: DaratFrequency;
  contribution: number;
  rotation: DaratRotation;
  fixedOrder: string[] | null;
  randomSeed: string | null;
  /** For bidding: pre-existing per-round bids, keyed by round number. */
  bidsByRound?: Record<number, Record<string, number>>;
}

/**
 * Build the full schedule of rounds for a freshly-created circle. Rounds
 * default to `pending` and have an empty payments map. This is the canonical
 * shape that the rules write and the UI renders.
 */
export function daratBuildRounds(input: BuildRoundsInput): DaratRound[] {
  const { memberOrder, startDate, frequency, contribution, rotation } = input;
  if (memberOrder.length < DARAT_MIN_MEMBERS) return [];
  const total = daratTotalRounds(memberOrder);
  const pot = daratExpectedPot(contribution, memberOrder.length);
  const randomOrder = rotation === 'random' && input.randomSeed
    ? daratRandomOrder(memberOrder, input.randomSeed)
    : null;

  const rounds: DaratRound[] = [];
  for (let n = 1; n <= total; n++) {
    let recipientId: string | null = null;
    let discount = 0;
    if (rotation === 'random' && randomOrder) {
      recipientId = daratRandomRecipient(randomOrder, n);
    } else if (rotation === 'fixed' && input.fixedOrder) {
      recipientId = daratFixedRecipient(input.fixedOrder, n);
    } else if (rotation === 'bidding') {
      const bids = input.bidsByRound?.[n] ?? {};
      const result = daratResolveBid(bids, pot, memberOrder);
      recipientId = result.winnerId;
      discount = result.discount;
    }
    const payments: Record<string, DaratPaymentStatus> = {};
    for (const uid of memberOrder) payments[uid] = 'pending';
    rounds.push({
      number: n,
      date: daratRoundDate(startDate, n, frequency),
      recipientId,
      pot,
      discount,
      status: 'pending',
      payments,
    });
  }
  return rounds;
}

// ---------------------------------------------------------------------------
// Validation (used by the create-circle form and the rules write path)
// ---------------------------------------------------------------------------

export interface DaratCreateInput {
  name: string;
  contribution: number;
  frequency: DaratFrequency;
  rotation: DaratRotation;
  startDate: string;
  members: { displayName: string; phone: string }[];
  sourcePlaceId: string;
  organizerEmail: string;
  currency: string;
  fixedOrder?: string[] | null;
  randomSeed?: string | null;
  nowMs?: number;
}

export type DaratCreateError =
  | 'nameRequired'
  | 'amountInvalid'
  | 'membersTooFew'
  | 'membersTooMany'
  | 'startDateInvalid'
  | 'placeRequired'
  | 'noOrganizer'
  | 'duplicatePhones'
  | 'phoneFormat'
  | 'forbidden';

export interface DaratCreateValidation {
  ok: boolean;
  error?: DaratCreateError;
}

export function validateDaratCreate(input: DaratCreateInput): DaratCreateValidation {
  if (!input.name || input.name.trim().length === 0) return { ok: false, error: 'nameRequired' };
  if (!Number.isFinite(input.contribution) || input.contribution <= 0) {
    return { ok: false, error: 'amountInvalid' };
  }
  // members is the rest of the group; the organizer counts as one member too.
  const totalMembers = input.members.length + 1;
  if (totalMembers < DARAT_MIN_MEMBERS) return { ok: false, error: 'membersTooFew' };
  if (totalMembers > DARAT_MAX_MEMBERS) return { ok: false, error: 'membersTooMany' };
  if (!input.startDate || !/^\d{4}-\d{2}-\d{2}$/.test(input.startDate)) {
    return { ok: false, error: 'startDateInvalid' };
  }
  if (input.startDate && input.nowMs != null) {
    const startMs = Date.parse(input.startDate + 'T00:00:00Z');
    if (Number.isFinite(startMs) && startMs < input.nowMs - DAY_MS) {
      return { ok: false, error: 'startDateInvalid' };
    }
  }
  if (!input.sourcePlaceId) return { ok: false, error: 'placeRequired' };
  if (!input.organizerEmail) return { ok: false, error: 'noOrganizer' };

  // Per-row phone validation. Each invitee must have a name and a
  // phone that passes the loose shape check. We do not check duplicates
  // here — the create flow no longer relies on phone uniqueness; two
  // family members with the same number (or a typo'd second row) does
  // not block the write, because the join gate is now the UUID code,
  // not the phone.
  //
  // The form does run its own duplicate-phone check so the user sees
  // the problem before submit, but the server is permissive: the
  // organizer may want to enter two invitees with the same number
  // (e.g. a phone-less household member reached only by code).
  for (const m of input.members) {
    if (!m.displayName || m.displayName.trim().length === 0) {
      return { ok: false, error: 'phoneFormat' };
    }
    if (!isLooseDaratPhone(m.phone) || m.phone.trim().length === 0) {
      return { ok: false, error: 'phoneFormat' };
    }
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Normalizers (the 5-part ship contract)
// ---------------------------------------------------------------------------

/** A stored document may be missing fields added in newer versions. This fills them. */
export function normalizeDaratCircle(raw: Partial<DaratCircle> & { id: string }): DaratCircle {
  const id = raw.id;
  const memberOrder = Array.isArray(raw.memberOrder) ? raw.memberOrder.slice() : [];
  // Coerce unknown-shaped Firestore documents into the typed shape we
  // expect. Each field falls back to a safe default when the stored
  // value is missing, wrong type, or (for numbers) non-finite. The
  // type-guard + Number.isFinite pair is required by strict mode,
  // which types `Partial<T>` field accesses as `T | undefined`.
  const contribution =
    typeof raw.contribution === 'number' && Number.isFinite(raw.contribution)
      ? Math.max(0, raw.contribution)
      : 0;
  const createdAt =
    typeof raw.createdAt === 'number' && Number.isFinite(raw.createdAt) ? raw.createdAt : 0;
  const updatedAt =
    typeof raw.updatedAt === 'number' && Number.isFinite(raw.updatedAt) ? raw.updatedAt : 0;
  return {
    id,
    name: typeof raw.name === 'string' ? raw.name : '',
    organizerId: typeof raw.organizerId === 'string' ? raw.organizerId : '',
    currency: typeof raw.currency === 'string' ? raw.currency : 'MAD',
    contribution,
    frequency: raw.frequency === 'weekly' || raw.frequency === 'biweekly' || raw.frequency === 'monthly'
      ? raw.frequency
      : 'monthly',
    rotation: raw.rotation === 'fixed' || raw.rotation === 'bidding' || raw.rotation === 'random'
      ? raw.rotation
      : 'random',
    startDate: typeof raw.startDate === 'string' ? raw.startDate : '',
    fixedOrder: Array.isArray(raw.fixedOrder) ? raw.fixedOrder.slice() : null,
    randomSeed: typeof raw.randomSeed === 'string' ? raw.randomSeed : null,
    memberOrder,
    rounds: Array.isArray(raw.rounds) ? raw.rounds.map(normalizeDaratRound) : [],
    createdAt,
    updatedAt,
    status: raw.status === 'closed' ? 'closed' : 'active',
    closedAt: typeof raw.closedAt === 'string' ? raw.closedAt : null,
  };
}

export function normalizeDaratRound(raw: Partial<DaratRound>): DaratRound {
  // Same coercion pattern: number fields must be type-guard-checked
  // before Number.isFinite, otherwise strict mode treats the operand
  // as `number | undefined`.
  const number =
    typeof raw.number === 'number' && Number.isFinite(raw.number)
      ? Math.max(1, Math.trunc(raw.number))
      : 1;
  const pot =
    typeof raw.pot === 'number' && Number.isFinite(raw.pot) ? Math.max(0, raw.pot) : 0;
  const discount =
    typeof raw.discount === 'number' && Number.isFinite(raw.discount)
      ? Math.max(0, raw.discount)
      : 0;
  return {
    number,
    date: typeof raw.date === 'string' ? raw.date : '',
    recipientId: typeof raw.recipientId === 'string' ? raw.recipientId : null,
    pot,
    discount,
    status: raw.status === 'collected' || raw.status === 'paid_out' || raw.status === 'closed'
      ? raw.status
      : 'pending',
    payments: raw.payments && typeof raw.payments === 'object'
      ? Object.fromEntries(
          Object.entries(raw.payments).map(
            ([uid, status]) => [uid, normalizeDaratPaymentStatus(status)],
          ),
        )
      : {},
  };
}

function normalizeDaratPaymentStatus(value: unknown): DaratPaymentStatus {
  return value === 'paid' || value === 'late' || value === 'refunded' ? value : 'pending';
}

export function normalizeDaratMember(raw: Partial<DaratMember> & { uid: string }): DaratMember {
  return {
    uid: raw.uid,
    displayName: typeof raw.displayName === 'string' ? raw.displayName : '',
    phone: typeof raw.phone === 'string' ? raw.phone : '',
    // Email is still on the roster (the household path uses it to resolve
    // "who is this user?"), but for a Darat circle the email is the
    // signed-in user's own address, not the invitee's. Old documents that
    // predate the phone migration may have the invitee's email here; the
    // join flow does not depend on it.
    email: typeof raw.email === 'string' ? raw.email : '',
    status: raw.status === 'left' || raw.status === 'removed' ? raw.status : 'active',
    isOrganizer: Boolean(raw.isOrganizer),
    joinedAt: typeof raw.joinedAt === 'string' ? raw.joinedAt : new Date(0).toISOString(),
    sourcePlaceId: typeof raw.sourcePlaceId === 'string' ? raw.sourcePlaceId : '',
  };
}

export function normalizeDaratInvite(raw: Partial<DaratInvite> & { id: string }): DaratInvite {
  return {
    id: raw.id,
    circleId: typeof raw.circleId === 'string' ? raw.circleId : '',
    // Phone may be missing on documents predating the phone migration;
    // the join flow tolerates that — the gate is the id, not the phone.
    phone: typeof raw.phone === 'string' ? raw.phone : '',
    // Same tolerance for the name: invites created before this field existed
    // simply fall back to the phone on the roster.
    displayName: typeof raw.displayName === 'string' ? raw.displayName : '',
    invitedByUid: typeof raw.invitedByUid === 'string' ? raw.invitedByUid : '',
    expiresAt: typeof raw.expiresAt === 'string' ? raw.expiresAt : '',
    acceptedAt: typeof raw.acceptedAt === 'string' ? raw.acceptedAt : null,
    status: raw.status === 'accepted' || raw.status === 'expired' || raw.status === 'revoked'
      ? raw.status
      : 'pending',
  };
}

// ---------------------------------------------------------------------------
// Convenience: upcoming round for a member (used by the dashboard widget)
// ---------------------------------------------------------------------------

/** Return the next round whose date is on or after `today`, for the given member. */
export function daratNextRound(
  circle: DaratCircle,
  memberId: string,
  today: string,
): { round: DaratRound; isRecipient: boolean } | null {
  for (const round of circle.rounds) {
    if (round.date < today) continue;
    if (round.status === 'closed') continue;
    return { round, isRecipient: round.recipientId === memberId };
  }
  return null;
}
