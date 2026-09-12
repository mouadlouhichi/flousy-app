'use client';

import { useState } from 'react';
import { collection, getDoc, doc, runTransaction } from 'firebase/firestore';
import { db as firestoreDb } from '@/lib/firebase-db';
import { AppIcon } from '@/components/ui/app-icon';
import { Modal } from '@/components/ui/Modal';
import { useAuth } from '@/lib/auth-context';
import { useLanguage } from '@/lib/i18n-context';
import { normalizeDaratInvite } from '@/lib/darat';

interface Props {
  onClose: () => void;
  onJoined: (circleId: string) => void;
  /**
   * Initial value for the code field. Used by the share-link flow on the
   * Darat landing page: a click on `<origin>/dashboard/darat?join=<id>`
   * opens this modal pre-filled so the recipient just confirms.
   */
  initialCode?: string;
}

const CODE_PLACEHOLDER_FALLBACK = 'ABC123';

/**
 * Join a Darat circle by invite code. Visual style matches the rest
 * of SmartJib's modals: tall input row, uppercase tracking-wider
 * label, error below the field, primary submit that fills the
 * action bar.
 */
export function DaratJoinModal({ onClose, onJoined, initialCode }: Props) {
  const { user } = useAuth();
  const { messages: m } = useLanguage();
  const db = firestoreDb;
  const [code, setCode] = useState(initialCode ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setCodeError(null);
    if (!user || !db) {
      setError('genericError');
      return;
    }
    if (!code.trim()) {
      setCodeError(m.darat.join.notFound);
      return;
    }
    setSubmitting(true);
    try {
      // 1. Look up the top-level invite by code.
      const inviteRef = doc(db, 'daratInvites', code.trim());
      const inviteSnap = await getDoc(inviteRef);
      if (!inviteSnap.exists()) {
        setCodeError(m.darat.join.notFound);
        setSubmitting(false);
        return;
      }
      // Snapshot data first, doc id last — a stored `id` field must never
      // shadow the real document id (same invariant as the circle reads).
      const invite = normalizeDaratInvite({ ...(inviteSnap.data() as Record<string, unknown>), id: inviteSnap.id });
      if (invite.status !== 'pending' || Date.parse(invite.expiresAt) < Date.now()) {
        setCodeError(m.darat.join.notFound);
        setSubmitting(false);
        return;
      }
      // 2-5. Flip the invite to accepted, add the member row, the user
      // pointer, and a ledger row — all in one transaction, exactly like
      // the create flow. Sequential writes burned the invite on a partial
      // failure: an invite already marked 'accepted' can never be reused,
      // so a rejection on any later row left the invitee locked out of
      // the circle with no retry path.
      const memberRef = doc(db, 'circles', invite.circleId, 'members', user.uid);
      const pointerRef = doc(db, 'users', user.uid, 'circles', invite.circleId);
      const circleInviteRef = doc(db, 'circles', invite.circleId, 'invites', invite.id);
      const ledgerRef = doc(collection(db, 'circles', invite.circleId, 'ledger'));
      const acceptedAt = new Date().toISOString();
      await runTransaction(db, async (tx) => {
        // Both invite rows are signed with the accepting account's uid —
        // the member-row create rule gates a self-join on an accepted
        // invite that names the joiner, so the signature is what makes
        // the rest of this batch pass.
        tx.update(inviteRef, {
          status: 'accepted',
          acceptedAt,
          acceptedByUserId: user.uid,
        });
        tx.update(circleInviteRef, {
          status: 'accepted',
          acceptedAt,
          acceptedByUserId: user.uid,
        });
        // 3. Add the user to the circle's member roster. The phone is
        // carried over from the invite so the organizer keeps a
        // useful reference on the roster (the phone they typed at
        // create time), the email is the signed-in user's own
        // account email — not the invitee's — and the inviteId is
        // what the rules check to let a non-organizer write a member
        // row at all.
        tx.set(memberRef, {
          uid: user.uid,
          // The rules require 1-100 chars; a blank account display name
          // falls through to the email instead of a refused row.
          displayName: (user.displayName && user.displayName.trim()) || user.email || 'Member',
          email: (user.email ?? '').toLowerCase(),
          phone: invite.phone ?? '',
          status: 'active',
          isOrganizer: false,
          joinedAt: acceptedAt,
          sourcePlaceId: 'bank',
          inviteId: invite.id,
        });
        // 4. Add the user pointer.
        tx.set(pointerRef, {
          uid: user.uid,
          circleId: invite.circleId,
          joinedAt: acceptedAt,
        });
        // 5. Add a ledger entry. The row carries its own doc id, as the
        // ledger create rule requires (`incoming().id == entryId`).
        tx.set(ledgerRef, {
          id: ledgerRef.id,
          circleId: invite.circleId,
          uid: user.uid,
          kind: 'member_joined',
          at: Date.now(),
        });
      });
      console.info(`[darat] joined circle ${invite.circleId} via invite ${invite.id}`);
      onJoined(invite.circleId);
    } catch (err) {
      console.error('[darat] join failed', err);
      setError('genericError');
    } finally {
      setSubmitting(false);
    }
  };

  const errorKey = error
    ? ((m.darat.join as unknown) as Record<string, string>)[error] ?? m.errors.generic
    : null;

  return (
    <Modal isOpen onClose={onClose} title={m.darat.join.title}>
      <form onSubmit={submit} className="flex min-w-0 flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="darat-join-code"
            className="text-[11px] font-extrabold tracking-wider text-on-surface-variant uppercase"
          >
            {m.darat.join.code}
          </label>
          <div
            className={`flex items-center gap-2 w-full h-12 ps-4 pe-2 bg-surface-container-lowest border rounded-xl transition-all duration-200 hover:border-outline hover:bg-surface-container-low focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 ${
              codeError ? 'border-error focus-within:border-error focus-within:ring-error/20' : 'border-outline-variant'
            }`}
          >
            <AppIcon name="ticket" className="text-[20px] text-on-surface-variant" />
            <input
              id="darat-join-code"
              type="text"
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                if (codeError) setCodeError(null);
              }}
              placeholder={m.darat.join.codePlaceholder ?? CODE_PLACEHOLDER_FALLBACK}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              className="flex-1 min-w-0 bg-transparent border-none p-0 font-body-md text-base md:text-body-md text-on-surface placeholder:text-on-surface-variant/50 focus:ring-0 focus:outline-none"
            />
          </div>
          {codeError ? (
            <p role="alert" className="text-[12px] font-medium text-error mt-1">{codeError}</p>
          ) : (
            <p className="text-[12px] font-medium text-on-surface-variant mt-1">
              {m.darat.join.codeHint ?? m.darat.join.codePlaceholder}
            </p>
          )}
        </div>

        {errorKey && (
          <p role="alert" className="rounded-xl bg-error-container/30 px-3 py-2 text-[13px] font-medium text-error">
            {errorKey}
          </p>
        )}

        <div className="flex gap-3 pt-2 border-t border-surface-variant">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="flex-1 bg-surface-variant/60 text-on-surface font-bold text-[15px] py-3 rounded-xl hover:bg-surface-variant transition-all active:scale-[0.98] disabled:opacity-50"
          >
            {m.common.cancel}
          </button>
          <button
            type="submit"
            disabled={submitting || !code.trim()}
            className="flex-1 bg-primary text-on-primary font-bold text-[15px] py-3 rounded-full hover:bg-primary-hover transition-all active:scale-[0.98] shadow-sm hover:shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <AppIcon name="login" className="text-[18px]" />
            <span>{submitting ? m.darat.join.joining : m.darat.join.join}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
}
