'use client';

import { useState } from 'react';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useAuth } from '@/lib/auth-context';
import { useLanguage } from '@/lib/i18n-context';

export function AccountPanel() {
  const { user, signOut, deleteAccount } = useAuth();
  const { messages: m } = useLanguage();
  const p = m.profile;
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  return (
    <section className="flex flex-col gap-2 pt-1">
      {user ? (
        <>
          <button
            type="button"
            onClick={() => setShowSignOutConfirm(true)}
            className="w-full rounded-2xl border border-outline-variant py-3.5 text-sm font-medium text-on-surface-variant transition-all hover:bg-surface-container hover:text-on-surface"
          >
            {m.auth.signOut}
          </button>
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            className="w-full rounded-2xl py-3.5 text-sm font-medium text-error transition-all hover:bg-error/5"
          >
            {m.auth.deleteAccount}
          </button>
        </>
      ) : (
        <a
          href="/login"
          className="block w-full rounded-2xl bg-primary py-3.5 text-center text-sm font-bold text-on-primary shadow-sm transition-all hover:bg-primary/90"
        >
          {m.auth.signIn}
        </a>
      )}

      <div className="flex justify-center gap-4 pt-3 text-xs font-medium text-on-surface-variant">
        <a href="/privacy" className="transition-colors hover:text-primary">
          {p.account.privacy}
        </a>
        <span className="text-outline-variant">·</span>
        <a href="/terms" className="transition-colors hover:text-primary">
          {p.account.terms}
        </a>
      </div>

      <ConfirmDialog
        isOpen={showSignOutConfirm}
        onClose={() => setShowSignOutConfirm(false)}
        onConfirm={async () => {
          await signOut();
        }}
        title={m.auth.signOutConfirmTitle}
        message={m.auth.signOutConfirmMessage}
        confirmLabel={m.auth.signOut}
      />

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={async () => {
          await deleteAccount();
        }}
        title={m.auth.deleteConfirmTitle}
        message={m.auth.deleteConfirmMessage}
        confirmLabel={m.auth.deleteAccount}
        isDestructive
      />
    </section>
  );
}
