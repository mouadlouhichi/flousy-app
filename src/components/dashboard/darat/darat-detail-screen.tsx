'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  runTransaction,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { useAuth } from '@/lib/auth-context';
import { useLanguage } from '@/lib/i18n-context';
import { formatCurrency } from '@/lib/currency';
import { db as firestoreDb } from '@/lib/firebase-db';
import { AppIcon } from '@/components/ui/app-icon';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { formatMessage } from '@/lib/i18n-core';
import { daratCircleFromSnapshot, daratPhonesMatch, normalizeDaratMember, resolveDaratRoster, type DaratCircle, type DaratMember, type DaratRound, type DaratRotation, type DaratFrequency } from '@/lib/darat';
import { DaratDice } from './darat-dice';
import { DaratEditModal } from './darat-edit-modal';
import { AvatarStack, ProgressRing, avatarTone, circleProgress, formatYmd, monogram } from './darat-ui';

interface Props {
  circle: DaratCircle;
  onBack: () => void;
  onEdit: (input: {
    circleId: string;
    name?: string;
    contribution?: number;
    frequency?: DaratFrequency;
    rotation?: DaratRotation;
    startDate?: string;
    fixedOrder?: string[] | null;
  }) => Promise<{ ok: boolean; error?: string }>;
}

function todayYmd(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Display a user identifier (uid or email) when we have no displayName.
 * A uid is opaque and best shown as a truncated tail; an email is
 * readable as-is. The leading "Name ·" is suppressed entirely when the
 * locale is non-Arabic — the hint in the editor flow is the
 * "Name ·" pattern, but on the read-only detail we just show what we
 * have.
 */
function formatMemberId(uid: string, locale: string): string {
  if (uid.includes('@')) return uid;
  // The trailing uid slice is the user-facing identifier on this surface;
  // we deliberately don't prefix with the localized "Name" word here —
  // that prefix only matters in the editor, not when reading back.
  return `…${uid.slice(-6)}`;
}

export function DaratDetailScreen({ circle: initial, onBack, onEdit }: Props) {
  const { user } = useAuth();
  const { messages: m, intlLocale, language } = useLanguage();
  const db = firestoreDb;

  const [circle, setCircle] = useState<DaratCircle>(initial);
  const [members, setMembers] = useState<Record<string, DaratMember>>({});
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editStatus, setEditStatus] = useState<{ kind: 'saved' | 'error' } | null>(null);
  // Pending invite codes (organizer view). Live from the in-circle invites
  // collection; the join gate reads the mirrored top-level row, but this
  // list is what the organizer shares from.
  const [pendingInvites, setPendingInvites] = useState<{ id: string; phone: string; displayName?: string }[]>([]);

  // Live updates: the shared circle document, plus the member roster.
  useEffect(() => {
    if (!db) return;
    const unsubCircle = onSnapshot(doc(db, 'circles', circle.id), (snap) => {
      if (snap.exists()) {
        // Snapshot data first, doc id last: the stored `id` field (older
        // creates wrote `''`) must never shadow the real document id.
        setCircle(daratCircleFromSnapshot(snap.id, snap.data() as Record<string, unknown>));
      }
    });
    const unsubMembers = onSnapshot(collection(db, 'circles', circle.id, 'members'), (snap) => {
      const next: Record<string, DaratMember> = {};
      snap.forEach((docSnap) => {
        const member = normalizeDaratMember({ uid: docSnap.id, ...(docSnap.data() as Record<string, unknown>) });
        next[docSnap.id] = member;
      });
      setMembers(next);
    });
    const unsubInvites = onSnapshot(collection(db, 'circles', circle.id, 'invites'), (snap) => {
      const pending: { id: string; phone: string; displayName?: string }[] = [];
      snap.forEach((docSnap) => {
        const data = docSnap.data() as { status?: string; phone?: string; displayName?: string };
        if (data.status === 'pending') {
          pending.push({ id: docSnap.id, phone: data.phone ?? '', displayName: data.displayName });
        }
      });
      setPendingInvites(pending);
    }, (err) => {
      console.warn('[darat] invites snapshot failed', err);
    });
    return () => { unsubCircle(); unsubMembers(); unsubInvites(); };
  }, [db, circle.id]);

  const isOrganizer = user?.uid === circle.organizerId;
  const myMember = user ? members[user.uid] : null;
  const today = todayYmd();

  const recordPayment = useCallback(async (roundNumber: number, paid: boolean) => {
    if (!user || !db) return;
    setActionInProgress(`payment-${roundNumber}`);
    setActionError(null);
    try {
      const circleRef = doc(db, 'circles', circle.id);
      const snap = await new Promise<{ rounds: DaratRound[] } | null>((resolve) => {
        const unsub = onSnapshot(circleRef, (s) => {
          unsub();
          if (s.exists()) resolve(s.data() as { rounds: DaratRound[] });
          else resolve(null);
        });
      });
      if (!snap) throw new Error('circle not found');
      const newRounds = snap.rounds.map((r) =>
        r.number === roundNumber
          ? { ...r, payments: { ...r.payments, [user.uid]: paid ? 'paid' as const : 'pending' as const } }
          : r,
      );
      await updateDoc(circleRef, { rounds: newRounds, updatedAt: Date.now() });
      const ledgerCol = collection(db, 'circles', circle.id, 'ledger');
      // The ledger create rule requires the row to carry its own doc id.
      const ledgerRef = doc(ledgerCol);
      await setDoc(ledgerRef, {
        id: ledgerRef.id,
        circleId: circle.id,
        uid: user.uid,
        kind: paid ? 'payment_marked' : 'payment_reverted',
        at: Date.now(),
        roundNumber,
      });
    } catch (err) {
      console.error('[darat] payment toggle failed', err);
      setActionError('paymentFailed');
    } finally {
      setActionInProgress(null);
    }
  }, [db, circle, user]);

  const leaveCircle = useCallback(async () => {
    if (!user || !db) return;
    if (!confirm(m.darat.detail.leaveConfirm)) return;
    setActionInProgress('leave');
    try {
      // Update the member's own row.
      await updateDoc(doc(db, 'circles', circle.id, 'members', user.uid), {
        status: 'left',
      });
      // Remove from the circle's memberOrder.
      const newOrder = circle.memberOrder.filter((id) => id !== user.uid);
      await updateDoc(doc(db, 'circles', circle.id), {
        memberOrder: newOrder,
        updatedAt: Date.now(),
      });
      // Remove the user pointer. The pointer is delete-only
      // (`allow update: if false`), so an updateDoc here was always refused
      // and silently swallowed — the row survived and the dashboard widget
      // kept listing the circle after the leave.
      await deleteDoc(doc(db, 'users', user.uid, 'circles', circle.id)).catch(() => {
        // best effort; the row may not exist if the user was invited but never accepted
      });
      // Append a ledger entry. The row carries its own doc id, as the
      // ledger create rule requires (`incoming().id == entryId`).
      const ledgerCol = collection(db, 'circles', circle.id, 'ledger');
      const ledgerRef = doc(ledgerCol);
      await setDoc(ledgerRef, {
        id: ledgerRef.id,
        circleId: circle.id,
        uid: user.uid,
        kind: 'member_left',
        at: Date.now(),
      });
      onBack();
    } catch (err) {
      console.error('[darat] leave failed', err);
      setActionError('genericError');
    } finally {
      setActionInProgress(null);
    }
  }, [circle.id, circle.memberOrder, db, m.darat.detail.leaveConfirm, onBack, user]);

  const closeCircle = useCallback(async () => {
    if (!user || !db) return;
    if (!confirm(m.darat.detail.closeConfirm)) return;
    setActionInProgress('close');
    try {
      await updateDoc(doc(db, 'circles', circle.id), {
        status: 'closed',
        closedAt: new Date().toISOString(),
        updatedAt: Date.now(),
      });
      const ledgerCol = collection(db, 'circles', circle.id, 'ledger');
      // The ledger create rule requires the row to carry its own doc id.
      const ledgerRef = doc(ledgerCol);
      await setDoc(ledgerRef, {
        id: ledgerRef.id,
        circleId: circle.id,
        uid: user.uid,
        kind: 'closed',
        at: Date.now(),
      });
    } catch (err) {
      console.error('[darat] close failed', err);
      setActionError('genericError');
    } finally {
      setActionInProgress(null);
    }
  }, [circle.id, db, m.darat.detail.closeConfirm, user]);

  const handleEdit = useCallback(async (input: {
    name: string;
    contribution: number;
    frequency: DaratFrequency;
    rotation: DaratRotation;
    startDate: string;
    fixedOrder?: string[] | null;
  }) => {
    setEditStatus(null);
    const res = await onEdit({
      circleId: circle.id,
      name: input.name,
      contribution: input.contribution,
      frequency: input.frequency,
      rotation: input.rotation,
      startDate: input.startDate,
      fixedOrder: input.fixedOrder,
    });
    if (res.ok) {
      setEditOpen(false);
      setEditStatus({ kind: 'saved' });
      // Auto-clear the toast banner after a few seconds.
      setTimeout(() => setEditStatus(null), 4000);
    } else {
      setEditStatus({ kind: 'error' });
    }
    return res;
  }, [circle.id, onEdit]);

  // Create a new invite code any time (organizer): an in-circle row plus
  // the top-level mirror the join flow looks up, sharing an id (the code).
  const createInvite = useCallback(async (displayName: string, phone: string): Promise<string | null> => {
    if (!user || !db) return null;
    try {
      const inviteRef = doc(collection(db, 'circles', circle.id, 'invites'));
      const fields = {
        circleId: circle.id,
        displayName: displayName.trim(),
        phone: phone.trim(),
        invitedByUid: user.uid,
        expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        acceptedAt: null,
        status: 'pending',
      };
      await runTransaction(db, async (tx) => {
        tx.set(inviteRef, fields);
        tx.set(doc(db, 'daratInvites', inviteRef.id), fields);
      });
      console.info(`[darat] invite created ${inviteRef.id} for circle ${circle.id}`);
      return inviteRef.id;
    } catch (err) {
      console.error('[darat] invite creation failed', err);
      return null;
    }
  }, [circle.id, db, user]);


  const errorMessage = actionError
    ? ((m.darat.detail as unknown) as Record<string, string>)[actionError] ?? m.errors.generic
    : null;

  // Display labels for the edit modal's agreed-order list: the live roster
  // name when the member joined, the "Invited · phone" wording for pending
  // placeholders, the uid tail otherwise.
  const memberLabels: Record<string, string> = {};
  for (const id of circle.memberOrder) {
    const row = members[id];
    if (row?.displayName) {
      memberLabels[id] = row.displayName;
    } else if (/\d/.test(id)) {
      memberLabels[id] = formatMessage(m.darat.detail.invitedPhone, { phone: id }, intlLocale);
    } else {
      memberLabels[id] = formatMemberId(id, language);
    }
  }

  return (
    <>
      <DaratDetailView
        circle={circle}
        members={members}
        currentUid={user?.uid}
        isOrganizer={isOrganizer}
        isMember={Boolean(myMember)}
        today={today}
        editStatus={editStatus}
        errorMessage={errorMessage}
        actionInProgress={actionInProgress}
        pendingInvites={pendingInvites}
        onInvite={createInvite}
        onBack={onBack}
        onEdit={() => setEditOpen(true)}
        onTogglePayment={recordPayment}
        onLeave={leaveCircle}
        onClose={closeCircle}
      />
      {editOpen && (
        <DaratEditModal
          circle={circle}
          memberLabels={memberLabels}
          onClose={() => setEditOpen(false)}
          onSubmit={handleEdit}
        />
      )}
    </>
  );
}

export interface DaratDetailViewProps {
  circle: DaratCircle;
  members: Record<string, DaratMember>;
  currentUid?: string;
  isOrganizer: boolean;
  /** Whether the current user has a member row (can mark payments / leave). */
  isMember: boolean;
  today: string;
  editStatus: { kind: 'saved' | 'error' } | null;
  errorMessage: string | null;
  actionInProgress: string | null;
  /** Pending invite codes — the row re-invite reuses one when it exists. */
  pendingInvites: { id: string; phone: string; displayName?: string }[];
  /** Creates an invite (name + phone) and returns the new code, or null. */
  onInvite: (displayName: string, phone: string) => Promise<string | null>;
  onBack: () => void;
  onEdit: () => void;
  onTogglePayment: (roundNumber: number, paid: boolean) => void;
  onLeave: () => void;
  onClose: () => void;
}

/**
 * Pure presentation of a circle: forest summary panel, member roster with
 * avatars, the round timeline and the footer actions. No data fetching, so
 * it can be rendered anywhere (including previews and tests).
 */
export function DaratDetailView({
  circle,
  members,
  currentUid,
  isOrganizer,
  isMember,
  today,
  editStatus,
  errorMessage,
  actionInProgress,
  pendingInvites,
  onInvite,
  onBack,
  onEdit,
  onTogglePayment,
  onLeave,
  onClose,
}: DaratDetailViewProps) {
  const { messages: m, intlLocale, language } = useLanguage();
  const myPayoutIdx = circle.rounds.findIndex((r) => r.recipientId === currentUid);
  const progress = circleProgress(circle, today);
  const closed = circle.status === 'closed';
  const pot = circle.contribution * circle.memberOrder.length;
  const memberName = (uid: string) => members[uid]?.displayName || formatMemberId(uid, language);
  // The roster pairs create-time phone placeholders with accepted member rows
  // so names (not uid/phone tails) are what the circle shows.
  const roster = resolveDaratRoster(circle, members);
  // Round recipients are keyed by memberOrder ids: a uid once the member
  // accepted, their PHONE placeholder before that. Resolve through the
  // roster (which pairs the placeholder with the invited entry) so a round
  // shows "Invited · +212 …" instead of an opaque "…337910" tail, and the
  // member's real name as soon as they join.
  const recipientLabel = (uid: string | null): string => {
    if (!uid) return m.darat.detail.noRecipient;
    const entry = roster.find((e) => e.id === uid);
    if (entry) {
      return entry.joined
        ? (entry.displayName || memberName(uid))
        : formatMessage(m.darat.detail.invitedPhone, { phone: entry.phone }, intlLocale);
    }
    return memberName(uid);
  };
  const frequencyLabel =
    circle.frequency === 'weekly'
      ? m.darat.create.frequencyWeekly
      : circle.frequency === 'biweekly'
        ? m.darat.create.frequencyBiweekly
        : m.darat.create.frequencyMonthly;
  const rotationLabel =
    circle.rotation === 'random' ? m.darat.create.rotationRandom : m.darat.create.rotationFixed;

  // ── Row re-invite state (organizer only) ──
  const [rowInviteBusy, setRowInviteBusy] = useState<string | null>(null);

  const shareLink = (code: string): string =>
    typeof window === 'undefined'
      ? `/dashboard/darat?join=${code}`
      : `${window.location.origin}/dashboard/darat?join=${code}`;

  const whatsappMessage = (code: string, name: string, phone: string): string =>
    (m.darat.create.whatsappInvite as string)
      .replace('{name}', name || phone)
      .replace('{circle}', circle.name)
      .replace('{amount}', formatCurrency(circle.contribution, circle.currency, intlLocale))
      .replace('{date}', formatYmd(circle.startDate, intlLocale, { day: 'numeric', month: 'short' }))
      .replace('{link}', shareLink(code))
      .replace('{code}', code);

  const openWhatsapp = (code: string, name: string, phone: string) => {
    const digits = phone.replace(/\D/g, '');
    const target = digits.length >= 8 ? `https://wa.me/${digits}` : 'https://wa.me/';
    window.open(
      `${target}?text=${encodeURIComponent(whatsappMessage(code, name, phone))}`,
      '_blank',
      'noopener,noreferrer',
    );
  };

  const whatsappInvite = (invite: { id: string; phone: string; displayName?: string }) => {
    openWhatsapp(invite.id, invite.displayName || invite.phone, invite.phone);
  };

  // Re-invite straight from a "still not joined" roster row: reuse the
  // pending invite for that phone when one exists, otherwise mint a fresh
  // code on the spot — then open WhatsApp with the prefilled message.
  const invitePendingMember = async (phone: string, displayName?: string) => {
    const existing = pendingInvites.find((inv) => daratPhonesMatch(inv.phone, phone));
    if (existing) {
      whatsappInvite(existing);
      return;
    }
    setRowInviteBusy(phone);
    try {
      const code = await onInvite(displayName || phone, phone);
      if (!code) return;
      openWhatsapp(code, displayName || phone, phone);
    } finally {
      setRowInviteBusy(null);
    }
  };

  return (
    <div className="flex flex-col gap-5 pb-24">
      {/* ── Header ── */}
      <header className="flex items-start gap-3">
        <button
          type="button"
          onClick={onBack}
          className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full border border-outline-variant bg-surface-container-lowest text-on-surface-variant shadow-ambient transition-colors hover:bg-surface-container-high hover:text-on-surface"
          aria-label={m.common.back}
        >
          <AppIcon name="arrow_back" className="text-[18px] rtl:rotate-180" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[20px] font-semibold tracking-[-0.01em] text-on-surface sm:text-[24px]">{circle.name}</h1>
          <p className="mt-0.5 text-[13px] font-medium text-on-surface-variant">
            {isOrganizer ? m.darat.detail.youAreOrganizer : m.darat.detail.youAreMember}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {closed ? (
            <span className="rounded-full bg-surface-container-high px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-on-surface-variant">
              {m.darat.detail.status.closed}
            </span>
          ) : isOrganizer ? (
            <button
              type="button"
              onClick={onEdit}
              className="inline-flex h-10 items-center gap-2 rounded-full border border-outline-variant bg-surface-container-lowest px-4 text-[13px] font-semibold text-on-surface shadow-ambient transition-colors hover:bg-surface-container-high"
            >
              <AppIcon name="edit" className="text-[16px]" />
              {m.darat.detail.edit}
            </button>
          ) : null}
        </div>
      </header>

      {editStatus && (
        <Alert variant={editStatus.kind === 'saved' ? 'success' : 'destructive'}>
          <AlertDescription>
            {editStatus.kind === 'saved' ? m.darat.edit.saved : m.darat.edit.error}
          </AlertDescription>
        </Alert>
      )}

      {/* ── Forest summary panel (pot, contribution, cadence) ── */}
      <section className="surface-forest relative overflow-hidden rounded-[1.75rem] p-5 shadow-forest sm:p-6">
        <div aria-hidden className="dot-matrix-forest pointer-events-none absolute inset-y-0 end-0 w-2/5 opacity-40 [mask-image:linear-gradient(to_left,black,transparent)]" />
        <div className="relative flex flex-col gap-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2.5">
                <span className="flex size-8 items-center justify-center rounded-full bg-lime text-forest-deep">
                  <AppIcon name="dollar" strokeWidth={2.4} className="text-[15px]" />
                </span>
                <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-white/70">{m.darat.detail.payout}</span>
              </div>
              <p className="mt-3 text-[34px] font-semibold leading-none tabular tracking-[-0.02em] text-white sm:text-[40px]">
                {formatCurrency(pot, circle.currency, intlLocale)}
              </p>
              <p className="mt-2 text-[13px] font-medium text-white/60">
                {m.darat.detail.yourContribution.replace('{amount}', formatCurrency(circle.contribution, circle.currency, intlLocale))}
              </p>
              {!closed && progress.next && (
                <p className="mt-1 text-[12px] font-medium text-white/50">
                  {m.darat.detail.progressHint
                    .replace('{n}', String(progress.next.number))
                    .replace('{date}', formatYmd(progress.next.date, intlLocale, { day: 'numeric', month: 'short' }))}
                </p>
              )}
            </div>
            <div
              className="flex flex-col items-center gap-1 rounded-2xl bg-white/10 px-3 py-2.5 text-center backdrop-blur"
              title={`${progress.done}/${progress.total}`}
            >
              <span className="text-[22px] font-semibold leading-none tabular text-lime">{progress.done}<span className="text-[13px] text-white/60">/{progress.total}</span></span>
              <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-white/60">{m.darat.detail.rounds}</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {isOrganizer && !circle.memberOrder.includes(currentUid ?? '') && (
              <span className="rounded-full bg-lime px-3 py-1 text-[12px] font-semibold text-forest-deep">
                {m.darat.detail.organizerOnly}
              </span>
            )}
            <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[12px] font-semibold text-white/85">{frequencyLabel}</span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[12px] font-semibold text-white/85">
              {circle.rotation === 'random' && <DaratDice size={11} className="shrink-0" />}
              {rotationLabel}
            </span>
            <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[12px] font-semibold text-white/85">
              {formatMessage(m.darat.list.membersCount, { count: circle.memberOrder.length }, intlLocale)}
            </span>
          </div>

          {myPayoutIdx >= 0 && isMember && (
            <p className="flex items-center gap-2 rounded-2xl bg-lime px-3.5 py-2.5 text-[13px] font-semibold text-forest-deep">
              <AppIcon name="celebration" className="shrink-0 text-[16px]" />
              {m.darat.detail.yourPayoutMonth
                .replace('{n}', String(myPayoutIdx + 1))
                .replace('{date}', formatYmd(circle.rounds[myPayoutIdx].date, intlLocale))}
            </p>
          )}
        </div>
      </section>

      {/* ── Members ── */}
      <section className="flex flex-col gap-4 rounded-[1.75rem] border border-outline-variant bg-surface-container-lowest p-5 shadow-ambient">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-full bg-lime text-forest-deep">
              <AppIcon name="user_group" strokeWidth={2.2} className="text-[15px]" />
            </span>
            <h2 className="text-[16px] font-semibold tracking-[-0.01em] text-on-surface">
              {formatMessage(m.darat.list.membersCount, { count: circle.memberOrder.length }, intlLocale)}
            </h2>
          </div>
          <AvatarStack names={roster.map((entry) => (entry.joined ? entry.displayName : entry.phone))} />
        </div>
        <ul className="flex flex-col divide-y divide-outline-variant/60">
          {roster.map((entry, idx) => {
            const isMe = entry.joined && entry.id === currentUid;
            const leftOrRemoved = entry.status === 'left' || entry.status === 'removed';
            return (
              <li key={entry.id} className={`flex items-center gap-3 py-2.5 ${leftOrRemoved ? 'opacity-60' : ''}`}>
                {entry.joined ? (
                  <span className={`flex size-9 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold ${avatarTone(idx)} ${isMe ? 'ring-2 ring-lime-deep ring-offset-2 ring-offset-surface-container-lowest' : ''}`} aria-hidden="true">
                    {monogram(entry.displayName)}
                  </span>
                ) : (
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-dashed border-outline-variant bg-surface-container-low text-on-surface-variant" aria-hidden="true">
                    <AppIcon name="hourglass_top" className="text-[14px]" />
                  </span>
                )}
                <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-on-surface">
                  {entry.joined ? (
                    <>
                      {entry.displayName}
                      {entry.phone && (
                        <span className="ms-1.5 text-[12px] font-medium text-on-surface-variant" dir="ltr">{entry.phone}</span>
                      )}
                      {isMe && <AppIcon name="person" className="ms-1.5 inline text-[14px] text-forest dark:text-lime" title={m.darat.detail.youAreMember} />}
                    </>
                  ) : (
                    <span className="text-on-surface-variant">
                      {formatMessage(m.darat.detail.invitedPhone, { phone: entry.phone }, intlLocale)}
                    </span>
                  )}
                </span>
                {entry.isOrganizer && (
                  <span className="shrink-0 rounded-full bg-lime px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-forest-deep">
                    {m.darat.detail.organizerShort}
                  </span>
                )}
                {entry.status === 'left' && (
                  <span className="shrink-0 rounded-full bg-surface-container-high px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-on-surface-variant">
                    {m.darat.detail.status.left}
                  </span>
                )}
                {entry.status === 'removed' && (
                  <span className="shrink-0 rounded-full bg-surface-container-high px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-on-surface-variant">
                    {m.darat.detail.status.removed}
                  </span>
                )}
                {!entry.joined && (
                  <span className="shrink-0 rounded-full bg-surface-container-high px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-on-surface-variant">
                    {m.darat.detail.status.pending}
                  </span>
                )}
                {!entry.joined && isOrganizer && !closed && (
                  <button
                    type="button"
                    onClick={() => void invitePendingMember(entry.phone, entry.displayName)}
                    disabled={rowInviteBusy === entry.phone}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#25D366] px-3 py-1.5 text-[11px] font-bold text-white transition-all hover:brightness-105 active:scale-[0.97] disabled:opacity-50"
                    title={m.darat.create.whatsappButton}
                  >
                    <AppIcon name="send" className="text-[13px]" />
                    {m.darat.create.whatsappButton}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {/* ── Rounds timeline ── */}
      <section className="flex flex-col gap-4 rounded-[1.75rem] border border-outline-variant bg-surface-container-lowest p-5 shadow-ambient">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-full bg-lime text-forest-deep">
              <AppIcon name="calendar_clock" strokeWidth={2.2} className="text-[15px]" />
            </span>
            <h2 className="text-[16px] font-semibold tracking-[-0.01em] text-on-surface">{m.darat.detail.rounds}</h2>
          </div>
          <ProgressRing pct={progress.pct} label={`${progress.pct}%`} className="size-11" />
        </div>

        <ol className="relative flex flex-col gap-2">
          {circle.rounds.map((round, idx) => {
            const myPayment = round.payments[currentUid ?? ''] ?? 'pending';
            const isPast = round.date < today;
            const isCurrent = !closed && progress.next?.number === round.number;
            const isMine = round.recipientId != null && round.recipientId === currentUid;
            const recipientName = recipientLabel(round.recipientId);
            const canToggle = Boolean(currentUid && isMember && round.payments[currentUid] !== undefined);
            return (
              <li
                key={round.number}
                className={`relative flex gap-3 rounded-2xl p-3 transition-colors ${
                  isCurrent
                    ? 'bg-lime/40 ring-1 ring-lime-deep/40 dark:bg-lime/10 dark:ring-lime/30'
                    : isPast
                      ? 'bg-surface-container-low'
                      : 'bg-surface-container-lowest border border-outline-variant/70'
                }`}
              >
                {/* timeline marker */}
                <div className="flex flex-col items-center">
                  <span
                    className={`flex size-8 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold ${
                      isPast
                        ? 'bg-forest text-lime'
                        : isCurrent
                          ? 'bg-forest text-lime ring-4 ring-lime/60'
                          : 'bg-surface-container-high text-on-surface-variant'
                    }`}
                    aria-hidden="true"
                  >
                    {isPast ? <AppIcon name="check" strokeWidth={2.6} className="text-[14px]" /> : round.number}
                  </span>
                  {idx < circle.rounds.length - 1 && (
                    <span aria-hidden="true" className={`mt-1 w-px flex-1 ${isPast ? 'bg-forest/40' : 'border-s border-dashed border-outline-variant'}`} />
                  )}
                </div>

                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-[13px] font-semibold text-on-surface">
                      {m.darat.detail.roundOn
                        .replace('{n}', String(round.number))
                        .replace('{date}', formatYmd(round.date, intlLocale, { day: 'numeric', month: 'short' }))}
                    </span>
                    <span className="shrink-0 text-[13px] font-semibold tabular text-on-surface">
                      {formatCurrency(round.pot, circle.currency, intlLocale)}
                    </span>
                  </div>
                  <p className={`flex items-center gap-1.5 text-[12px] font-medium ${isMine ? 'text-forest dark:text-lime' : 'text-on-surface-variant'}`}>
                    <AppIcon name={isMine ? 'celebration' : 'person'} className="shrink-0 text-[14px]" />
                    <span className="truncate">
                      {round.recipientId
                        ? m.darat.detail.recipient.replace('{name}', recipientName)
                        : m.darat.detail.noRecipient}
                    </span>
                  </p>
                  {canToggle && (
                    <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                      <span className={`flex items-center gap-1.5 text-[12px] font-semibold ${myPayment === 'paid' ? 'text-forest dark:text-lime' : 'text-on-surface-variant'}`}>
                        <AppIcon name={myPayment === 'paid' ? 'check_circle' : 'radio_button_unchecked'} className="text-[15px]" />
                        {myPayment === 'paid' ? m.darat.detail.status.collected : m.darat.detail.status.pending}
                      </span>
                      {myPayment === 'paid' ? (
                        <button
                          type="button"
                          onClick={() => onTogglePayment(round.number, false)}
                          disabled={actionInProgress === `payment-${round.number}` || closed}
                          className="ms-auto whitespace-nowrap rounded-full border border-outline-variant bg-surface-container-lowest px-3 py-1.5 text-[12px] font-semibold text-on-surface transition-colors hover:bg-surface-container-high disabled:opacity-50"
                        >
                          {m.darat.detail.markUnpaid}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onTogglePayment(round.number, true)}
                          disabled={actionInProgress === `payment-${round.number}` || closed}
                          className="ms-auto whitespace-nowrap rounded-full bg-primary px-3 py-1.5 text-[12px] font-semibold text-on-primary shadow-[0_8px_20px_-8px_rgba(15,59,54,0.45)] transition-all hover:bg-primary-hover active:scale-[0.98] disabled:opacity-50"
                        >
                          {m.darat.detail.markPaid}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      {errorMessage && (
        <Alert variant="destructive">
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}

      {(isMember && !isOrganizer && !closed) || (isOrganizer && !closed) ? (
        <footer className="flex flex-wrap gap-2">
          {isMember && !isOrganizer && !closed && (
            <button
              type="button"
              onClick={onLeave}
              disabled={actionInProgress === 'leave'}
              className="rounded-full border border-error/40 bg-surface-container-lowest px-4 py-2.5 text-[13px] font-semibold text-error transition-colors hover:bg-error-container/20 disabled:opacity-50"
            >
              {m.darat.detail.leave}
            </button>
          )}
          {isOrganizer && !closed && (
            <button
              type="button"
              onClick={onClose}
              disabled={actionInProgress === 'close'}
              className="rounded-full border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-[13px] font-semibold text-on-surface transition-colors hover:bg-surface-container-high disabled:opacity-50"
            >
              {m.darat.detail.close}
            </button>
          )}
        </footer>
      ) : null}

    </div>
  );
}
