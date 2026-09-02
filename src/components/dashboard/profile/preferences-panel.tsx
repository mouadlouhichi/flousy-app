'use client';

import { useEffect, useState } from 'react';
import { AppIcon } from '@/components/ui/app-icon';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { useAuth } from '@/lib/auth-context';
import { useCurrency } from '@/lib/currency-context';
import { useLanguage } from '@/lib/i18n-context';
import { AnalyticsConsentToggle } from '../analytics-consent-toggle';
import { SUPPORTED_CURRENCIES } from '@/lib/currency';
import { trackEvent } from '@/lib/analytics';
import { MonthlyStartDateControl } from '../monthly-start-date-control';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useHousehold } from '@/lib/household-context';

type Theme = 'light' | 'dark' | 'system';
type SaveState = 'idle' | 'saving' | 'saved' | 'error';

const CURRENCY_OPTIONS = Object.values(SUPPORTED_CURRENCIES).map((currency) => ({
  value: currency.code,
  label: currency.code,
}));



function applyTheme(theme: Theme) {
  const root = document.documentElement;
  const shouldUseDark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  root.classList.toggle('dark', shouldUseDark);
}

export function PreferencesPanel() {
  const { profile, updateProfileData } = useAuth();
  const { configuredCurrency } = useCurrency();
  const { workspace, household, isOwner, updateConfiguration } = useHousehold();
  const { language, messages: m, localeNames, setLanguage, t } = useLanguage();
  const languageOptions = [
    { value: 'en', label: localeNames.en },
    { value: 'fr', label: localeNames.fr },
    { value: 'ar', label: localeNames.ar },
  ];
  const p = m.profile;
  const savedTheme = profile?.theme || 'system';
  const savedMonthStartDate = workspace === 'household' ? household?.monthStartDate : profile?.monthStartDate;
  const canConfigureBudget = workspace === 'personal' || isOwner;

  // Preference changes remain local until the user explicitly saves them.
  // This makes the button meaningful and avoids a partial preference update.
  const [draftCurrency, setDraftCurrency] = useState(configuredCurrency);
  const [draftLanguage, setDraftLanguage] = useState(language);
  const [draftTheme, setDraftTheme] = useState<Theme>(savedTheme);
  const [draftMonthStartDate, setDraftMonthStartDate] = useState<number | undefined>(savedMonthStartDate);
  const [hasStartedEditing, setHasStartedEditing] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirmBudgetBoundaryChange, setConfirmBudgetBoundaryChange] = useState(false);

  // Auth/profile data arrives asynchronously. Hydrate drafts from it until
  // the visitor begins making edits, then never overwrite their in-progress
  // choices with a background profile update.
  useEffect(() => {
    if (hasStartedEditing) return;
    setDraftCurrency(configuredCurrency);
    setDraftLanguage(language);
    setDraftTheme(savedTheme);
    setDraftMonthStartDate(savedMonthStartDate);
  }, [configuredCurrency, hasStartedEditing, language, savedMonthStartDate, savedTheme]);

  const hasChanges =
    draftCurrency !== configuredCurrency ||
    draftLanguage !== language ||
    draftTheme !== savedTheme ||
    draftMonthStartDate !== savedMonthStartDate;

  const beginEditing = () => {
    setHasStartedEditing(true);
    setSaveState('idle');
    setSaveError(null);
  };

  const handleSave = async (budgetBoundaryChangeConfirmed = false) => {
    if (!hasChanges || saveState === 'saving') return;

    const currencyChanged = draftCurrency !== configuredCurrency;
    const languageChanged = draftLanguage !== language;
    const themeChanged = draftTheme !== savedTheme;
    const monthStartDateChanged = draftMonthStartDate !== savedMonthStartDate;
    if ((currencyChanged || monthStartDateChanged) && !budgetBoundaryChangeConfirmed) {
      setConfirmBudgetBoundaryChange(true);
      return;
    }

    setSaveState('saving');
    setSaveError(null);

    try {
      // Language/theme belong to the person. Currency and period start belong
      // to the active budget workspace, so household owners update the shared
      // configuration rather than silently changing only their own profile.
      const profilePatch = {
        ...(languageChanged ? { language: draftLanguage } : {}),
        ...(themeChanged ? { theme: draftTheme } : {}),
        ...(workspace === 'personal' && currencyChanged ? { currency: draftCurrency } : {}),
        ...(workspace === 'personal' && monthStartDateChanged ? { monthStartDate: draftMonthStartDate } : {}),
      };
      if (Object.keys(profilePatch).length > 0) await updateProfileData(profilePatch);
      if (workspace === 'household' && (currencyChanged || monthStartDateChanged)) {
        await updateConfiguration({
          ...(currencyChanged ? { currency: draftCurrency } : {}),
          ...(monthStartDateChanged ? { monthStartDate: draftMonthStartDate } : {}),
        });
      }

      if (themeChanged) {
        applyTheme(draftTheme);
        trackEvent('change_theme', { theme: draftTheme });
      }
      if (currencyChanged) trackEvent('change_currency', { currency: draftCurrency });
      if (languageChanged) {
        // The profile update above persists the choice. Apply it locally as
        // well so both authenticated and demo sessions update immediately,
        // rather than waiting for a profile listener to propagate it.
        setLanguage(draftLanguage, false);
        trackEvent('change_language', { language: draftLanguage });
      }

      setHasStartedEditing(false);
      setSaveState('saved');
    } catch (error) {
      console.error('Error saving preferences:', error);
      setSaveError(p.preferencesSaveError);
      setSaveState('error');
    }
  };

  const confirmationMessages = [
    draftCurrency !== configuredCurrency
      ? t(m.settings.currencyChangeFutureOnly, { current: configuredCurrency, next: draftCurrency })
      : '',
    draftMonthStartDate !== savedMonthStartDate
      ? t(m.settings.periodChangeFutureOnly, { day: draftMonthStartDate || 1 })
      : '',
  ].filter(Boolean);

  return (
    <>
    <div className="divide-y divide-outline-variant/30 rounded-2xl border border-outline-variant bg-surface-container">
      <div className="flex items-center justify-between gap-3 p-4">
        <span className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-variant">
            <AppIcon name="payments" className="text-[20px] text-primary" />
          </span>
          <span className="truncate text-sm font-medium text-on-surface">{m.settings.preferredCurrency}</span>
        </span>
        <CustomSelect
          ariaLabel={m.settings.preferredCurrency}
          value={draftCurrency}
          onChange={(value) => {
            beginEditing();
            setDraftCurrency(value);
          }}
          options={CURRENCY_OPTIONS}
          disabled={!canConfigureBudget}
          className="w-32 shrink-0"
          triggerClassName="!h-11"
        />
      </div>

      <div className="flex items-center justify-between gap-3 p-4">
        <span className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-variant">
            <AppIcon name="language" className="text-[20px] text-primary" />
          </span>
          <span className="truncate text-sm font-medium text-on-surface">{m.settings.language}</span>
        </span>
        <CustomSelect
          ariaLabel={m.settings.language}
          value={draftLanguage}
          onChange={(value) => {
            beginEditing();
            setDraftLanguage(value as typeof language);
          }}
          options={languageOptions}
          className="w-32 shrink-0"
          triggerClassName="!h-11"
        />
      </div>

      <div className="p-4">
        <div className="mb-3 flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-variant">
            <AppIcon name="palette" className="text-[20px] text-primary" />
          </span>
          <span className="text-sm font-medium text-on-surface">{p.theme}</span>
        </div>
        <SegmentedControl
          ariaLabel={p.theme}
          value={draftTheme}
          onChange={(value) => {
            beginEditing();
            const next = value as Theme;
            setDraftTheme(next);
            applyTheme(next);
          }}
          options={[
            { value: 'light', label: m.settings.light, icon: 'light_mode' },
            { value: 'dark', label: m.settings.dark, icon: 'dark_mode' },
            { value: 'system', label: m.settings.system, icon: 'desktop_windows' },
          ]}
        />
      </div>

      {/*
        The consent prompt in the dashboard shell is one-time; this is where the
        decision stays changeable, as the prompt promises. It is deliberately a
        device setting (like the offline cache) rather than a profile field: the
        flag only decides whether this browser may load a third-party script.
      */}
      <div className="p-4">
        <AnalyticsConsentToggle />
      </div>

      <fieldset disabled={!canConfigureBudget} className="p-4 disabled:opacity-60">
        <MonthlyStartDateControl
          compact
          value={draftMonthStartDate}
          onChange={(day) => {
            beginEditing();
            setDraftMonthStartDate(day);
          }}
        />
      </fieldset>

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
          {saveError || (saveState === 'saved' ? p.preferencesSaved : p.preferencesSaveHint)}
        </p>
        <button
          type="button"
          onClick={() => { void handleSave(); }}
          disabled={!hasChanges || saveState === 'saving'}
          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-on-primary shadow-sm transition-all hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <AppIcon name={saveState === 'saved' && !hasChanges ? 'check' : 'save'} className="text-[18px]" />
          {saveState === 'saving' ? p.saving : saveState === 'saved' && !hasChanges ? p.saved : p.saveChanges}
        </button>
      </div>
    </div>
    <ConfirmDialog
      isOpen={confirmBudgetBoundaryChange}
      onClose={() => setConfirmBudgetBoundaryChange(false)}
      onConfirm={() => {
        setConfirmBudgetBoundaryChange(false);
        void handleSave(true);
      }}
      title={draftCurrency !== configuredCurrency
        ? m.settings.currencyChangeTitle
        : m.settings.periodChangeTitle}
      message={confirmationMessages.join(' ')}
      confirmLabel={m.settings.useForFuturePeriods}
    />
    </>
  );
}
