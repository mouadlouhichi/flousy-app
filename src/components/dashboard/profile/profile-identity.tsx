'use client';

import { useEffect, useRef, useState } from 'react';
import { AppIcon } from '@/components/ui/app-icon';
import { useAuth } from '@/lib/auth-context';
import { trackEvent } from '@/lib/analytics';
import { createProfileAvatarDataUrl, resolveProfileAvatarSource } from '@/lib/profile-avatar';
import { useDashboard } from '../dashboard-provider';
import { ProfileAvatar } from '../profile-avatar';
import { canShowProUpgrade } from '@/lib/household';
import { useHousehold } from '@/lib/household-context';

export function ProfileIdentity() {
  const { user, profile, updateProfileData } = useAuth();
  const { isPro, openProModal } = useDashboard();
  const { workspace, household, memberRole } = useHousehold();
  const showUpgrade = canShowProUpgrade(isPro, workspace);
  const [isEditingName, setIsEditingName] = useState(false);
  const [displayName, setDisplayName] = useState(profile?.displayName || '');
  const [isSavingAvatar, setIsSavingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isEditingName) setDisplayName(profile?.displayName || '');
  }, [profile?.displayName, isEditingName]);

  const resolvedName =
    profile?.displayName ||
    (user?.email ? user.email.split('@')[0] : '') ||
    'Set your name';
  const userInitial = resolvedName[0]?.toUpperCase() || 'M';
  const avatarSrc = resolveProfileAvatarSource(profile?.avatarUrl, user?.photoURL);
  const workspaceLabel =
    workspace === 'household'
      ? household?.name || 'Household'
      : 'Personal';

  const handleSaveName = async () => {
    if (displayName.trim()) {
      await updateProfileData({ displayName: displayName.trim() });
      trackEvent('update_display_name');
    }
    setIsEditingName(false);
  };

  const handleCancelEdit = () => {
    setIsEditingName(false);
    setDisplayName(profile?.displayName || '');
  };

  const handleAvatarChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Reset the field right away so choosing the same photo again still
    // triggers a change event after an upload error.
    event.target.value = '';
    if (!file) return;

    setAvatarError(null);
    setIsSavingAvatar(true);
    try {
      const avatarUrl = await createProfileAvatarDataUrl(file);
      await updateProfileData({ avatarUrl });
      trackEvent('update_profile_avatar');
    } catch (error) {
      setAvatarError(error instanceof Error ? error.message : 'Unable to save this profile photo.');
    } finally {
      setIsSavingAvatar(false);
    }
  };

  return (
    <section className="overflow-hidden rounded-3xl border border-outline-variant bg-surface-container">
      {/* Cover — gives the card a header instead of dumping identity in one row. */}
      <div className="relative h-24 bg-gradient-to-br from-primary via-primary to-primary/70 sm:h-28">
        <div
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(circle_at_85%_10%,rgba(255,255,255,0.28),transparent_42%)]"
        />
      </div>

      <div className="px-5 pb-5 sm:px-6 sm:pb-6">
        <div className="flex items-end justify-between gap-3">
          <div className="relative -mt-10 shrink-0 sm:-mt-12">
            <ProfileAvatar
              src={avatarSrc}
              initial={userInitial}
              alt={`${resolvedName}'s profile photo`}
              className="h-20 w-20 shadow-md ring-[5px] ring-surface-container sm:h-24 sm:w-24"
              fallbackClassName="bg-gradient-to-br from-primary to-primary/80 text-3xl font-extrabold text-on-primary sm:text-4xl"
            />
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={handleAvatarChange}
              className="hidden"
              aria-label="Choose a profile photo"
            />
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              disabled={isSavingAvatar}
              aria-label="Change profile photo"
              title="Change profile photo"
              className="absolute -bottom-1 -left-1 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-surface text-primary shadow-md ring-[3px] ring-surface-container transition-colors hover:bg-surface-variant disabled:cursor-wait disabled:opacity-70"
            >
              <AppIcon
                name={isSavingAvatar ? 'sync' : 'add_a_photo'}
                className={`text-[15px] ${isSavingAvatar ? 'animate-spin' : ''}`}
              />
            </button>
            {isPro && (
              <span
                title="Pro member"
                className="absolute bottom-0.5 right-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-amber-400 text-amber-950 shadow-sm ring-[3px] ring-surface-container"
              >
                <AppIcon name="workspace_premium" className="text-[14px]" />
              </span>
            )}
          </div>

          {!isEditingName && (
            <button
              type="button"
              onClick={() => {
                setIsEditingName(true);
                setDisplayName(profile?.displayName || '');
              }}
              className="mb-1 inline-flex shrink-0 items-center gap-1.5 rounded-full border border-outline-variant bg-surface px-3.5 py-2 text-xs font-bold text-on-surface transition-colors hover:bg-surface-variant/70"
            >
              <AppIcon name="edit" className="text-[14px]" />
              Edit name
            </button>
          )}
        </div>

        {avatarError && (
          <p role="alert" className="mt-3 text-xs font-semibold text-error">
            {avatarError}
          </p>
        )}

        <div className="mt-4 min-w-0">
          {isEditingName ? (
            <div className="flex flex-col gap-2">
              <label htmlFor="profile-display-name" className="text-[11px] font-extrabold uppercase tracking-wider text-on-surface-variant">
                Display name
              </label>
              <input
                id="profile-display-name"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveName();
                  if (e.key === 'Escape') handleCancelEdit();
                }}
                placeholder="Enter your name"
                autoFocus
                className="w-full rounded-xl border border-outline-variant bg-surface px-3 py-2.5 text-sm font-bold text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleSaveName}
                  className="flex-1 rounded-xl bg-primary py-2.5 text-xs font-bold text-on-primary shadow-sm transition-all hover:bg-primary/90"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="flex-1 rounded-xl border border-outline-variant py-2.5 text-xs font-bold text-on-surface-variant transition-all hover:bg-surface-variant/60"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <h2 className="truncate text-2xl font-extrabold leading-tight tracking-tight text-on-surface">
                {resolvedName}
              </h2>
              {user?.email && (
                <p title={user.email} className="mt-1 truncate text-sm text-on-surface-variant">
                  {user.email}
                </p>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold leading-none ${
                    isPro
                      ? 'bg-amber-400/15 text-amber-700 ring-1 ring-inset ring-amber-400/40 dark:text-amber-300'
                      : 'bg-surface-variant text-on-surface-variant ring-1 ring-inset ring-outline-variant'
                  }`}
                >
                  <AppIcon
                    name={isPro ? 'workspace_premium' : 'person'}
                    className="text-[13px]"
                  />
                  {isPro ? 'Pro' : 'Free'}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-surface-variant px-2.5 py-1 text-[11px] font-bold leading-none text-on-surface-variant ring-1 ring-inset ring-outline-variant">
                  <AppIcon name={workspace === 'household' ? 'group' : 'home'} className="text-[13px]" />
                  {workspaceLabel}
                  {workspace === 'household' && memberRole ? ` · ${memberRole}` : ''}
                </span>
              </div>
            </>
          )}
        </div>

        {showUpgrade && !isEditingName && (
          <button
            type="button"
            onClick={openProModal}
            className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-on-primary shadow-sm transition-all hover:bg-primary/90 sm:w-auto"
          >
            <AppIcon name="workspace_premium" className="text-[16px]" />
            Upgrade to Pro
          </button>
        )}
      </div>
    </section>
  );
}
