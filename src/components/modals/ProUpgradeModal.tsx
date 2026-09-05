'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { AppIcon } from '@/components/ui/app-icon';
import { Modal } from '../ui/Modal';
import { useAuth } from '../../lib/auth-context';
import {
  PRO_FEATURES,
  claimDemoProTrial,
  isProUser,
  resolveProEntitlement,
} from '../../lib/pro-features';
import { claimProTrial } from '../../lib/db';
import { trackEvent } from '../../lib/analytics';
import { useLanguage } from '@/lib/i18n-context';
import { formatShortDate } from '@/lib/utils';

interface ProUpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Launch entitlement screen.
 *
 * There is intentionally no card form or simulated checkout in this component.
 * The browser can start one rules-validated 90-day launch trial; future CMI or
 * Stripe integrations must use hosted checkout and project signed webhook state
 * into the same entitlement fields through the Admin SDK.
 */
export function ProUpgradeModal({ isOpen, onClose }: ProUpgradeModalProps) {
  const { user, profile, retryProfileSync } = useAuth();
  const { messages: m, t, intlLocale } = useLanguage();
  const p = m.modals.pro;
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [claimState, setClaimState] = useState<'idle' | 'claimed' | 'used'>('idle');
  const [demoRevision, setDemoRevision] = useState(0);

  useEffect(() => {
    if (!isOpen) return;
    setError('');
    setClaimState('idle');
    trackEvent('view_pro_modal', { active: isProUser(profile) });
  }, [isOpen, profile]);

  const accountEntitlement = useMemo(
    () => resolveProEntitlement(profile),
    [profile],
  );
  const demoState = (() => {
    // `setDemoRevision` below intentionally triggers this localStorage re-read.
    // Demo state is device-local and has no subscription source of its own.
    void demoRevision;
    if (profile || typeof window === 'undefined') {
      return { active: false, used: false, endsAtMs: null as number | null };
    }
    try {
      const started = Number(localStorage.getItem('flousy_pro_trial_started_at'));
      const ends = Number(localStorage.getItem('flousy_pro_trial_ends_at'));
      return {
        active: isProUser(null),
        used: Number.isFinite(started) && started > 0,
        endsAtMs: Number.isFinite(ends) && ends > 0 ? ends : null,
      };
    } catch {
      return { active: false, used: false, endsAtMs: null as number | null };
    }
  })();

  const isPro = profile ? accountEntitlement.isPro : demoState.active;
  const hasUsedTrial = profile ? accountEntitlement.hasUsedTrial : demoState.used;
  const endsAtMs = profile ? accountEntitlement.endsAtMs : demoState.endsAtMs;
  const daysRemaining = endsAtMs && endsAtMs > Date.now()
    ? Math.max(1, Math.ceil((endsAtMs - Date.now()) / 86_400_000))
    : 0;
  const formattedEnd = endsAtMs
    ? formatShortDate(new Date(endsAtMs).toISOString().slice(0, 10), intlLocale)
    : '';

  const startTrial = async () => {
    setPending(true);
    setError('');
    try {
      if (user) {
        const result = await claimProTrial(user.uid);
        if (result === 'already_used') {
          setClaimState('used');
          await retryProfileSync();
          return;
        }
        if (result === 'unavailable') throw new Error('trial-unavailable');
        await retryProfileSync();
      } else if (typeof window !== 'undefined') {
        const claimed = claimDemoProTrial(localStorage);
        setClaimState(claimed ? 'claimed' : 'used');
        setDemoRevision((value) => value + 1);
      }
      setClaimState('claimed');
      trackEvent('start_pro_trial', { duration_days: 90 });
    } catch (claimError) {
      console.error('Could not start Pro trial:', claimError);
      setError(m.pro.trialError);
    } finally {
      setPending(false);
    }
  };

  const statusTitle = isPro
    ? m.pro.trialActiveTitle
    : hasUsedTrial || claimState === 'used'
      ? m.pro.trialExpiredTitle
      : m.pro.trialTitle;
  const statusBody = isPro
    ? (formattedEnd
      ? t(m.pro.trialEnds, { date: formattedEnd, days: daysRemaining })
      : p.proActiveDescription)
    : hasUsedTrial || claimState === 'used'
      ? m.pro.trialExpiredBody
      : m.pro.trialBody;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isPro ? p.memberTitle : p.title} className="max-w-2xl">
      <div className="flex flex-col gap-5">
        <div className="rounded-3xl border border-primary/20 bg-primary/5 p-6 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-on-primary">
            <AppIcon name={isPro ? 'verified' : 'workspace_premium'} className="text-[28px]" />
          </span>
          <h3 className="mt-4 text-xl font-extrabold text-on-surface">{statusTitle}</h3>
          {!isPro && <p className="mt-1 text-sm font-bold text-primary">{m.pro.headline}</p>}
          <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-on-surface-variant">{statusBody}</p>
          <p className="mt-2 text-xs font-semibold text-on-surface-variant">{m.pro.noCardRequired}</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {PRO_FEATURES.map((feature) => (
            <div key={feature.id} className="flex gap-3 rounded-2xl border border-outline-variant bg-surface-container p-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <AppIcon name={feature.icon} className="text-[20px]" />
              </span>
              <div>
                <p className="text-sm font-bold text-on-surface">{m.profile.pro.features[feature.id].title}</p>
                <p className="mt-0.5 text-xs leading-5 text-on-surface-variant">
                  {m.profile.pro.features[feature.id].description}
                </p>
              </div>
            </div>
          ))}
        </div>

        {!isPro && !hasUsedTrial && claimState !== 'used' && (
          <button
            type="button"
            onClick={() => { void startTrial(); }}
            disabled={pending}
            className="w-full rounded-2xl bg-primary px-4 py-4 text-base font-bold text-on-primary transition-colors hover:bg-primary/90 disabled:opacity-60"
          >
            {pending ? m.common.loading : m.pro.trialAction}
          </button>
        )}

        {isPro && (
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-2xl bg-primary px-4 py-4 text-base font-bold text-on-primary"
          >
            {p.backToDashboard}
          </button>
        )}

        {!isPro && (hasUsedTrial || claimState === 'used') && (
          <p className="rounded-2xl border border-outline-variant bg-surface-container p-4 text-center text-sm text-on-surface-variant">
            {m.pro.billingNotAvailable}
          </p>
        )}
        {!isPro && <p className="text-center text-xs text-on-surface-variant">{m.pro.plannedPrice}</p>}

        {(error || claimState === 'claimed') && (
          <p role={error ? 'alert' : 'status'} className={`text-center text-sm font-semibold ${error ? 'text-error' : 'text-primary'}`}>
            {error || m.pro.trialClaimed}
          </p>
        )}
      </div>
    </Modal>
  );
}
