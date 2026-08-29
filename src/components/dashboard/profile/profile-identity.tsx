'use client';

import { useState } from 'react';
import { AppIcon } from '@/components/ui/app-icon';
import { useAuth } from '@/lib/auth-context';
import { trackEvent } from '@/lib/analytics';
import { useDashboard } from '../dashboard-provider';
import { canShowProUpgrade } from '@/lib/household';
import { useHousehold } from '@/lib/household-context';

export function ProfileIdentity() {
  const { user, profile, updateProfileData } = useAuth();
  const { isPro, openProModal } = useDashboard();
  const { workspace } = useHousehold();
  const showUpgrade = canShowProUpgrade(isPro, workspace);
  const [isEditingName, setIsEditingName] = useState(false);
  const [displayName, setDisplayName] = useState(profile?.displayName || '');
  const userInitial = (profile?.displayName || user?.email)?.[0]?.toUpperCase() || 'M';

  const handleSaveName = async () => {
    if (displayName.trim()) {
      await updateProfileData({ displayName: displayName.trim() });
      trackEvent('update_display_name');
    }
    setIsEditingName(false);
  };

  return (
    <div className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10 p-5 sm:p-6">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-16 h-40 w-40 rounded-full bg-primary/10 blur-3xl"
      />

      <div className="relative flex flex-col items-center gap-4 text-center sm:flex-row sm:items-center sm:text-left">
        <div className="relative shrink-0">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/80 text-2xl font-extrabold text-on-primary shadow-md ring-4 ring-surface">
            {userInitial}
          </div>
          {isPro && (
            <span
              title="Pro member"
              className="absolute -bottom-0.5 -right-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-amber-400 text-amber-950 shadow-sm ring-2 ring-surface"
            >
              <AppIcon name="workspace_premium" className="text-[13px]" />
            </span>
          )}
        </div>

        <div className="w-full min-w-0 flex-1">
          {isEditingName ? (
            <div className="space-y-2">
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveName();
                  if (e.key === 'Escape') {
                    setIsEditingName(false);
                    setDisplayName(profile?.displayName || '');
                  }
                }}
                placeholder="Enter your name"
                autoFocus
                className="w-full rounded-xl border border-outline-variant bg-surface px-3 py-2 text-sm font-bold text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleSaveName}
                  className="flex-1 rounded-xl bg-primary py-2 text-xs font-bold text-on-primary shadow-sm transition-all hover:bg-primary/90"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsEditingName(false);
                    setDisplayName(profile?.displayName || '');
                  }}
                  className="flex-1 rounded-xl border border-outline-variant py-2 text-xs font-bold text-on-surface-variant transition-all hover:bg-surface-variant/60"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex min-w-0 items-center justify-center gap-2 sm:justify-start">
                <p className="min-w-0 truncate text-xl font-extrabold leading-tight text-on-surface">
                  {profile?.displayName || 'Set your name'}
                </p>

                <span
                  className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold leading-none ${
                    isPro
                      ? 'bg-amber-400/15 text-amber-700 ring-1 ring-inset ring-amber-400/40 dark:text-amber-300'
                      : 'bg-primary/10 text-primary ring-1 ring-inset ring-primary/20'
                  }`}
                >
                  <AppIcon
                    name={isPro ? 'workspace_premium' : 'person'}
                    className="text-[13px]"
                  />
                  {isPro ? 'Pro Plan' : 'Free Plan'}
                </span>

                <button
                  type="button"
                  onClick={() => {
                    setIsEditingName(true);
                    setDisplayName(profile?.displayName || '');
                  }}
                  aria-label="Edit name"
                  title="Edit name"
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-primary/10 hover:text-primary"
                >
                  <AppIcon name="edit" className="text-[14px]" />
                </button>
              </div>

              <p
                title={user?.email || undefined}
                className="mt-0.5 truncate text-sm text-on-surface-variant"
              >
                {user?.email}
              </p>

              {showUpgrade && (
                <div className="mt-3 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                  <button
                    type="button"
                    onClick={openProModal}
                    className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-xs font-bold text-on-primary shadow-sm transition-all hover:bg-primary/90"
                  >
                    <AppIcon name="workspace_premium" className="text-[13px]" />
                    Upgrade
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
