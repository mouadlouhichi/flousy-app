'use client';

import { useEffect, useState } from 'react';
import { AppIcon } from '@/components/ui/app-icon';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { useAuth } from '@/lib/auth-context';
import { useCurrency } from '@/lib/currency-context';
import { useLanguage } from '@/lib/i18n-context';
import { SUPPORTED_CURRENCIES } from '@/lib/currency';
import { LANG_STORAGE_KEY, setLanguageCookie } from '@/lib/i18n';
import { trackEvent } from '@/lib/analytics';
import { MonthlyStartDateControl } from '../monthly-start-date-control';

type Theme = 'light' | 'dark' | 'system';
type SaveState = 'idle' | 'saving' | 'saved' | 'error';

const CURRENCY_OPTIONS = Object.values(SUPPORTED_CURRENCIES).map((currency) => ({
  value: currency.code,
  label: currency.code,
}));

const LANGUAGE_OPTIONS = [
  { value: 'en', label: 'English' },
  { value: 'fr', label: 'Français' },
  { value: 'ar', label: 'العربية' },
];

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  const shouldUseDark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  root.classList.toggle('dark', shouldUseDark);
}

export function PreferencesPanel() {
  const { profile, updateProfileData } = useAuth();
  const { currency } = useCurrency();
  const { language } = useLanguage();
  const savedTheme = profile?.theme || 'system';
  const savedMonthStartDate = profile?.monthStartDate;

  // Preference changes remain local until the user explicitly saves them.
  // This makes the button meaningful and avoids a partial preference update.
  const [draftCurrency, setDraftCurrency] = useState(currency);
  const [draftLanguage, setDraftLanguage] = useState(language);
  const [draftTheme, setDraftTheme] = useState<Theme>(savedTheme);
  const [draftMonthStartDate, setDraftMonthStartDate] = useState<number | undefined>(savedMonthStartDate);
  const [hasStartedEditing, setHasStartedEditing] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);

  // Auth/profile data arrives asynchronously. Hydrate drafts from it until
  // the visitor begins making edits, then never overwrite their in-progress
  // choices with a background profile update.
  useEffect(() => {
    if (hasStartedEditing) return;
    setDraftCurrency(currency);
    setDraftLanguage(language);
    setDraftTheme(savedTheme);
    setDraftMonthStartDate(savedMonthStartDate);
  }, [currency, hasStartedEditing, language, savedMonthStartDate, savedTheme]);

  const hasChanges =
    draftCurrency !== currency ||
    draftLanguage !== language ||
    draftTheme !== savedTheme ||
    draftMonthStartDate !== savedMonthStartDate;

  const beginEditing = () => {
    setHasStartedEditing(true);
    setSaveState('idle');
    setSaveError(null);
  };

  const handleSave = async () => {
    if (!hasChanges || saveState === 'saving') return;

    const currencyChanged = draftCurrency !== currency;
    const languageChanged = draftLanguage !== language;
    const themeChanged = draftTheme !== savedTheme;
    const monthStartDateChanged = draftMonthStartDate !== savedMonthStartDate;

    setSaveState('saving');
    setSaveError(null);

    try {
      // One click persists every changed field together. Keeping this patch
      // narrow also prevents an older open tab from overwriting another
      // preference that changed in the background.
      await updateProfileData({
        ...(currencyChanged ? { currency: draftCurrency } : {}),
        ...(languageChanged ? { language: draftLanguage } : {}),
        ...(themeChanged ? { theme: draftTheme } : {}),
        ...(monthStartDateChanged ? { monthStartDate: draftMonthStartDate } : {}),
      });

      if (themeChanged) {
        applyTheme(draftTheme);
        trackEvent('change_theme', { theme: draftTheme });
      }
      if (currencyChanged) trackEvent('change_currency', { currency: draftCurrency });
      if (languageChanged) {
        // Keep the next initial paint in the chosen language as well as
        // persisting it on the authenticated profile.
        setLanguageCookie(draftLanguage);
        try {
          localStorage.setItem(LANG_STORAGE_KEY, draftLanguage);
        } catch {
          // Preference persistence still succeeds when storage is unavailable.
        }
        trackEvent('change_language', { language: draftLanguage });
      }

      setHasStartedEditing(false);
      setSaveState('saved');
    } catch (error) {
      console.error('Error saving preferences:', error);
      setSaveError('Your preferences could not be saved. Please try again.');
      setSaveState('error');
    }
  };

  return (
    <div className="divide-y divide-outline-variant/30 rounded-2xl border border-outline-variant bg-surface-container">
      <div className="flex items-center justify-between gap-3 p-4">
        <span className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-variant">
            <AppIcon name="payments" className="text-[20px] text-primary" />
          </span>
          <span className="truncate text-sm font-medium text-on-surface">Currency</span>
        </span>
        <CustomSelect
          ariaLabel="Currency"
          value={draftCurrency}
          onChange={(value) => {
            beginEditing();
            setDraftCurrency(value);
          }}
          options={CURRENCY_OPTIONS}
          className="w-32 shrink-0"
          triggerClassName="!h-11"
        />
      </div>

      <div className="flex items-center justify-between gap-3 p-4">
        <span className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-variant">
            <AppIcon name="language" className="text-[20px] text-primary" />
          </span>
          <span className="truncate text-sm font-medium text-on-surface">Language</span>
        </span>
        <CustomSelect
          ariaLabel="Language"
          value={draftLanguage}
          onChange={(value) => {
            beginEditing();
            setDraftLanguage(value as typeof language);
          }}
          options={LANGUAGE_OPTIONS}
          className="w-32 shrink-0"
          triggerClassName="!h-11"
        />
      </div>

      <div className="p-4">
        <div className="mb-3 flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-variant">
            <AppIcon name="palette" className="text-[20px] text-primary" />
          </span>
          <span className="text-sm font-medium text-on-surface">Theme</span>
        </div>
        <SegmentedControl
          ariaLabel="Theme"
          value={draftTheme}
          onChange={(value) => {
            beginEditing();
            setDraftTheme(value as Theme);
          }}
          options={[
            { value: 'light', label: 'Light', icon: 'light_mode' },
            { value: 'dark', label: 'Dark', icon: 'dark_mode' },
            { value: 'system', label: 'System', icon: 'desktop_windows' },
          ]}
        />
      </div>

      <div className="p-4">
        <MonthlyStartDateControl
          compact
          value={draftMonthStartDate}
          onChange={(day) => {
            beginEditing();
            setDraftMonthStartDate(day);
          }}
        />
      </div>

      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <p
          role={saveState === 'error' ? 'alert' : 'status'}
          aria-live="polite"
          className={`text-xs font-medium ${
            saveState === 'error'
              ? 'text-error'
              : saveState === 'saved'
                ? 'text-primary'
                : 'text-on-surface-variant'
          }`}
        >
          {saveError || (saveState === 'saved' ? 'Preferences saved.' : 'Save your changes when you are ready.')}
        </p>
        <button
          type="button"
          onClick={handleSave}
          disabled={!hasChanges || saveState === 'saving'}
          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-on-primary shadow-sm transition-all hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <AppIcon name={saveState === 'saved' && !hasChanges ? 'check' : 'save'} className="text-[18px]" />
          {saveState === 'saving' ? 'Saving…' : saveState === 'saved' && !hasChanges ? 'Saved' : 'Save changes'}
        </button>
      </div>
    </div>
  );
}
