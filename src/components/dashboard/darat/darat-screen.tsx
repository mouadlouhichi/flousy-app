'use client';

/**
 * Darat (rotating savings circle) screen.
 *
 * Self-contained UI: a member listing, a "create circle" entry point, a per-
 * circle detail view with the round timeline, and the in-place actions (mark
 * a round as paid, leave the circle, close it, edit the circle as the
 * organizer). All data is loaded from Firestore directly.
 *
 * Pro gate: when the user is not Pro, only the gating card is shown — the
 * create button is hidden and the join flow is replaced with a CTA.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  runTransaction,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { useAuth } from '@/lib/auth-context';
import { useLanguage } from '@/lib/i18n-context';
import { useCurrency } from '@/lib/currency-context';
import { db as firestoreDb } from '@/lib/firebase-db';
import { isProUser } from '@/lib/pro-features';
import { formatMessage } from '@/lib/i18n-core';
import { buildDaratCreateDefaults, type DaratCreateDefaultsInput } from '@/lib/darat-firestore';
import {
  daratCircleFromSnapshot,
  type DaratCircle,
  type DaratRotation,
  type DaratFrequency,
} from '@/lib/darat';
import { AppIcon } from '@/components/ui/app-icon';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ProLockedCard } from '@/components/dashboard/pro-locked-card';
import { DaratCreateModal } from './darat-create-modal';
import { DaratJoinModal } from './darat-join-modal';
import { DaratDetailScreen } from './darat-detail-screen';
import { DaratCircleCard, DaratHero } from './darat-ui';

type View =
  | { kind: 'list' }
  | { kind: 'detail'; circleId: string };

/**
 * The deployment marker this client build expects to find in the PUBLISHED
 * Firestore rules (Firebase console → Firestore → Rules, first lines).
 * Older published rulesets deny every darat read with a bare
 * "Missing or insufficient permissions" — every diagnostic log below names
 * this marker so a mismatch is identifiable from the console alone.
 */
const DARAT_RULES_MARKER = 'darat read-rules v3';

/**
 * Diagnostics UI (the in-app rules canary + verdict banner). Hidden for now
 * — reads are healthy, so the section is noise. Flip to true to bring back
 * the auto-check, the verdict banner and the re-run button.
 */
const SHOW_RULES_CHECK = false;

/**
 * A generated invite that the create modal can present to the organizer
 * so they can share a same-origin link with each invitee. The `id` is the
 * UUID that both `/circles/{cid}/invites/{id}` and
 * `/daratInvites/{id}` are written under; it is the code the recipient
 * types or follows to join.
 */
export interface InviteSummary {
  id: string;
  displayName: string;
  phone: string;
}

export function DaratScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, profile, loading: authLoading } = useAuth();
  const { messages: m, intlLocale } = useLanguage();
  const { currency: userCurrency } = useCurrency();
  // Shared handle: `null` when Firebase isn't configured (demo / preview),
  // in which case the screen simply shows the empty state instead of crashing.
  const db = firestoreDb;

  const isPro = isProUser(profile);
  // Firebase console deep links for the unavailable rows (build-time
  // project id from the initialized app, when Firebase is configured).
  const projectId = db
    ? ((db.app?.options as { projectId?: string } | undefined)?.projectId ?? null)
    : null;

  const [circles, setCircles] = useState<DaratCircle[]>([]);
  const [circlesReady, setCirclesReady] = useState(false);
  // The per-circle docs behind the pointer rows were refused (rules or
  // network). Distinct from `loadError` (the pointer stream itself died):
  // either one means "we know the load failed", which the detail view
  // turns into an error card instead of an endless spinner.
  const [docsLoadFailed, setDocsLoadFailed] = useState(false);
  // Pointer rows whose circle doc could not be fetched. The owner still
  // sees them listed (as unavailable rows) — the pointer stream is the
  // source of truth for WHAT is mine, even when a doc read is refused.
  const [failedCircleIds, setFailedCircleIds] = useState<string[]>([]);
  // Set when a rules denial was probed: 'stale-rules' means the account IS
  // a member and only an outdated deployed ruleset explains the refusal;
  // 'not-member' means the account has no active seat in that circle.
  const [denialVerdict, setDenialVerdict] = useState<'stale-rules' | 'not-member' | null>(null);
  // Latest pointer-removal closure from the subscription effect, so the
  // unavailable rows can offer a remove action without re-subscribing.
  const removeUnavailableRef = useRef<((circleId: string) => Promise<void>) | null>(null);
  const removeUnavailable = useCallback((circleId: string) => {
    return removeUnavailableRef.current?.(circleId) ?? Promise.resolve();
  }, []);
  // In-app rules verification: create a throwaway circle with the exact
  // production path, try to read it back, then delete it. A fresh circle is
  // provably owned by the caller, so a refused read can ONLY mean the
  // published ruleset is not this file — no console spelunking required.
  // (The runner lives right after handleCreate, which it reuses.)
  const [rulesCheck, setRulesCheck] = useState<{
    status: 'idle' | 'running' | 'ok' | 'denied' | 'error' | 'createFailed';
  }>({ status: 'idle' });
  const rulesCheckRan = useRef(false);
  const [view, setView] = useState<View>({ kind: 'list' });
  // The id of a circle created/joined in this session. The live snapshots
  // surface it a tick after the transaction commits, so while the detail
  // view is waiting on exactly this circle we render a loading state
  // instead of flashing the "Circle not found" alert.
  const [pendingDetailId, setPendingDetailId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [joinInitialCode, setJoinInitialCode] = useState<string | undefined>(undefined);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Share-link landing: when the URL carries `?join=<code>` the user
  // clicked a same-origin link shared by an organizer. Open the join
  // modal pre-filled with the code so the recipient just confirms.
  // We strip the query after opening so a reload does not bounce
  // them back to the modal unexpectedly.
  useEffect(() => {
    const join = searchParams.get('join');
    if (!join) return;
    if (joinInitialCode === join) return;
    setJoinInitialCode(join);
    setJoinOpen(true);
    // Replace history so the modal does not re-open on refresh.
    const next = new URL(window.location.href);
    next.searchParams.delete('join');
    const cleaned = next.pathname + (next.search ? next.search : '');
    window.history.replaceState({}, '', cleaned);
  }, [searchParams, joinInitialCode]);

  // Subscribe to the user's circles pointer (`users/{uid}/circles`). Every
  // member — the organizer included — gets a pointer row when a circle is
  // created or joined, so this single stream is a complete "my circles"
  // source. The old second source (a `circles` where organizerId == uid
  // scan) is gone on purpose: Firestore rules cannot inspect a query's
  // `where` filters, so that list can never be granted safely and now
  // denies by design (`allow list: if false`).
  useEffect(() => {
    if (!user || !db) {
      // While auth is bootstrapping we don't start subscriptions and
      // we don't show the empty state. Once auth resolves to a real
      // user the effect re-runs and the subscriptions come online.
      if (!authLoading) {
        setCircles([]);
        setCirclesReady(true);
      }
      return;
    }
    let cancelled = false;
    const pointerRef = collection(db, 'users', user.uid, 'circles');

    const mergeDoc = (
      docs: { id: string; data?: () => unknown; exists: () => boolean }[],
    ) => {
      const out: DaratCircle[] = [];
      for (const s of docs) {
        if (s.exists()) {
          out.push(
            daratCircleFromSnapshot(
              s.id,
              (s.data?.() as Record<string, unknown>) ?? {},
            ),
          );
        }
      }
      setCircles((prev) => {
        const merged = new Map(prev.map((c) => [c.id, c]));
        for (const c of out) merged.set(c.id, c);
        const next = Array.from(merged.values());
        next.sort((a, b) => b.createdAt - a.createdAt);
        return next;
      });
    };

    // Called when the server refuses to read a circle doc. Every version of
    // these rules allows a signed-in user to read their OWN member row
    // (`memberId == request.auth.uid` — a resource-free branch), so probing
    // it separates a stale deployed ruleset from a data problem:
    //   * probe DENIED            → the live ruleset is not this file at all.
    //   * probe exists + active   → the caller IS a member; only an outdated
    //     ruleset (one without the read twins) can explain the circle denial.
    //   * probe missing / inactive → the account genuinely has no seat in
    //     this circle (wrong account, or a pointer row left behind).
    const diagnoseCircleDenial = async (circleId: string): Promise<'stale-rules' | 'not-member'> => {
      try {
        const memberSnap = await getDoc(doc(db, 'circles', circleId, 'members', user.uid));
        if (memberSnap.exists()) {
          const status = (memberSnap.data() as { status?: string }).status;
          if (status === 'active') {
            console.error(
              `[darat] READ DENIED on circles/${circleId} but ${user.uid} IS an active member.\n` +
              `The LIVE Firestore rules are older than this build (expected marker: "${DARAT_RULES_MARKER}").\n` +
              'Fix — from the repo root run:\n' +
              '  firebase use <your-project-id> && firebase deploy --only firestore:rules\n' +
              'Verify — Firebase console → Firestore → Rules: the published text must contain the marker above.',
            );
            return 'stale-rules';
          }
          console.warn(`[darat] member row for ${circleId} exists but status="${status}" — the account has no active seat.`);
          return 'not-member';
        }
        console.warn(
          `[darat] no member row at circles/${circleId}/members/${user.uid} — ` +
          'this account is neither organizer nor member of that circle.\n' +
          'CONFIRM IN 10 SECONDS — Firebase console → Firestore → data, open:\n' +
          `  circles/${circleId}\n` +
          'and read its organizerId field:\n' +
          `  • organizerId == ${user.uid}  -> the published rules are STILL an old ` +
          'version (they must contain "darat read-rules v3") — re-paste firestore.rules.\n' +
          '  • organizerId is something else -> these circles belong to another ' +
          'account; remove them from this list with the ✕ action.',
        );
        return 'not-member';
      } catch (probeErr) {
        console.warn('[darat] self member-row probe denied too — the live ruleset predates the darat self-read branch', probeErr);
        return 'stale-rules';
      }
    };

    const unsubPointer = onSnapshot(
      pointerRef,
      async (snap) => {
        if (cancelled) return;
        setLoadError(null);
        setDenialVerdict(null);
        const ids = snap.docs.map((d) => d.id);
        if (ids.length === 0) {
          // An empty pointer collection is a perfectly valid "no circles
          // yet" outcome, not an error.
          setCircles([]);
          setFailedCircleIds([]);
          setCirclesReady(true);
          setDocsLoadFailed(false);
          return;
        }
        // allSettled so one refused circle never hides the rest of the
        // list: fulfilled docs render as cards, rejected ids stay visible
        // as unavailable rows below.
        const settled = await Promise.allSettled(
          ids.map((id) => getDoc(doc(db, 'circles', id))),
        );
        if (cancelled) return;
        // Plain discriminated-union narrowing (no custom type predicates):
        // the generic snapshot types shift between environments, and a
        // hand-written predicate across PromiseSettledResult broke CI's
        // typecheck. `r.status` narrowing needs no annotations at all.
        type CircleSnapshot = { id: string; data?: () => unknown; exists: () => boolean };
        const docs: CircleSnapshot[] = [];
        const failedIds: string[] = [];
        let firstRejection: { reason?: unknown } | null = null;
        for (let i = 0; i < settled.length; i++) {
          const r = settled[i];
          if (r.status === 'fulfilled') {
            docs.push(r.value);
          } else {
            failedIds.push(ids[i]);
            if (!firstRejection) firstRejection = r;
          }
        }
        mergeDoc(docs);
        setFailedCircleIds(failedIds);
        setDocsLoadFailed(failedIds.length > 0);
        setCirclesReady(true);
        if (failedIds.length === 0) {
          setLoadError(null);
          setDenialVerdict(null);
          // Healthy-sync receipt: reads succeeded, so the published rules
          // include this build's marker. If a later report shows this line,
          // the rules were fine at that moment — great for correlating
          // "it worked yesterday" reports with deploy history.
          console.info(`[darat] ${docs.length} circle(s) synced — reads OK (rules marker "${DARAT_RULES_MARKER}" confirmed)`);
          return;
        }
        const code = (firstRejection?.reason as { code?: string } | null)?.code;
        console.warn(`[darat] ${failedIds.length} circle doc(s) could not be read`, failedIds, firstRejection?.reason);
        if (code === 'permission-denied') {
          const verdict = await diagnoseCircleDenial(failedIds[0]);
          if (cancelled) return;
          setDenialVerdict(verdict);
          setLoadError(verdict === 'not-member' ? 'circleOtherAccount' : 'rulesDenied');
        } else {
          setDenialVerdict(null);
          setLoadError('networkError');
        }
      },
      (err) => {
        console.warn('[darat] pointer snapshot failed', err);
        if (cancelled) return;
        setLoadError(
          (err as { code?: string } | null)?.code === 'permission-denied'
            ? 'rulesDenied'
            : 'networkError',
        );
        setCirclesReady(true);
      },
    );

    // The pointer row is the user's own "my circles" index — deleting it is
    // allowed by `owner(uid)` under every version of the rules, so a stale
    // row (circle from another account, or wiped test data) can always be
    // removed from the list client-side. The live listener re-emits without
    // the row and the UI recomputes.
    const removeUnavailable = async (circleId: string) => {
      if (!user) return;
      try {
        await deleteDoc(doc(db, 'users', user.uid, 'circles', circleId));
      } catch (err) {
        console.warn('[darat] could not remove pointer row', circleId, err);
      }
    };
    removeUnavailableRef.current = removeUnavailable;

    return () => {
      cancelled = true;
      unsubPointer();
      removeUnavailableRef.current = null;
    };
    // `circles` is intentionally not listed in deps: the subscription
    // merges snapshots into the existing list, so resubscribing on every
    // render would be both wasteful and flickery.
  }, [db, user, authLoading]);

  // Build a new circle with the minimum required fields. The organizer can
  // then edit frequency / rotation / start date / source place from the
  // detail screen.
  const handleCreate = useCallback(async (input: {
    name: string;
    contribution: number;
    members: { displayName: string; phone: string }[];
    organizerParticipates: boolean;
    startDate?: string;
  }, opts?: { silent?: boolean }): Promise<{ ok: boolean; circleId?: string; invites?: InviteSummary[]; error?: string }> => {
    if (!user || !db) return { ok: false, error: 'noUser' };
    // Sensible defaults; the user edits them on the next screen.
    const defaultsInput: DaratCreateDefaultsInput = {
      name: input.name,
      contribution: input.contribution,
      members: input.members,
      organizerId: user.uid,
      organizerEmail: user.email ?? '',
      organizerDisplayName: (user.displayName?.trim()) || user.email || 'Organizer',
      currency: userCurrency,
      organizerParticipates: input.organizerParticipates,
      // Defaults the user edits on the detail screen.
      frequency: 'monthly',
      rotation: 'random',
      // The create form picks the first round date; fall back to a week
      // out for programmatic callers.
      startDate: input.startDate?.trim() || (() => {
        const d = new Date();
        d.setUTCDate(d.getUTCDate() + 7);
        return d.toISOString().slice(0, 10);
      })(),
      sourcePlaceId: 'bank',
      fixedOrder: null,
      randomSeed: null,
    };
    // Allocate the document ref before building the body so the body can
    // carry its real id — the rules require `doc.id is string`, and an
    // empty placeholder would be persisted and shadow the doc id on read.
    const circleRef = doc(collection(db, 'circles'));
    const defaults = buildDaratCreateDefaults(defaultsInput, circleRef.id);
    const now = Date.now();
    const ledgerCol = collection(db, 'circles', circleRef.id, 'ledger');
    const expiresAt = new Date(now + 14 * 24 * 60 * 60 * 1000).toISOString();
    // Trim and normalise the typed phone numbers. The rules accept any
    // string; the create modal already ran the loose shape check. We
    // trim here so the row stored in Firestore is what the user
    // actually sees on their screen.
    const normalisedInvites = input.members.map((m) => ({
      displayName: m.displayName.trim(),
      phone: m.phone.trim(),
    }));
    // The invite summary returned to the modal so it can render
    // per-invitee share links. Each entry carries the generated UUID
    // (the doc id) and the phone that the organizer typed.
    const inviteSummaries: InviteSummary[] = [];
    // All six writes (circle, organizer member row, per-user pointer,
    // initial ledger row, every in-circle invite, every top-level
    // invite mirror) commit atomically. Splitting them into separate
    // setDoc calls would either leave the circle in a half-created
    // state on a rule rejection, or require the rules to know about
    // the chicken-and-egg between the member row and the pointer.
    // The transaction also lets the rules read the freshly-written
    // member row when checking the pointer's `isCircleMember` guard.
    try {
      await runTransaction(db, async (tx) => {
        tx.set(circleRef, {
          ...defaults.circle,
          createdAt: now,
          updatedAt: now,
        });
        // Organizer's own member row — only when they participate in the
        // rotation. An owner who opted out keeps owner rights through
        // `organizerId` (edit/close/read) without a seat in the rounds.
        if (input.organizerParticipates) {
          tx.set(doc(db, 'circles', circleRef.id, 'members', user.uid), {
            uid: user.uid,
            // The rules require a non-empty displayName — an account whose
            // displayName is '' would be rejected, so fall back to the email.
            displayName: (user.displayName?.trim()) || user.email || 'Organizer',
            // The organizer's email identifies their SmartJib account;
            // it is not used as an invite gate. We keep it on the row
            // for the household path.
            email: (user.email ?? '').toLowerCase(),
            phone: '',
            status: 'active',
            isOrganizer: true,
            joinedAt: new Date(now).toISOString(),
            sourcePlaceId: 'bank',
          });
        }
        // Per-user pointer so the dashboard widget can list "your
        // circles" without scanning the shared collection. Written for
        // participating AND non-participating owners alike: the pointer
        // stream is what makes "my circles" complete.
        tx.set(doc(db, 'users', user.uid, 'circles', circleRef.id), {
          uid: user.uid,
          circleId: circleRef.id,
          joinedAt: new Date(now).toISOString(),
        });
        // Initial ledger entry. The ledger create rule requires the row to
        // carry its own doc id, so allocate the ref before the transaction
        // body and write it into the document.
        const createdLedgerRef = doc(ledgerCol);
        tx.set(createdLedgerRef, {
          id: createdLedgerRef.id,
          circleId: circleRef.id,
          uid: user.uid,
          kind: 'created',
          at: now,
        });
        // In-circle invite and the top-level mirror share an id so
        // the join page can resolve a code without first knowing
        // the circle id, and the same id can be used to flip both
        // rows to "accepted" in one go. The id is the UUID code
        // the recipient pastes into the join modal (or opens from
        // the share link).
        for (const member of normalisedInvites) {
          const inviteRef = doc(collection(db, 'circles', circleRef.id, 'invites'));
          const inviteFields = {
            circleId: circleRef.id,
            phone: member.phone,
            invitedByUid: user.uid,
            expiresAt,
            acceptedAt: null,
            status: 'pending',
          };
          tx.set(inviteRef, inviteFields);
          tx.set(doc(db, 'daratInvites', inviteRef.id), inviteFields);
          inviteSummaries.push({
            id: inviteRef.id,
            displayName: member.displayName,
            phone: member.phone,
          });
        }
      });
    } catch (err) {
      console.error('[darat] create failed', err);
      const code = (err as { code?: string } | null)?.code;
      if (code === 'permission-denied') {
        return { ok: false, error: 'forbidden' };
      }
      return { ok: false, error: 'genericError' };
    }
    console.info(
      `[darat] circle created ${circleRef.id} (owner participating: ${input.organizerParticipates}, invitees: ${normalisedInvites.length})`,
    );
    if (!opts?.silent) {
      setCreateOpen(false);
      setPendingDetailId(circleRef.id);
      setView({ kind: 'detail', circleId: circleRef.id });
    }
    return { ok: true, circleId: circleRef.id, invites: inviteSummaries };
  }, [db, user, userCurrency]);

  // The rules-check canary reuses the production create path (silent: no
  // navigation), reads the fresh circle back, and cleans up after itself.
  const runRulesCheck = useCallback(async () => {
    if (!user || !db) return;
    setRulesCheck({ status: 'running' });
    const res = await handleCreate(
      {
        name: 'Diagnostics — safe to delete',
        contribution: 1,
        members: [{ displayName: 'Check', phone: '+212600000000' }],
        organizerParticipates: true,
        startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      },
      { silent: true },
    );
    if (!res.ok || !res.circleId) {
      console.warn('[darat] rules check: probe circle create failed', res.error);
      setRulesCheck({ status: 'createFailed' });
      return;
    }
    const canaryId = res.circleId;
    console.info(`[darat] rules check: probe circle ${canaryId} created, reading back…`);
    try {
      await getDoc(doc(db, 'circles', canaryId));
      console.info('[darat] rules check: probe circle read OK — published rules are CURRENT. The unreadable entries below are data (another account / deleted docs).');
      setRulesCheck({ status: 'ok' });
    } catch (err) {
      const code = (err as { code?: string } | null)?.code;
      console.warn(`[darat] rules check: probe circle read FAILED (${code ?? 'unknown'}) — the published ruleset is older than this build. Re-paste firestore.rules.`);
      setRulesCheck({ status: code === 'permission-denied' ? 'denied' : 'error' });
    } finally {
      // Cleanup: the circle (organizer delete is allowed) and the pointer.
      try { await deleteDoc(doc(db, 'circles', canaryId)); } catch { /* best effort */ }
      try { await deleteDoc(doc(db, 'users', user.uid, 'circles', canaryId)); } catch { /* best effort */ }
    }
  }, [db, user, handleCreate]);

  // Auto-run the check once per page load when there are unreadable
  // circles — the verdict decides the whole remediation path.
  useEffect(() => {
    if (!SHOW_RULES_CHECK) return;
    if (!circlesReady || failedCircleIds.length === 0) return;
    if (rulesCheckRan.current) return;
    rulesCheckRan.current = true;
    void runRulesCheck();
  }, [circlesReady, failedCircleIds.length, runRulesCheck]);

  // Edit a circle's settings from the detail screen. The organizer-only
  // mutation writes the changed fields and rebuilds the rounds. The
  // memberOrder is also rewritten if the rotation was changed to "fixed"
  // or the participation toggle flipped (join/leave the rotation as owner).
  const handleEdit = useCallback(async (input: {
    circleId: string;
    name?: string;
    contribution?: number;
    frequency?: DaratFrequency;
    rotation?: DaratRotation;
    startDate?: string;
    fixedOrder?: string[] | null;
    organizerParticipates?: boolean;
  }): Promise<{ ok: boolean; error?: string }> => {
    if (!user || !db) return { ok: false, error: 'noUser' };
    try {
      const ref = doc(db, 'circles', input.circleId);
      const snap = await getDoc(ref);
      if (!snap.exists()) return { ok: false, error: 'notFound' };
      const current = daratCircleFromSnapshot(snap.id, snap.data() as Record<string, unknown>);
      if (current.organizerId !== user.uid) return { ok: false, error: 'forbidden' };

      const next = {
        name: input.name ?? current.name,
        contribution: input.contribution ?? current.contribution,
        frequency: input.frequency ?? current.frequency,
        rotation: input.rotation ?? current.rotation,
        startDate: input.startDate ?? current.startDate,
        fixedOrder:
          input.rotation === 'fixed'
            ? (input.fixedOrder ?? current.fixedOrder)
            : current.fixedOrder,
        // Random seed stays stable across edits to keep the draw fair.
        randomSeed: current.randomSeed,
      };

      // Rebuild the rounds from the same pure library used at creation.
      const { daratBuildRounds } = await import('@/lib/darat');

      // Participation toggle: flipping it rewrites memberOrder and needs a
      // matching member-row create/delete, so it runs as one transaction.
      const participatesNow = current.memberOrder.includes(user.uid);
      if (input.organizerParticipates !== undefined && input.organizerParticipates !== participatesNow) {
        if (!input.organizerParticipates && current.memberOrder.length - 1 < 2) {
          // Without the organizer the invitees alone must carry the rotation.
          return { ok: false, error: 'membersTooFew' };
        }
        const nextOrder = input.organizerParticipates
          ? [...current.memberOrder, user.uid]
          : current.memberOrder.filter((id) => id !== user.uid);
        const toggleRounds = daratBuildRounds({
          memberOrder: nextOrder,
          contribution: next.contribution,
          frequency: next.frequency,
          rotation: next.rotation,
          startDate: next.startDate,
          randomSeed: next.randomSeed,
          fixedOrder: next.fixedOrder,
        });
        const memberRef = doc(db, 'circles', input.circleId, 'members', user.uid);
        const ledgerCol = collection(db, 'circles', input.circleId, 'ledger');
        const ledgerRef = doc(ledgerCol);
        await runTransaction(db, async (tx) => {
          tx.update(ref, {
            ...next,
            id: current.id,
            memberOrder: nextOrder,
            rounds: toggleRounds,
            updatedAt: Date.now(),
          });
          if (input.organizerParticipates) {
            tx.set(memberRef, {
              uid: user.uid,
              displayName: (user.displayName?.trim()) || user.email || 'Organizer',
              email: (user.email ?? '').toLowerCase(),
              phone: '',
              status: 'active',
              isOrganizer: true,
              joinedAt: new Date().toISOString(),
              sourcePlaceId: 'bank',
            });
          } else {
            tx.delete(memberRef);
          }
          tx.set(ledgerRef, {
            id: ledgerRef.id,
            circleId: input.circleId,
            uid: user.uid,
            kind: 'edited',
            at: Date.now(),
            changed: ['organizerParticipates'],
          });
        });
        return { ok: true };
      }

      const updatedRounds = daratBuildRounds({
        memberOrder: current.memberOrder,
        contribution: next.contribution,
        frequency: next.frequency,
        rotation: next.rotation,
        startDate: next.startDate,
        randomSeed: next.randomSeed,
        fixedOrder: next.fixedOrder,
      });

      await updateDoc(ref, {
        // Repair legacy docs that stored the create-time placeholder
        // `id: ''`: the rules gate organizer updates on
        // validDaratCircleShape(incoming()), and a real string id keeps
        // that shape valid. `current.id` is the doc id (the snapshot id
        // always wins on read), so this is a no-op for healthy docs.
        id: current.id,
        name: next.name,
        contribution: next.contribution,
        currency: current.currency,
        frequency: next.frequency,
        rotation: next.rotation,
        startDate: next.startDate,
        fixedOrder: next.fixedOrder,
        memberOrder: current.memberOrder,
        rounds: updatedRounds,
        updatedAt: Date.now(),
      });

      // Audit trail. The ledger create rule requires the row to carry its
      // own doc id.
      const ledgerCol = collection(db, 'circles', input.circleId, 'ledger');
      const ledgerRef = doc(ledgerCol);
      await setDoc(ledgerRef, {
        id: ledgerRef.id,
        circleId: input.circleId,
        uid: user.uid,
        kind: 'edited',
        at: Date.now(),
        changed: Object.keys(input).filter((k) => k !== 'circleId'),
      });
      return { ok: true };
    } catch (err) {
      console.error('[darat] edit failed', err);
      return { ok: false, error: 'genericError' }
    }
  }, [db, user]);

  // Pro gate — the feature is locked for non-Pro users. Rendered AFTER
  // all hooks so we never violate the rules of hooks.
  if (!isPro) {
    return (
      <div className="flex flex-col gap-5 pb-24">
        <DaratHero
          eyebrow={m.darat.eyebrow}
          title={m.darat.title}
          intro={m.darat.intro}
          intlLocale={intlLocale}
          stats={null}
        />
        <ProLockedCard
          icon="groups"
          title={m.darat.proGate.title}
          body={m.darat.proGate.body}
          onUpgrade={() => router.push('/dashboard/profile/pro')}
        />
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {[m.darat.proGate.perk1, m.darat.proGate.perk2, m.darat.proGate.perk3, m.darat.proGate.perk4].map((perk) => (
            <li key={perk} className="flex items-center gap-3 rounded-2xl border border-outline-variant bg-surface-container-lowest px-4 py-3 text-[13px] font-medium text-on-surface shadow-ambient">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-lime text-forest-deep">
                <AppIcon name="check" strokeWidth={2.6} className="text-[14px]" />
              </span>
              {perk}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (view.kind === 'detail') {
    const circle = circles.find((c) => c.id === view.circleId);
    if (!circle) {
      // A known-failed load beats any spinner: the pointer stream died or
      // the per-circle docs were refused, so "not found" would be a lie —
      // show the failure card with a way back instead.
      const loadKnownFailed = circlesReady && (loadError !== null || docsLoadFailed);
      // A circle created or joined in this session reaches the list through
      // the live snapshot a moment after the write commits — and on the very
      // first load the list itself is still bootstrapping. Neither state is
      // "not found": show a loading card so the destructive alert never
      // flashes while data is simply in flight.
      if (loadKnownFailed) {
        return (
          <div className="flex flex-col gap-3">
            <Alert variant="destructive">
              <AlertTitle>{m.errors.loadFailedTitle}</AlertTitle>
              <AlertDescription>
                {(m.errors as Record<string, string>)[loadError ?? 'networkError'] ?? m.errors.generic}
              </AlertDescription>
            </Alert>
            <button
              type="button"
              onClick={() => {
                setPendingDetailId(null);
                setView({ kind: 'list' });
              }}
              className="self-start rounded-full border border-outline-variant bg-surface-container-lowest px-4 py-2 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-high"
            >
              {m.common.back}
            </button>
          </div>
        );
      }
      if (view.circleId === pendingDetailId || !circlesReady) {
        return (
          <div className="flex flex-col items-center gap-4 py-16">
            <span className="flex size-12 animate-pulse items-center justify-center rounded-full bg-mint text-forest dark:text-lime">
              <AppIcon name="groups" className="text-[22px]" />
            </span>
            <p className="text-[14px] font-medium text-on-surface-variant">{m.common.loading}</p>
            <button
              type="button"
              onClick={() => {
                setPendingDetailId(null);
                setView({ kind: 'list' });
              }}
              className="rounded-full border border-outline-variant bg-surface-container-lowest px-4 py-2 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-high"
            >
              {m.common.back}
            </button>
          </div>
        );
      }
      return (
        <div className="flex flex-col gap-3">
          <Alert variant="destructive">
            <AlertTitle>{m.errors.notFoundTitle}</AlertTitle>
            <AlertDescription>{m.errors.notFoundDescription}</AlertDescription>
          </Alert>
          <button
            type="button"
            onClick={() => setView({ kind: 'list' })}
            className="self-start rounded-full border border-outline-variant bg-surface-container-lowest px-4 py-2 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-high"
          >
            {m.common.back}
          </button>
        </div>
      );
    }
    return (
      <DaratDetailScreen
        circle={circle}
        onBack={() => setView({ kind: 'list' })}
        onEdit={handleEdit}
      />
    );
  }

  const activeCircles = circles.filter((c) => c.status !== 'closed');
  const organizedCount = user ? activeCircles.filter((c) => c.organizerId === user.uid).length : 0;

  return (
    <div className="flex flex-col gap-5 pb-24">
      <DaratHero
        eyebrow={m.darat.eyebrow}
        title={m.darat.title}
        intro={m.darat.intro}
        intlLocale={intlLocale}
        stats={{
          active: formatMessage(m.darat.list.active, { count: activeCircles.length }, intlLocale),
          organizer: `${m.darat.list.asOrganizer} · ${organizedCount}`,
          member: `${m.darat.list.asMember} · ${activeCircles.length - organizedCount}`,
        }}
        actions={
          <>
            <button
              type="button"
              onClick={() => setJoinOpen(true)}
              className="inline-flex h-11 items-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 text-[14px] font-semibold text-white backdrop-blur transition-colors hover:bg-white/20"
            >
              <AppIcon name="group_add" className="text-[18px]" />
              {m.darat.join.title}
            </button>
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="inline-flex h-11 items-center gap-2 rounded-full bg-lime px-4 text-[14px] font-semibold text-forest-deep shadow-[0_10px_24px_-10px_rgba(0,0,0,0.6)] transition-all hover:bg-lime-bright active:scale-[0.98]"
            >
              <AppIcon name="add" strokeWidth={2.4} className="text-[18px]" />
              {m.darat.list.createCta}
            </button>
          </>
        }
      />

      {(loadError || docsLoadFailed) && circlesReady && circles.length === 0 && (
        <Alert variant="destructive">
          <AlertTitle>{m.errors.loadFailedTitle}</AlertTitle>
          <AlertDescription>
            {(m.errors as Record<string, string>)[loadError ?? 'networkError'] ?? m.errors.generic}
          </AlertDescription>
        </Alert>
      )}

      {circles.length === 0 && circlesReady && (
        <div className="flex flex-col items-center gap-3 rounded-[1.75rem] border border-dashed border-outline-variant bg-surface-container-lowest p-8 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-mint text-forest dark:text-lime">
            <AppIcon name="groups" className="text-[26px]" />
          </span>
          <div>
            <p className="text-[15px] font-semibold text-on-surface">{m.darat.list.empty}</p>
            <p className="mt-1 text-[13px] text-on-surface-variant">{m.darat.list.emptyHint}</p>
          </div>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="mt-1 inline-flex h-11 items-center gap-2 rounded-full bg-primary px-5 text-[14px] font-semibold text-on-primary shadow-[0_8px_20px_-8px_rgba(15,59,54,0.45)] transition-all hover:bg-primary-hover active:scale-[0.98]"
          >
            <AppIcon name="add" className="text-[18px]" />
            {m.darat.list.createCta}
          </button>
        </div>
      )}

      {circles.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="px-1 text-[16px] font-semibold tracking-[-0.01em] text-on-surface">{m.darat.list.title}</h2>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {circles.map((circle) => (
              <li key={circle.id}>
                <DaratCircleCard
                  circle={circle}
                  isOrganizer={circle.organizerId === user?.uid}
                  currentUid={user?.uid}
                  onOpen={() => setView({ kind: 'detail', circleId: circle.id })}
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      {failedCircleIds.length > 0 && circlesReady && (
        <section className="flex flex-col gap-2 rounded-[1.75rem] border border-dashed border-error/40 bg-error-container/20 p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-[13px] font-semibold text-on-surface">
              {m.darat.list.unavailableTitle} ({failedCircleIds.length})
            </h2>
            <button
              type="button"
              onClick={() => {
                const confirmText = (m.darat.list.unavailableRemoveAllConfirm as string)
                  .replace('{count}', String(failedCircleIds.length));
                if (!confirm(confirmText)) return;
                for (const id of failedCircleIds) void removeUnavailable(id);
              }}
              className="shrink-0 rounded-full border border-error/40 px-3 py-1 text-[11px] font-semibold text-error transition-colors hover:bg-error-container/40"
            >
              {m.darat.list.unavailableRemoveAll}
            </button>
          </div>
          {SHOW_RULES_CHECK && (rulesCheck.status === 'ok' ? (
            <p className="rounded-xl bg-lime/30 px-3 py-2 text-[12px] font-semibold leading-relaxed text-on-surface">
              {m.darat.list.rulesCheckOk}
            </p>
          ) : rulesCheck.status === 'denied' ? (
            <p className="rounded-xl bg-error-container/40 px-3 py-2 text-[12px] font-semibold leading-relaxed text-on-surface">
              {m.darat.list.rulesCheckDenied}
            </p>
          ) : rulesCheck.status === 'running' ? (
            <p className="text-[12px] font-medium text-on-surface-variant">
              {m.darat.list.rulesCheckRunning}
            </p>
          ) : rulesCheck.status === 'createFailed' ? (
            <p className="text-[12px] font-medium text-on-surface-variant">
              {m.darat.list.rulesCheckCreateFailed}
            </p>
          ) : rulesCheck.status === 'error' ? (
            <p className="text-[12px] font-medium text-on-surface-variant">
              {m.darat.list.rulesCheckError}
            </p>
          ) : (
            <p className="text-[12px] font-medium leading-relaxed text-on-surface-variant">
              {(m.darat.list.unavailableHint as string)
                .replace('{id}', failedCircleIds[0])
                .replace('{uid}', user?.uid ?? '')}
            </p>
          ))}
          {SHOW_RULES_CHECK && (
            <button
              type="button"
              onClick={() => void runRulesCheck()}
              disabled={rulesCheck.status === 'running'}
              className="self-start rounded-full border border-outline-variant bg-surface-container-lowest px-3 py-1.5 text-[11px] font-semibold text-on-surface transition-colors hover:bg-surface-container-high disabled:opacity-50"
            >
              {m.darat.list.rulesCheckRun}
            </button>
          )}
          <ul className="flex flex-col gap-1.5">
            {failedCircleIds.map((id) => (
              <li key={id} className="flex items-center gap-2 text-[12px] font-medium text-on-surface-variant">
                <AppIcon name="error" className="shrink-0 text-[16px] text-error" />
                <span className="truncate font-mono" dir="ltr">{id}</span>
                {projectId && (
                  <a
                    href={`https://console.firebase.google.com/project/${projectId}/firestore/data/circles/${id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex size-7 shrink-0 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface"
                    aria-label={`${m.darat.list.rulesCheckViewInConsole} ${id}`}
                    title={m.darat.list.rulesCheckViewInConsole}
                  >
                    <AppIcon name="arrow_outward" strokeWidth={2} className="text-[14px]" />
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => {
                    if (!confirm(m.darat.list.unavailableRemoveConfirm)) return;
                    void removeUnavailable(id);
                  }}
                  className="ms-auto flex size-7 shrink-0 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-error-container/40 hover:text-error"
                  aria-label={`${m.common.remove} ${id}`}
                  title={m.common.remove}
                >
                  <AppIcon name="close" strokeWidth={2.4} className="text-[14px]" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {createOpen && (
        <DaratCreateModal
          onClose={() => setCreateOpen(false)}
          onSubmit={handleCreate}
        />
      )}

      {joinOpen && (
        <DaratJoinModal
          onClose={() => setJoinOpen(false)}
          onJoined={(circleId) => {
            setJoinOpen(false);
            setPendingDetailId(circleId);
            setView({ kind: 'detail', circleId });
          }}
          initialCode={joinInitialCode}
        />
      )}
    </div>
  );
}
