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

import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  collection,
  doc,
  getDoc,
  getFirestore,
  limit,
  onSnapshot,
  query,
  runTransaction,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { useAuth } from '@/lib/auth-context';
import { useLanguage } from '@/lib/i18n-context';
import { useCurrency } from '@/lib/currency-context';
import { isProUser } from '@/lib/pro-features';
import { formatCurrency } from '@/lib/currency';
import { buildDaratCreateDefaults, type DaratCreateDefaultsInput } from '@/lib/darat-firestore';
import {
  normalizeDaratCircle,
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

type View =
  | { kind: 'list' }
  | { kind: 'detail'; circleId: string };

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
  const { messages: m, t, intlLocale } = useLanguage();
  const { currency: userCurrency } = useCurrency();
  const reduceMotion = useReducedMotion();
  const db = getFirestore();

  const isPro = isProUser(profile);

  const [circles, setCircles] = useState<DaratCircle[]>([]);
  const [circlesReady, setCirclesReady] = useState(false);
  const [view, setView] = useState<View>({ kind: 'list' });
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [joinInitialCode, setJoinInitialCode] = useState<string | undefined>(undefined);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Merge circles into the local list, newest first, deduped by id. Used
  // by the create/join flows, which seed the circle into the list before
  // switching to the detail view so the view never races the
  // subscriptions ("Circle not found" until the pointer query delivers).
  const upsertCircles = useCallback((incoming: DaratCircle | DaratCircle[]) => {
    const list = Array.isArray(incoming) ? incoming : [incoming];
    setCircles((prev) => {
      const merged = new Map(prev.map((c) => [c.id, c]));
      for (const c of list) merged.set(c.id, c);
      const next = Array.from(merged.values());
      next.sort((a, b) => b.createdAt - a.createdAt);
      return next;
    });
  }, []);

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

  // Opening a circle is a forward navigation: land at the top, exactly
  // like the dashboard shell does on a pathname change.
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
  }, [view]);

  // Subscribe to the user's circles pointer + scan the shared collection for
  // circles the user organized. Each source is independent: a missing
  // composite index on the `organizerId` query must not blow up the page.
  // We catch each source separately and only surface a hard error if both
  // genuinely fail.
  useEffect(() => {
    if (!user) {
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
    const unsubscribers: Array<() => void> = [];

    // Track whether each source has ever emitted. An empty result
    // from either source is a perfectly valid "no circles yet"
    // outcome; the error path is reserved for source.onSnapshot
    // firing its error callback. Distinguishing these is what
    // prevents the spurious "Could not load your circles" alert on
    // a brand-new account that has zero circles.
    const sourceState: {
      pointer: { hasEmitted: boolean; errored: boolean };
      organized: { hasEmitted: boolean; errored: boolean };
    } = {
      pointer: { hasEmitted: false, errored: false },
      organized: { hasEmitted: false, errored: false },
    };

    const recomputeError = () => {
      // The hard-error UI is reserved for the case where:
      //   * both sources have errored (e.g. rules denied both reads), AND
      //   * we have no circles to show.
      // An empty "0 rows" is a successful no-results outcome, not an
      // error. A "permission denied" on one source with a clean
      // success on the other is also not a hard error — the user
      // just sees what they have.
      if (circles.length > 0) {
        setLoadError(null);
        return;
      }
      const bothErrored = sourceState.pointer.errored && sourceState.organized.errored;
      // We only surface the alert when the subscriptions are
      // completely dead (both errored before emitting anything).
      // Once either source has emitted, the empty state is correct
      // even if the other source errors.
      setLoadError(
        bothErrored && !sourceState.pointer.hasEmitted && !sourceState.organized.hasEmitted
          ? 'networkError'
          : null,
      );
    };

    const mergeDoc = (
      docs: { id: string; data?: () => unknown; exists: () => boolean }[],
    ) => {
      const out: DaratCircle[] = [];
      for (const s of docs) {
        if (s.exists()) {
          // The snapshot id is passed AFTER the stored fields on purpose:
          // circles created before the `id` field was filled in store
          // `id: ''`, and a spread after `id: s.id` would resurrect that
          // empty value — every card click then addressed `circles/`
          // (an invalid document reference).
          out.push(
            normalizeDaratCircle({
              ...((s.data?.() as Record<string, unknown>) ?? {}),
              id: s.id,
            }),
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

    const onPointerSuccess = async (snap: { docs: { id: string }[] }) => {
      sourceState.pointer = { hasEmitted: true, errored: false };
      try {
        const docs = await Promise.all(
          snap.docs.map((d) => getDoc(doc(db, 'circles', d.id))),
        );
        if (cancelled) return;
        mergeDoc(docs);
        setCirclesReady(true);
        recomputeError();
      } catch (err) {
        if (cancelled) return;
        console.warn('[darat] pointer docs load failed', err);
        sourceState.pointer = { hasEmitted: sourceState.pointer.hasEmitted, errored: true };
        recomputeError();
      }
    };
    const onPointerError = (err: unknown) => {
      console.warn('[darat] pointer snapshot failed', err);
      sourceState.pointer = { hasEmitted: false, errored: true };
      recomputeError();
      if (!cancelled) setCirclesReady(true);
    };
    const onOrganizedSuccess = async (snap: { docs: { id: string }[] }) => {
      sourceState.organized = { hasEmitted: true, errored: false };
      try {
        const docs = await Promise.all(
          snap.docs.map((d) => getDoc(doc(db, 'circles', d.id))),
        );
        if (cancelled) return;
        mergeDoc(docs);
        setCirclesReady(true);
        recomputeError();
      } catch (err) {
        if (cancelled) return;
        console.warn('[darat] organized docs load failed', err);
        sourceState.organized = { hasEmitted: sourceState.organized.hasEmitted, errored: true };
        recomputeError();
      }
    };
    const onOrganizedError = (err: unknown) => {
      // The most common cause is a missing composite index
      // (deployed elsewhere but not yet here, e.g. a fresh staging
      // environment). We log and continue — the pointer source will
      // still show every circle the user is a member of.
      console.warn('[darat] organized snapshot failed (often a missing index, safe to ignore)', err);
      sourceState.organized = { hasEmitted: false, errored: true };
      recomputeError();
      if (!cancelled) setCirclesReady(true);
    };

    const unsubPointer = onSnapshot(pointerRef, onPointerSuccess, onPointerError);
    unsubscribers.push(unsubPointer);

    const unsubOrganized = onSnapshot(
      query(collection(db, 'circles'), where('organizerId', '==', user.uid), limit(50)),
      onOrganizedSuccess,
      onOrganizedError,
    );
    unsubscribers.push(unsubOrganized);

    return () => {
      cancelled = true;
      for (const u of unsubscribers) u();
    };
    // `circles` is intentionally read inside recomputeError() to keep
    // the rule "any error path that doesn't yield a result is not a
    // hard error" correct, but not listed in deps to avoid
    // resubscribing on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, user, authLoading]);

  // Build a new circle with the minimum required fields. The organizer can
  // then edit frequency / rotation / start date / source place from the
  // detail screen.
  const handleCreate = useCallback(async (input: {
    name: string;
    contribution: number;
    members: { displayName: string; phone: string }[];
  }): Promise<{ ok: boolean; circleId?: string; invites?: InviteSummary[]; error?: string }> => {
    if (!user) return { ok: false, error: 'noUser' };
    // The circle ref is created first so the builder can store the real
    // document id in the `id` field (the rules require it, and the readers
    // trust the snapshot id over the stored one).
    const circleRef = doc(collection(db, 'circles'));
    // Sensible defaults; the user edits them on the next screen.
    const defaultsInput: DaratCreateDefaultsInput = {
      name: input.name,
      contribution: input.contribution,
      members: input.members,
      organizerId: user.uid,
      organizerEmail: user.email ?? '',
      organizerDisplayName: user.displayName ?? user.email ?? 'Organizer',
      currency: userCurrency,
      circleId: circleRef.id,
      // Defaults the user edits on the detail screen.
      frequency: 'monthly',
      rotation: 'random',
      startDate: (() => {
        const d = new Date();
        d.setUTCDate(d.getUTCDate() + 7);
        return d.toISOString().slice(0, 10);
      })(),
      sourcePlaceId: 'bank',
      fixedOrder: null,
      randomSeed: null,
    };
    const defaults = buildDaratCreateDefaults(defaultsInput);
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
        // Organizer's own member row — must exist before the pointer
        // (the pointer's create rule checks `isCircleMember`).
        tx.set(doc(db, 'circles', circleRef.id, 'members', user.uid), {
          uid: user.uid,
          // A display name can be missing (or blank) on a Firebase account;
          // the rules require 1-100 chars, so fall through to the email
          // rather than write a row the ledger gate would refuse.
          displayName: (user.displayName && user.displayName.trim()) || user.email || 'Organizer',
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
        // Per-user pointer so the dashboard widget can list "your
        // circles" without scanning the shared collection.
        tx.set(doc(db, 'users', user.uid, 'circles', circleRef.id), {
          uid: user.uid,
          circleId: circleRef.id,
          joinedAt: new Date(now).toISOString(),
        });
        // Initial ledger entry. The ledger create rule requires the row to
        // carry its own doc id (`incoming().id == entryId`); a row without
        // it aborts the rule and the whole transaction comes back as a bare
        // permission-denied — the exact failure this ref-then-set avoids.
        const ledgerRef = doc(ledgerCol);
        tx.set(ledgerRef, {
          id: ledgerRef.id,
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
            // The name the organizer typed. The roster shows it until the
            // invitee accepts — without it a pending seat renders as an
            // opaque placeholder instead of a person.
            displayName: member.displayName,
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
    // Seed the freshly created circle into the local list so the detail
    // view renders immediately — without this, the view raced the
    // subscriptions and showed "Circle not found" until the organizer
    // query round-tripped. The subscriptions overwrite the seed with
    // server truth under the same id.
    upsertCircles({ ...defaults.circle, createdAt: now, updatedAt: now });
    setCreateOpen(false);
    setView({ kind: 'detail', circleId: circleRef.id });
    return { ok: true, circleId: circleRef.id, invites: inviteSummaries };
  }, [db, user, userCurrency, upsertCircles]);

  // Edit a circle's settings from the detail screen. The organizer-only
  // mutation writes the changed fields and rebuilds the rounds. The
  // memberOrder is also rewritten if the rotation was changed to "fixed".
  const handleEdit = useCallback(async (input: {
    circleId: string;
    name?: string;
    contribution?: number;
    frequency?: DaratFrequency;
    rotation?: DaratRotation;
    startDate?: string;
    fixedOrder?: string[] | null;
  }): Promise<{ ok: boolean; error?: string }> => {
    if (!user) return { ok: false, error: 'noUser' };
    try {
      const ref = doc(db, 'circles', input.circleId);
      const snap = await getDoc(ref);
      if (!snap.exists()) return { ok: false, error: 'notFound' };
      // Snapshot id after the spread: legacy circles store `id: ''` and
      // must not clobber the real id (see mergeDoc).
      const current = normalizeDaratCircle({ ...(snap.data() as Record<string, unknown>), id: snap.id });
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

      // Audit trail. The row carries its own doc id, as the ledger create
      // rule requires (`incoming().id == entryId`).
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

  // The in-page list <-> detail switch gets the same push-transition feel
  // the shell gives routed pages: the outgoing view fades while the incoming
  // one slides up. `mode="wait"` keeps the two from overlapping while their
  // heights differ, and `useReducedMotion` collapses it to an instant swap.
  const viewMotion = {
    initial: reduceMotion ? false : { opacity: 0, y: 10 },
    animate: reduceMotion ? undefined : { opacity: 1, y: 0 },
    exit: reduceMotion ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, y: -6 },
    transition: { duration: 0.2, ease: [0.22, 1, 0.36, 1] as const },
  };

  // Pro gate — the feature is locked for non-Pro users. Rendered AFTER
  // all hooks so we never violate the rules of hooks.
  if (!isPro) {
    return (
      <div className="flex flex-col gap-6">
        <ProLockedCard
          icon="groups"
          title={m.darat.proGate.title}
          body={m.darat.proGate.body}
          onUpgrade={() => router.push('/dashboard/profile/pro')}
        />
        <p className="text-sm text-on-surface-variant">
          {m.darat.list.empty}
        </p>
      </div>
    );
  }

  if (view.kind === 'detail') {
    const circle = circles.find((c) => c.id === view.circleId);
    if (!circle) {
      return (
        <AnimatePresence initial={false} mode="wait">
          <motion.div key="detail-missing" {...viewMotion}>
            <div className="flex flex-col gap-3">
              <Alert variant="destructive">
                <AlertTitle>{m.errors.notFoundTitle}</AlertTitle>
                <AlertDescription>{m.errors.notFoundDescription}</AlertDescription>
              </Alert>
              <button
                type="button"
                onClick={() => setView({ kind: 'list' })}
                className="self-start text-sm font-semibold text-primary underline"
              >
                {m.common.back}
              </button>
            </div>
          </motion.div>
        </AnimatePresence>
      );
    }
    return (
      <AnimatePresence initial={false} mode="wait">
        <motion.div key={`detail-${circle.id}`} {...viewMotion}>
          <DaratDetailScreen
            circle={circle}
            onBack={() => setView({ kind: 'list' })}
            onEdit={handleEdit}
          />
        </motion.div>
      </AnimatePresence>
    );
  }

  return (
    <AnimatePresence initial={false} mode="wait">
      <motion.div key="list" {...viewMotion}>
      <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-primary">
            {m.darat.eyebrow}
          </p>
          <h1 className="mt-1 text-2xl font-extrabold text-on-surface sm:text-3xl">
            {m.darat.title}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-on-surface-variant">
            {m.darat.intro}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setJoinOpen(true)}
            className="inline-flex items-center gap-2 rounded-full border border-outline-variant px-4 py-2 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-variant"
          >
            <AppIcon name="group_add" className="text-[18px]" />
            {m.darat.join.title}
          </button>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-bold text-on-primary transition-colors hover:opacity-90"
          >
            <AppIcon name="add" className="text-[18px]" />
            {m.darat.list.createCta}
          </button>
        </div>
      </header>

      {loadError && circlesReady && circles.length === 0 && (
        <Alert variant="destructive">
          <AlertTitle>{m.errors.loadFailedTitle}</AlertTitle>
          <AlertDescription>
            {(m.errors as Record<string, string>)[loadError] ?? m.errors.generic}
          </AlertDescription>
        </Alert>
      )}

      {circles.length === 0 && circlesReady && (
        <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-outline-variant p-8 text-center">
          <AppIcon name="groups" className="text-5xl text-on-surface-variant" />
          <div>
            <p className="text-sm font-bold text-on-surface">{m.darat.list.empty}</p>
            <p className="mt-1 text-xs text-on-surface-variant">{m.darat.list.emptyHint}</p>
          </div>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="mt-1 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-bold text-on-primary transition-colors hover:opacity-90"
          >
            <AppIcon name="add" className="text-[18px]" />
            {m.darat.list.createCta}
          </button>
        </div>
      )}

      {circles.length > 0 && (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {circles.map((circle) => (
            <li key={circle.id}>
              <button
                type="button"
                onClick={() => setView({ kind: 'detail', circleId: circle.id })}
                className="group flex w-full flex-col gap-2 rounded-2xl border border-outline-variant bg-surface-container p-4 text-left transition hover:border-primary/40 hover:shadow-sm"
              >
                <div className="flex items-center gap-2">
                  <AppIcon name="groups" className="text-2xl text-primary" />
                  <h3 className="text-base font-bold text-on-surface">{circle.name}</h3>
                  {circle.status === 'closed' && (
                    <span className="ml-auto rounded-full bg-surface-variant px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                      {m.darat.detail.status.closed}
                    </span>
                  )}
                </div>
                <p className="text-xs text-on-surface-variant">
                  {m.darat.list.pot.replace('{amount}', formatCurrency(circle.contribution, circle.currency, intlLocale))}
                </p>
                <p className="text-xs text-on-surface-variant">
                  {t(m.darat.list.membersCount, { count: circle.memberOrder.length })}
                  {' · '}
                  {circle.rotation === 'random' && m.darat.create.rotationRandom}
                  {circle.rotation === 'fixed' && m.darat.create.rotationFixed}
                  {circle.rotation === 'bidding' && m.darat.create.rotationBidding}
                </p>
                <p className="mt-1 text-sm font-semibold text-primary group-hover:underline">
                  {m.darat.list.openCircle} →
                </p>
              </button>
            </li>
          ))}
        </ul>
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
          onJoined={async (circleId) => {
            setJoinOpen(false);
            // Seed the joined circle into the local list before switching
            // to the detail view, exactly like the create flow — the
            // pointer subscription has not delivered it yet, and the
            // detail view would show "Circle not found" until it does.
            try {
              const snap = await getDoc(doc(db, 'circles', circleId));
              if (snap.exists()) {
                upsertCircles(
                  normalizeDaratCircle({ ...(snap.data() as Record<string, unknown>), id: snap.id }),
                );
              }
            } catch (err) {
              // The subscriptions will deliver the circle anyway; the
              // detail view only falls back to "Circle not found" if
              // they never do.
              console.warn('[darat] joined circle fetch failed', err);
            }
            setView({ kind: 'detail', circleId });
          }}
          initialCode={joinInitialCode}
        />
      )}
      </div>
      </motion.div>
    </AnimatePresence>
  );
}
