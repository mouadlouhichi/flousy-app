'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  collection,
  deleteDoc,
  doc,
  getFirestore,
  onSnapshot,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { useAuth } from '@/lib/auth-context';
import { useLanguage } from '@/lib/i18n-context';
import { formatCurrency } from '@/lib/currency';
import { AppIcon } from '@/components/ui/app-icon';
import { Card } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { normalizeDaratCircle, normalizeDaratMember, type DaratCircle, type DaratMember, type DaratRound, type DaratRotation, type DaratFrequency } from '@/lib/darat';
import { DaratEditModal } from './darat-edit-modal';

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
  const db = getFirestore();

  const [circle, setCircle] = useState<DaratCircle>(initial);
  const [members, setMembers] = useState<Record<string, DaratMember>>({});
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editStatus, setEditStatus] = useState<{ kind: 'saved' | 'error' } | null>(null);

  // Live updates: the shared circle document, plus the member roster.
  useEffect(() => {
    const unsubCircle = onSnapshot(doc(db, 'circles', circle.id), (snap) => {
      if (snap.exists()) {
        setCircle(normalizeDaratCircle({ id: snap.id, ...(snap.data() as Record<string, unknown>) }));
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
    return () => { unsubCircle(); unsubMembers(); };
  }, [db, circle.id]);

  const isOrganizer = user?.uid === circle.organizerId;
  const myMember = user ? members[user.uid] : null;
  const today = todayYmd();
  const currentRoundIdx = circle.rounds.findIndex((r) => r.date >= today);
  const myPayoutIdx = circle.rounds.findIndex((r) => r.recipientId === user?.uid);

  const recordPayment = useCallback(async (roundNumber: number, paid: boolean) => {
    if (!user) return;
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
    if (!user) return;
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
      // (`allow update: if false`), so the updateDoc that used to be here
      // was always refused and silently swallowed — the row survived and
      // the dashboard widget kept listing the circle after the leave.
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
    if (!user) return;
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

  const errorMessage = actionError
    ? ((m.darat.detail as unknown) as Record<string, string>)[actionError] ?? m.errors.generic
    : null;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="mb-2 inline-flex items-center gap-1 text-sm font-semibold text-primary transition-colors hover:underline"
          >
            <AppIcon name="arrow_back" className="text-[16px]" />
            {m.common.back}
          </button>
          <h1 className="text-2xl font-extrabold text-on-surface sm:text-3xl">{circle.name}</h1>
          <p className="mt-1 text-sm text-on-surface-variant">
            {isOrganizer ? m.darat.detail.youAreOrganizer : m.darat.detail.youAreMember}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          {circle.status === 'closed' ? (
            <span className="rounded-full bg-surface-variant px-3 py-1 text-xs font-bold uppercase tracking-wider text-on-surface-variant">
              {m.darat.detail.status.closed}
            </span>
          ) : isOrganizer ? (
            <button
              type="button"
              onClick={() => setEditOpen(true)}
              className="inline-flex items-center gap-2 rounded-full border border-outline-variant px-4 py-2 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-variant"
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

      <Card className="gap-3 p-4">
        <h2 className="text-sm font-bold text-on-surface">
          {m.darat.list.membersCount.replace('{count}', String(circle.memberOrder.length))}
        </h2>
        <ul className="flex flex-col gap-2">
          {circle.memberOrder.map((uid) => {
            const member = members[uid];
            const isMe = uid === user?.uid;
            return (
              <li key={uid} className="flex items-center gap-2 text-sm">
                <AppIcon
                  name={isMe ? 'person' : 'person_outline'}
                  className="text-[18px] text-on-surface-variant"
                />
                <span className="truncate font-semibold text-on-surface">
                  {member?.displayName || formatMemberId(uid, language)}
                </span>
                {member?.isOrganizer && (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                    {m.darat.detail.organizerShort}
                  </span>
                )}
                {member?.status === 'left' && (
                  <span className="rounded-full bg-surface-variant px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                    {m.darat.detail.status.closed}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </Card>

      <section className="flex flex-col gap-3">
        <h2 className="px-1 text-sm font-bold text-on-surface">{m.darat.detail.rounds}</h2>
        <ol className="flex flex-col gap-2">
          {circle.rounds.map((round) => {
            const myPayment = round.payments[user?.uid ?? ''] ?? 'pending';
            const isUpcoming = round.number >= (currentRoundIdx >= 0 ? currentRoundIdx + 1 : circle.rounds.length + 1);
            const recipientName = round.recipientId
              ? (members[round.recipientId]?.displayName || formatMemberId(round.recipientId, language))
              : m.darat.detail.noRecipient;
            return (
              <li
                key={round.number}
                className={`flex flex-col gap-2 rounded-2xl border p-3 ${
                  isUpcoming
                    ? 'border-primary/40 bg-primary/5'
                    : 'border-outline-variant bg-surface-container'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                    {m.darat.detail.roundOn
                      .replace('{n}', String(round.number))
                      .replace('{date}', round.date)}
                  </span>
                  <span className="ml-auto text-sm font-bold text-on-surface">
                    {m.darat.detail.pot.replace(
                      '{amount}',
                      formatCurrency(round.pot, circle.currency, intlLocale),
                    )}
                  </span>
                </div>
                <p className="text-sm text-on-surface">
                  {round.recipientId
                    ? m.darat.detail.recipient.replace('{name}', recipientName)
                    : m.darat.detail.noRecipient}
                </p>
                {user && myMember && round.payments[user.uid] !== undefined && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-on-surface-variant">
                      {m.darat.detail.yourContribution.replace(
                        '{amount}',
                        formatCurrency(circle.contribution, circle.currency, intlLocale),
                      )}
                    </span>
                    {myPayment === 'paid' ? (
                      <button
                        type="button"
                        onClick={() => recordPayment(round.number, false)}
                        disabled={actionInProgress === `payment-${round.number}` || circle.status === 'closed'}
                        className="ml-auto rounded-full border border-outline-variant px-3 py-1 text-xs font-bold text-on-surface transition-colors hover:bg-surface-variant disabled:opacity-50"
                      >
                        {m.darat.detail.markUnpaid}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => recordPayment(round.number, true)}
                        disabled={actionInProgress === `payment-${round.number}` || circle.status === 'closed'}
                        className="ml-auto rounded-full bg-primary px-3 py-1 text-xs font-bold text-on-primary transition-colors hover:opacity-90 disabled:opacity-50"
                      >
                        {m.darat.detail.markPaid}
                      </button>
                    )}
                  </div>
                )}
                {round.discount > 0 && (
                  <p className="text-xs text-on-surface-variant">
                    {m.darat.detail.winningBid
                      .replace('{name}', recipientName)
                      .replace('{amount}', formatCurrency(round.discount, circle.currency, intlLocale))}
                  </p>
                )}
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

      <footer className="flex flex-col gap-3">
        {myPayoutIdx >= 0 && myMember && (
          <p className="text-sm font-semibold text-primary">
            {m.darat.detail.yourPayoutMonth
              .replace('{n}', String(myPayoutIdx + 1))
              .replace('{date}', circle.rounds[myPayoutIdx].date)}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          {myMember && !isOrganizer && circle.status !== 'closed' && (
            <button
              type="button"
              onClick={leaveCircle}
              disabled={actionInProgress === 'leave'}
              className="rounded-full border border-error/40 px-4 py-2 text-sm font-semibold text-error transition-colors hover:bg-error-container/10 disabled:opacity-50"
            >
              {m.darat.detail.leave}
            </button>
          )}
          {isOrganizer && circle.status !== 'closed' && (
            <button
              type="button"
              onClick={closeCircle}
              disabled={actionInProgress === 'close'}
              className="rounded-full border border-outline-variant px-4 py-2 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-variant disabled:opacity-50"
            >
              {m.darat.detail.close}
            </button>
          )}
        </div>
      </footer>

      {editOpen && (
        <DaratEditModal
          circle={circle}
          onClose={() => setEditOpen(false)}
          onSubmit={handleEdit}
        />
      )}
    </div>
  );
}
