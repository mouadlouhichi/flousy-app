'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Modal } from '@/components/ui/Modal';
import {
  AccountDeletionIncompleteError,
  RequiresRecentLoginError,
  useAuth,
} from '@/lib/auth-context';
import { isDemoMode } from '@/lib/demo-mode';
import { useLanguage } from '@/lib/i18n-context';

export function AccountPanel() {
  const { user, signOut, deleteAccount } = useAuth();
  const { messages: m, t } = useLanguage();
  const router = useRouter();
  const p = m.profile;
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [passwordStep, setPasswordStep] = useState(false);
  const [password, setPassword] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  // In the no-Firebase preview, `user` is null but a demo session exists —
  // it still needs a visible sign-out so the real login form is reachable.
  const demoMode = !user && isDemoMode();

  /**
   * Deleting an account is the one action that cannot be undone, so every
   * failure mode has to be visible: `requires-recent-login` opens the password
   * step, and a partial wipe keeps the account alive (the data is still there
   * and reachable) instead of reporting success.
   */
  const attemptDelete = async (passwordValue?: string) => {
    setDeleting(true);
    setDeleteError('');
    try {
      await deleteAccount(passwordValue);
      setPasswordStep(false);
      setShowDeleteConfirm(false);
      router.replace('/');
    } catch (error) {
      if (error instanceof RequiresRecentLoginError) {
        setShowDeleteConfirm(false);
        setPasswordStep(true);
      } else if (error instanceof AccountDeletionIncompleteError) {
        setDeleteError(t(m.auth.deletePartialFailure, { items: error.report.failed.join(', ') }));
      } else {
        setDeleteError(error instanceof Error ? error.message : m.auth.deleteConfirmMessage);
      }
    } finally {
      setDeleting(false);
    }
  };

  return (
    <section className="flex flex-col gap-2 pt-1">
      {user || demoMode ? (
        <>
          <button
            type="button"
            onClick={() => setShowSignOutConfirm(true)}
            className="w-full rounded-2xl border border-outline-variant py-3.5 text-sm font-medium text-on-surface-variant transition-all hover:bg-surface-container hover:text-on-surface"
          >
            {m.auth.signOut}
          </button>
          {user && (
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="w-full rounded-2xl py-3.5 text-sm font-medium text-error transition-all hover:bg-error/5"
            >
              {m.auth.deleteAccount}
            </button>
          )}
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
          router.replace('/login');
        }}
        title={m.auth.signOutConfirmTitle}
        message={m.auth.signOutConfirmMessage}
        confirmLabel={m.auth.signOut}
      />

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => {
          setShowDeleteConfirm(false);
          setDeleteError('');
        }}
        onConfirm={async () => {
          // Erasure needs a recently-authenticated session; on a fresh sign-in
          // this succeeds outright, and otherwise Firebase answers with
          // `requires-recent-login` and we ask for the password.
          await attemptDelete(undefined);
        }}
        title={m.auth.deleteConfirmTitle}
        message={m.auth.deleteConfirmMessage}
        confirmLabel={m.auth.deleteAccount}
        isDestructive
      />

      <Modal
        isOpen={passwordStep}
        onClose={() => {
          setPasswordStep(false);
          setPassword('');
          setDeleteError('');
        }}
        title={m.auth.confirmPasswordTitle}
      >
        <form
          className="flex flex-col gap-3"
          onSubmit={async (event) => {
            event.preventDefault();
            await attemptDelete(password);
          }}
        >
          <p className="text-sm text-on-surface-variant">{m.auth.confirmPasswordHint}</p>
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-on-surface-variant">
              {m.auth.password}
            </span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="rounded-xl border border-outline-variant bg-surface p-3"
            />
          </label>
          {deleteError && (
            <p role="alert" className="text-xs font-bold text-error">
              {deleteError}
            </p>
          )}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                setPasswordStep(false);
                setDeleteError('');
              }}
              className="flex-1 rounded-2xl border border-outline-variant py-3 text-sm font-bold text-on-surface-variant"
            >
              {m.common.cancel}
            </button>
            <button
              type="submit"
              disabled={deleting || password.length === 0}
              className="flex-1 rounded-2xl bg-error py-3 text-sm font-bold text-on-error disabled:opacity-60"
            >
              {deleting ? m.common.loading : m.auth.confirmPasswordAction}
            </button>
          </div>
        </form>
      </Modal>
    </section>
  );
}
