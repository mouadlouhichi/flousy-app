'use client';

import { useEffect, useState } from 'react';
import { AppIcon } from '@/components/ui/app-icon';
import {
  CONSENT_STORAGE_KEY,
  hasAnsweredAnalyticsConsent,
  setAnalyticsConsent,
} from '@/lib/analytics';
import { useLanguage } from '@/lib/i18n-context';

/**
 * The durable form of the analytics choice.
 *
 * `analytics.ts` refuses to load or send anything unless this says "granted", so
 * the row is not cosmetic: it is the only place where a user who declined (or
 * who dismissed the first-run prompt without understanding it) can change their
 * mind without clearing site data.
 */
export function AnalyticsConsentToggle() {
  const { messages: m } = useLanguage();
  const [granted, setGranted] = useState(false);
  const [asked, setAsked] = useState(false);

  useEffect(() => {
    const read = () => {
      setAsked(hasAnsweredAnalyticsConsent());
      try {
        setGranted(localStorage.getItem(CONSENT_STORAGE_KEY) === 'granted');
      } catch {
        setGranted(false);
      }
    };
    read();
    // Keep two mounted views of the setting in step.
    window.addEventListener('storage', read);
    return () => window.removeEventListener('storage', read);
  }, []);

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-variant">
          <AppIcon name="monitoring" className="text-[20px] text-primary" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-on-surface">{m.consent.settingsLabel}</p>
          <p className="mt-0.5 text-xs leading-5 text-on-surface-variant">
            {m.consent.settingsHint}{' '}
            <span className="font-semibold">
              {asked ? (granted ? m.consent.enabled : m.consent.disabled) : m.consent.disabled}
            </span>
          </p>
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={granted}
        aria-label={m.consent.settingsLabel}
        onClick={() => {
          const next = !granted;
          setAnalyticsConsent(next);
          setGranted(next);
          setAsked(true);
        }}
        className={`relative h-7 w-14 shrink-0 rounded-full p-1 transition-colors ${
          granted ? 'bg-primary' : 'bg-surface-variant'
        }`}
      >
        <span
          className={`block h-5 w-5 rounded-full bg-surface shadow transition-transform ${
            granted ? 'translate-x-7 rtl:-translate-x-7' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}
