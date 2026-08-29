'use client';

import { useState } from 'react';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useAuth } from '@/lib/auth-context';

export function AccountPanel() {
  const { user, signOut, deleteAccount } = useAuth();
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
            Sign Out
          </button>
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            className="w-full rounded-2xl py-3.5 text-sm font-medium text-error transition-all hover:bg-error/5"
          >
            Delete Account
          </button>
        </>
      ) : (
        <a
          href="/login"
          className="block w-full rounded-2xl bg-primary py-3.5 text-center text-sm font-bold text-on-primary shadow-sm transition-all hover:bg-primary/90"
        >
          Sign In
        </a>
      )}

      <div className="flex justify-center gap-4 pt-3 text-xs font-medium text-on-surface-variant">
        <a href="/privacy" className="transition-colors hover:text-primary">
          Privacy
        </a>
        <span className="text-outline-variant">·</span>
        <a href="/terms" className="transition-colors hover:text-primary">
          Terms
        </a>
      </div>

      <ConfirmDialog
        isOpen={showSignOutConfirm}
        onClose={() => setShowSignOutConfirm(false)}
        onConfirm={async () => {
          await signOut();
        }}
        title="Sign Out"
        message="Are you sure you want to sign out of your SmartJib account?"
        confirmLabel="Sign Out"
      />

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={async () => {
          await deleteAccount();
        }}
        title="Delete Account Permanently"
        message="This action is irreversible. All your budget data, expenses, and savings goals will be permanently deleted."
        confirmLabel="Delete Account"
        isDestructive
      />
    </section>
  );
}
