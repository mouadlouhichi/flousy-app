'use client';

import { AppIcon } from '@/components/ui/app-icon';

import React, { Suspense, useEffect, useState } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../../lib/auth-context';
import { useHousehold } from '../../lib/household-context';
import { useCurrency } from '../../lib/currency-context';
import { SUPPORTED_CURRENCIES } from '../../lib/currency';
import {
  STRATEGIES,
  StrategyId,
  CustomRatios,
  DEFAULT_CUSTOM_RATIOS,
  calculateEnvelopeAmounts,
  createNewMonth,
  normalizeCustomRatios,
  resolveStrategy,
} from '../../lib/store';
import { saveMonthBudget, saveHouseholdMonthBudget, importPersonalBudgetIntoHousehold } from '../../lib/db';
import { getCurrentMonthKey } from '../../lib/utils';
import { isDemoMode, isOnboardingDoneLocally, markOnboardingDoneLocally } from '../../lib/demo-mode';
import { parseAmountInput } from '../../lib/parse-amount';
import { CustomSelect } from '../../components/ui/CustomSelect';
import { MonthDayPicker } from '../../components/ui/month-day-picker';
import { useLanguage } from '@/lib/i18n-context';
import { formatLocalizedPercent, getLocalizedPercentSign } from '@/lib/i18n';
import {
  formatLocalizedDayOfMonth,
  localizeBillCategory,
  localizeCategoryName,
  localizeDefaultBillName,
  localizeStrategy,
} from '@/lib/localized-labels';

interface CategoryItem {
  name: string;
  color: string;
  icon: string;
}

const DEFAULT_CATEGORY_ITEMS: CategoryItem[] = [
  { name: 'Food', color: '#f97316', icon: 'restaurant' },
  { name: 'Transport', color: '#3b82f6', icon: 'directions_car' },
  { name: 'Rent', color: '#8b5cf6', icon: 'home' },
  { name: 'Entertainment', color: '#ec4899', icon: 'sports_esports' },
  { name: 'Health', color: '#14b8a6', icon: 'favorite' },
  { name: 'Utilities', color: '#f59e0b', icon: 'bolt' },
  { name: 'Shopping', color: '#6366f1', icon: 'shopping_bag' },
  { name: 'Subscriptions', color: '#ef4444', icon: 'subscriptions' },
];

export default function OnboardingPage() {
  return (
    <Suspense fallback={null}>
      <OnboardingFlow />
    </Suspense>
  );
}

function OnboardingFlow() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { messages: m, t, translate, language, intlLocale, isRTL } = useLanguage();
  const { user, profile, loading: authLoading, updateProfileData } = useAuth();
  const {
    workspace,
    household,
    loading: householdLoading,
    isOwner,
    markHouseholdOnboarded,
  } = useHousehold();
  const isHouseholdScope = searchParams.get('scope') === 'household' || workspace === 'household';
  const householdId = household?.id || profile?.activeHouseholdId;
  const { currency, setCurrency, symbol, format } = useCurrency();

  // Onboarding is a one-time bootstrap, not an account-settings screen. Direct
  // navigation or browser back must never let an established user replace an
  // existing month. Cloud state is authoritative; local flags cover demo mode
  // and a prior completion whose profile update is still retrying.
  useEffect(() => {
    if (authLoading) return;
    if (isHouseholdScope) {
      if (householdLoading || !householdId || !household) return;
      const localDone = typeof window !== 'undefined'
        && localStorage.getItem(`flousy_household_${householdId}_onboarding_done`) === 'true';
      if (!isOwner || household.onboardingComplete !== false || localDone) {
        router.replace('/dashboard');
      }
      return;
    }

    if (profile && profile.onboardingComplete !== false) {
      router.replace('/dashboard');
      return;
    }
    if (!user && isDemoMode() && isOnboardingDoneLocally()) {
      router.replace('/dashboard');
    }
  }, [authLoading, household, householdId, householdLoading, isHouseholdScope, isOwner, profile, router, user]);

  const localizedDay = (day: number) => formatLocalizedDayOfMonth(day, language, intlLocale);
  const formatPercent = (value: number) => formatLocalizedPercent(value, intlLocale);
  const percentSign = getLocalizedPercentSign(intlLocale);

  const [step, setStep] = useState<number>(1);
  const [income, setIncome] = useState<string>('');
  // Optional: the day of the month the salary arrives (start of the budget month).
  // Onboarding in household scope sets the HOUSEHOLD start date; the personal
  // flow sets the personal one. They are separate budget periods.
  const [monthStartDate, setMonthStartDate] = useState<number | undefined>(
    isHouseholdScope
      ? (profile?.householdMonthStartDate ?? profile?.monthStartDate)
      : profile?.monthStartDate,
  );
  const [selectedStrategy, setSelectedStrategy] = useState<StrategyId>('50-30-20');
  // Custom strategy split, kept in whole percents while editing.
  const [customSplit, setCustomSplit] = useState({
    needs: Math.round(DEFAULT_CUSTOM_RATIOS.needs * 100),
    wants: Math.round(DEFAULT_CUSTOM_RATIOS.wants * 100),
    savings: Math.round(DEFAULT_CUSTOM_RATIOS.savings * 100),
  });

  const [allCategories, setAllCategories] = useState<CategoryItem[]>(DEFAULT_CATEGORY_ITEMS);
  const [selectedCategoryNames, setSelectedCategoryNames] = useState<string[]>([
    'Food',
    'Transport',
    'Rent',
    'Entertainment',
    'Health',
    'Utilities',
  ]);

  const [showAddCustom, setShowAddCustom] = useState<boolean>(false);
  const [customCatName, setCustomCatName] = useState<string>('');
  const [customCatIcon, setCustomCatIcon] = useState<string>('category');

  const CUSTOM_ICONS = [
    'category', 'fitness_center', 'pets', 'flight',
    'school', 'work', 'build', 'card_giftcard',
    'local_cafe', 'medical_services', 'child_care', 'palette',
    'music_note', 'sports_tennis', 'restaurant', 'shopping_bag',
  ];

  const RANDOM_COLORS = [
    '#f97316', '#3b82f6', '#8b5cf6', '#ec4899',
    '#14b8a6', '#f59e0b', '#6366f1', '#ef4444',
    '#06b6d4', '#10b981', '#eab308', '#84cc16',
    '#d946ef', '#a855f7', '#f43f5e', '#00685f',
  ];

  const [bills, setBills] = useState<{ name: string; amount: number; category: string }[]>([]);

  const [newBillName, setNewBillName] = useState('');
  const [newBillAmount, setNewBillAmount] = useState('');
  const [newBillCategory, setNewBillCategory] = useState('Housing');

  const [isCompleting, setIsCompleting] = useState(false);
  const [incomeError, setIncomeError] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState('');

  // Clean numeric string parsing for income (handles comma/formatting)
  // Locale-aware parsing: accepts French decimal commas, grouping spaces and
  // Arabic-Indic digits (audit P1 — ASCII-only stripping mangled fr/ar input).
  const rawParsedIncome = parseAmountInput(income);
  const parsedIncome = Number.isFinite(rawParsedIncome) ? rawParsedIncome : 0;
  const customRatios: CustomRatios = normalizeCustomRatios({
    needs: customSplit.needs / 100,
    wants: customSplit.wants / 100,
    savings: customSplit.savings / 100,
  });
  const customSplitTotal = customSplit.needs + customSplit.wants + customSplit.savings;
  const isCustomSplitValid = customSplitTotal === 100;
  const activeStrategy = resolveStrategy(selectedStrategy, customRatios);
  const activeStrategyCopy = localizeStrategy(activeStrategy.id, m, intlLocale);
  const envelopes = calculateEnvelopeAmounts(
    parsedIncome,
    selectedStrategy,
    selectedStrategy === 'custom' ? customRatios : undefined,
  );

  /** Move one envelope and rebalance the other two so the split stays at 100%. */
  const handleCustomSplitChange = (key: 'needs' | 'wants' | 'savings', rawValue: number) => {
    const value = Math.min(100, Math.max(0, Math.round(rawValue)));
    const others = (['needs', 'wants', 'savings'] as const).filter((k) => k !== key);
    const remaining = 100 - value;
    const othersTotal = others.reduce((acc, k) => acc + customSplit[k], 0);
    const first =
      othersTotal <= 0
        ? Math.round(remaining / 2)
        : Math.round((customSplit[others[0]] / othersTotal) * remaining);

    setCustomSplit({
      ...customSplit,
      [key]: value,
      [others[0]]: first,
      [others[1]]: remaining - first,
    });
  };
  const totalBills = bills.reduce((acc, b) => acc + b.amount, 0);

  const handleStep1Continue = () => {
    setIncomeError('');
    if (parsedIncome <= 0) {
      setIncomeError(m.onboarding.incomeError);
      return;
    }
    setStep(2);
  };

  const handleAddBill = () => {
    if (!newBillName.trim() || !newBillAmount) return;
    const amt = parseAmountInput(newBillAmount);
    if (!Number.isFinite(amt) || amt <= 0) return;

    setBills([...bills, { name: newBillName.trim(), amount: amt, category: newBillCategory }]);
    setNewBillName('');
    setNewBillAmount('');
  };

  const handleRemoveBill = (idx: number) => {
    setBills(bills.filter((_, i) => i !== idx));
  };

  const handleStep3Continue = () => {
    // If user entered a bill but didn't click "Add Bill", auto-add it
    if (newBillName.trim() && newBillAmount) {
      const amt = parseAmountInput(newBillAmount);
      if (Number.isFinite(amt) && amt > 0) {
        setBills((prev) => [
          ...prev,
          { name: newBillName.trim(), amount: amt, category: newBillCategory },
        ]);
        setNewBillName('');
        setNewBillAmount('');
      }
    }
    setStep(4);
  };

  const toggleCategory = (catName: string) => {
    if (selectedCategoryNames.includes(catName)) {
      if (selectedCategoryNames.length > 1) {
        setSelectedCategoryNames(selectedCategoryNames.filter((c) => c !== catName));
      }
    } else {
      setSelectedCategoryNames([...selectedCategoryNames, catName]);
    }
  };

  const handleAddCustomCategory = () => {
    if (!customCatName.trim()) return;
    const trimmed = customCatName.trim();
    if (!allCategories.some((c) => c.name.toLowerCase() === trimmed.toLowerCase())) {
      const usedColors = new Set(allCategories.map((c) => c.color));
      const available = RANDOM_COLORS.filter((c) => !usedColors.has(c));
      const pool = available.length > 0 ? available : RANDOM_COLORS;
      const randomColor = pool[Math.floor(Math.random() * pool.length)];
      const newItem: CategoryItem = { name: trimmed, color: randomColor, icon: customCatIcon };
      setAllCategories([...allCategories, newItem]);
      setSelectedCategoryNames([...selectedCategoryNames, trimmed]);
    }
    setCustomCatName('');
    setCustomCatIcon('category');
    setShowAddCustom(false);
  };

  const goDashboard = () => {
    router.push('/dashboard');
  };

  const onboardingWriteIsBlocked = () => {
    if (isHouseholdScope) {
      const localDone = Boolean(
        householdId
        && typeof window !== 'undefined'
        && localStorage.getItem(`flousy_household_${householdId}_onboarding_done`) === 'true'
      );
      return !householdId || (Boolean(household) && !isOwner)
        || household?.onboardingComplete !== false
        || localDone;
    }
    if (profile) return profile.onboardingComplete !== false || isOnboardingDoneLocally(undefined, user?.uid);
    // An authenticated account without a loaded profile is not safe to bootstrap:
    // wait for profile recovery instead of guessing that its data is empty.
    if (user) return true;
    return isOnboardingDoneLocally();
  };

  const handleImportPersonal = async () => {
    if (isImporting || isCompleting || !isHouseholdScope) return;
    if (onboardingWriteIsBlocked()) {
      router.replace('/dashboard');
      return;
    }
    setIsImporting(true);
    setImportError('');
    const today = new Date();
    const monthKey = getCurrentMonthKey(monthStartDate, today);
    try {
      if (householdId) {
        localStorage.setItem(`flousy_household_${householdId}_onboarding_done`, 'true');
        for (let i = 0; i < localStorage.length; i += 1) {
          const storageKey = localStorage.key(i);
          if (!storageKey?.startsWith('flousy_month_')) continue;
          const mk = storageKey.slice('flousy_month_'.length);
          const raw = localStorage.getItem(storageKey);
          const targetKey = `flousy_household_${householdId}_month_${mk}`;
          if (raw && localStorage.getItem(targetKey) === null) {
            localStorage.setItem(targetKey, raw);
          }
        }
      }
    } catch { /* ignore */ }

    if (user && householdId) {
      try {
        await Promise.race([
          (async () => {
            await importPersonalBudgetIntoHousehold(user.uid, householdId);
            try {
              const local = localStorage.getItem(`flousy_month_${monthKey}`);
              if (local) {
                await saveHouseholdMonthBudget(householdId, monthKey, JSON.parse(local));
              }
            } catch (err) {
              console.error('[import] current month copy failed', { monthKey, householdId }, err);
            }
            await markHouseholdOnboarded();
          })(),
          // 30s, not 6s. The import is one write per personal month plus the
          // savings goals, each a separate transaction; on a cold connection
          // six seconds routinely elapsed before the first one landed, and the
          // timeout then looked exactly like a refusal.
          new Promise((_, reject) => setTimeout(() => reject(new Error('Firebase timeout')), 30000)),
        ]);
      } catch (e) {
        // This used to be a console.warn that then marked onboarding complete
        // regardless, so a refused or timed-out import sent the user to an
        // empty dashboard with no error anywhere and the workspace flagged as
        // successfully set up. Surface it, and do NOT claim success.
        const code = (e as { code?: string })?.code;
        console.error('[import] personal -> household import failed', {
          householdId,
          uid: user.uid,
          monthKey,
          code: code ?? null,
          cause: (e as { cause?: unknown })?.cause ?? null,
        }, e);
        setImportError(
          code === 'permission-denied'
            ? m.household.genericError
            : (e as Error)?.message || m.household.genericError,
        );
        setIsImporting(false);
        return;
      }
    }
    goDashboard();
  };

  const handleCompleteOnboarding = async () => {
    if (isCompleting) return;
    if (onboardingWriteIsBlocked()) {
      router.replace('/dashboard');
      return;
    }
    setIsCompleting(true);

    const today = new Date();
    // File the first month under the budget period containing today so the
    // dashboard looks for the same key when a monthly start date is set.
    const monthKey = getCurrentMonthKey(monthStartDate, today);
    const newMonth = createNewMonth(
      parsedIncome,
      selectedStrategy,
      selectedCategoryNames,
      bills,
      monthKey,
      selectedStrategy === 'custom' ? customRatios : undefined,
    );

    try {
      if (isHouseholdScope && householdId) {
        localStorage.setItem(`flousy_household_${householdId}_onboarding_done`, 'true');
      } else {
        const monthStorageKey = `flousy_month_${monthKey}`;
        if (localStorage.getItem(monthStorageKey) === null) {
          localStorage.setItem(monthStorageKey, JSON.stringify(newMonth));
        }
        markOnboardingDoneLocally(user?.uid);
      }
      localStorage.setItem('flousy_currency', currency);
    } catch (e) {
      console.warn('LocalStorage save warning:', e);
    }

    if (user) {
      try {
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Firebase timeout')), 2000)
        );
        const dbPromise = isHouseholdScope && householdId
          ? Promise.all([
              saveHouseholdMonthBudget(householdId, monthKey, newMonth),
              markHouseholdOnboarded(),
              // The household budget period is its own setting; without this the
              // start date picked during household onboarding was discarded.
              updateProfileData({ householdMonthStartDate: monthStartDate }),
            ])
          : Promise.all([
              saveMonthBudget(user.uid, monthKey, newMonth),
              updateProfileData({ currency, onboardingComplete: true, monthStartDate }),
            ]);
        await Promise.race([dbPromise, timeoutPromise]);
      } catch (e) {
        console.warn('Firebase save skipped or timed out:', e);
      }
    }

    // Redirect to dashboard smoothly.
    router.push('/dashboard');
  };

  const handleBack = () => {
    if (step === 1) {
      router.push('/');
    } else {
      setStep(step - 1);
    }
  };

  return (
    <main id="main-content" className="min-h-screen bg-background text-on-surface flex flex-col font-sans px-4 py-6 max-w-lg mx-auto justify-between">
      {/* Sticky Header Bar */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <button
            type="button"
            onClick={handleBack}
            className="w-10 h-10 rounded-full bg-surface-container hover:bg-surface-variant flex items-center justify-center text-on-surface-variant transition-all active:scale-95 cursor-pointer"
            aria-label={m.common.back}
          >
            <AppIcon name={isRTL ? 'arrow_forward' : 'arrow_back'} className=" text-[22px]" />
          </button>

          <span className="flex items-center gap-2">
            <Image
              src="/logo.png"
              alt={m.common.appName}
              width={30}
              height={30}
              className="object-contain"
              priority
            />
            <span className="font-display text-[22px] font-extrabold text-primary tracking-tight">SmartJib</span>
          </span>

          <span className="text-[13px] font-bold text-on-surface-variant min-w-[60px] text-end">
            {isImporting ? '' : `${new Intl.NumberFormat(intlLocale).format(step)}/${new Intl.NumberFormat(intlLocale).format(5)}`}
          </span>
        </div>

        {/* Step Progress Bar */}
        {!isImporting && (
        <div className="flex flex-col gap-1 mb-6">
          <div className="flex justify-between items-center text-[12px] font-extrabold text-on-surface-variant uppercase tracking-wider">
            <span>{t(m.common.step, { current: new Intl.NumberFormat(intlLocale).format(step), total: new Intl.NumberFormat(intlLocale).format(5) })}</span>
            <span>{formatPercent(step * 20)}</span>
          </div>
          <div className="w-full h-2 bg-surface-variant/80 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300 rounded-full"
              style={{ width: `${step * 20}%` }}
            />
          </div>
        </div>
        )}

        {importError && (
          <div className="mb-6 rounded-2xl border border-error/40 bg-error-container/40 p-4 text-center">
            <p className="text-[14px] font-bold text-on-error-container">{importError}</p>
            <button
              type="button"
              onClick={handleImportPersonal}
              className="mt-3 rounded-xl bg-primary px-4 py-2 text-[13px] font-bold text-on-primary"
            >
              {m.common.retry}
            </button>
          </div>
        )}

        {isImporting && (
          <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <AppIcon name="sync" className="animate-spin text-[28px] text-primary" />
            </span>
            <h2 className="text-[22px] font-extrabold text-on-surface">{m.onboarding.importPersonalLoading}</h2>
            <p className="max-w-sm text-[14px] font-medium text-on-surface-variant">
              {m.onboarding.importPersonalHint}
            </p>
          </div>
        )}

        {step === 1 && !isImporting && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleStep1Continue();
            }}
            className="flex flex-col gap-5"
          >
            {isHouseholdScope && (
              <button
                type="button"
                onClick={() => void handleImportPersonal()}
                className="flex items-start gap-3 bg-primary/8 p-4 rounded-[20px] border-2 border-primary text-start"
              >
                <AppIcon name="cloud_download" className="mt-0.5 text-[22px] text-primary shrink-0" />
                <span className="flex flex-col gap-0.5">
                  <span className="text-[15px] font-extrabold text-on-surface">
                    {m.onboarding.importPersonalTitle}
                  </span>
                  <span className="text-[12px] font-medium text-on-surface-variant">{m.onboarding.importPersonalHint}</span>
                </span>
              </button>
            )}

            <div className="text-center">
              <h2 className="text-[26px] font-extrabold text-on-surface leading-tight">
                {m.onboarding.step1Title}
              </h2>
              <p className="text-[15px] font-medium text-on-surface-variant mt-1.5 max-w-sm mx-auto">
                {m.onboarding.step1Subtitle}
              </p>
            </div>

            <div className="bg-background p-5 rounded-[24px] border border-outline-variant flex flex-col gap-4 shadow-2xs">
              <label className="text-[13px] font-bold text-on-surface-variant">{m.onboarding.averageMonthlyIncome}</label>

              <div className="flex items-center justify-between p-3.5 bg-surface border border-outline-variant/90 rounded-2xl gap-3">
                {/* Currency Dropdown */}
                <div className="w-32">
                  <CustomSelect
                    value={currency}
                    onChange={setCurrency}
                    options={Object.values(SUPPORTED_CURRENCIES).map((c) => ({
                      value: c.code,
                      label: `${c.code} (${c.symbol})`,
                    }))}
                  />
                </div>

                {/* Big Numeric Input */}
                <input
                  type="text"
                  inputMode="decimal"
                  value={income}
                  onChange={(e) => {
                    setIncome(e.target.value);
                    if (incomeError) setIncomeError('');
                  }}
                  placeholder="0.00"
                  className="text-[32px] sm:text-[36px] font-extrabold text-on-surface text-end bg-transparent outline-none w-full ms-2"
                />
              </div>

              {incomeError && (
                <div className="text-[13px] font-bold text-red-500 text-center">
                  {incomeError}
                </div>
              )}

              {/* Quick Amount Selector Pills */}
              <div className="flex justify-center gap-2.5 pt-1">
                {['5000', '10000', '15000'].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => {
                      setIncome(amt);
                      if (incomeError) setIncomeError('');
                    }}
                    className={`px-4 py-2 bg-surface border rounded-full text-[14px] font-bold transition-all shadow-2xs cursor-pointer ${
                      income === amt
                        ? 'border-primary bg-primary-container text-primary'
                        : 'border-outline-variant text-on-surface-variant hover:border-slate-300'
                    }`}
                  >
                    {Number(amt).toLocaleString(intlLocale)}
                  </button>
                ))}
              </div>
            </div>

            {/* Monthly start date (salary payday) */}
            <div className="bg-background p-5 rounded-[24px] border border-outline-variant flex flex-col gap-4 shadow-2xs">
              <div className="flex flex-col gap-1">
                <label className="text-[13px] font-bold text-on-surface-variant">
                  {m.onboarding.monthlyStartDate} <span className="font-medium">({m.common.optional})</span>
                </label>
                <p className="text-[12px] font-medium text-on-surface-variant">
                  {m.onboarding.monthlyStartDescription}
                </p>
              </div>
              <MonthDayPicker
                value={monthStartDate}
                onChange={setMonthStartDate}
                label={m.onboarding.salaryDay}
                hint={
                  monthStartDate
                    ? t(m.onboarding.monthlyStartHint, { day: localizedDay(monthStartDate) })
                    : undefined
                }
              />
            </div>

            <button
              type="submit"
              disabled={isImporting}
              className="w-full py-4 bg-primary hover:bg-primary active:scale-[0.99] text-white font-bold rounded-2xl text-[16px] flex items-center justify-center gap-2 transition-all shadow-xs mt-4 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span>{m.common.continue}</span>
              <AppIcon name={isRTL ? 'arrow_back' : 'arrow_forward'} className=" text-[20px]" />
            </button>
          </form>
        )}

        {/* STEP 2: Select Budget Categories */}
        {step === 2 && !isImporting && (
          <div className="flex flex-col gap-5">
            <div className="text-center">
              <h2 className="text-[26px] font-extrabold text-on-surface leading-tight">
                {m.onboarding.step2Title}
              </h2>
              <p className="text-[15px] font-medium text-on-surface-variant mt-1.5 max-w-sm mx-auto">
                {m.onboarding.step2Subtitle}
              </p>
            </div>

            {/* Grid of Categories */}
            <div className="grid grid-cols-2 gap-3 max-h-[340px] overflow-y-auto pe-1">
              {allCategories.map((cat) => {
                const selected = selectedCategoryNames.includes(cat.name);
                return (
                  <button
                    key={cat.name}
                    type="button"
                    aria-pressed={selected}
                    aria-label={localizeCategoryName(cat.name, m)}
                    onClick={() => toggleCategory(cat.name)}
                    className={`p-3.5 text-start rounded-2xl flex items-center justify-between cursor-pointer transition-all border ${
                      selected
                        ? 'bg-primary-container border-2 border-primary shadow-2xs'
                        : 'bg-surface border-outline-variant hover:bg-surface-container-low'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: cat.color }}
                      />
                      <AppIcon name={cat.icon} className=" text-[20px] text-on-surface-variant shrink-0" />
                      <span className="text-[15px] font-bold text-on-surface truncate">
                        {localizeCategoryName(cat.name, m)}
                      </span>
                    </div>

                    {selected && (
                      <AppIcon name="check_circle" className=" text-primary text-[20px] shrink-0 ms-1" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Add Custom Category Form */}
            {showAddCustom ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleAddCustomCategory();
                }}
                className="flex flex-col gap-2.5 p-3 bg-surface border border-outline-variant rounded-2xl"
              >
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customCatName}
                    onChange={(e) => setCustomCatName(e.target.value)}
                    placeholder={m.onboarding.categoryNamePlaceholder}
                    className="flex-1 px-3 py-2 text-[14px] font-bold text-on-surface bg-surface-container-low border border-outline-variant rounded-xl outline-none focus:border-primary"
                    autoFocus
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 bg-primary text-white font-bold rounded-xl text-[13px] hover:bg-primary cursor-pointer shrink-0"
                  >
                    {m.common.add}
                  </button>
                </div>
                <div className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-extrabold text-on-surface-variant uppercase tracking-wider">{m.onboarding.chooseIcon}</span>
                  <div className="grid grid-cols-8 gap-1">
                    {CUSTOM_ICONS.map((ic) => (
                      <button
                        key={ic}
                        type="button"
                        onClick={() => setCustomCatIcon(ic)}
                        aria-label={translate(`iconPicker.choices.${ic}`)}
                        title={translate(`iconPicker.choices.${ic}`)}
                        className={`p-1.5 rounded-lg flex items-center justify-center transition-colors ${
                          customCatIcon === ic
                            ? 'bg-primary text-white'
                            : 'bg-surface-container text-on-surface-variant hover:bg-surface-variant'
                        }`}
                      >
                        <AppIcon name={ic} className=" text-[18px]" />
                      </button>
                    ))}
                  </div>
                </div>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setShowAddCustom(true)}
                className="text-primary font-bold text-[15px] hover:underline flex items-center justify-center gap-1 my-1 cursor-pointer"
              >
                <AppIcon name="add" className=" text-[18px]" />
                <span>{m.onboarding.addCustomCategory}</span>
              </button>
            )}

            <div className="flex flex-col gap-2.5 mt-2">
              <button
                type="button"
                onClick={() => setStep(3)}
                className="w-full py-4 bg-primary hover:bg-primary active:scale-[0.99] text-white font-bold rounded-2xl text-[16px] transition-all shadow-xs cursor-pointer"
              >
                {m.common.continue}
              </button>
              <button
                type="button"
                onClick={() => setStep(3)}
                className="text-on-surface-variant font-semibold text-[14px] hover:text-on-surface transition-all text-center py-1 cursor-pointer"
              >
                {m.onboarding.skipForNow}
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Fixed Bills */}
        {step === 3 && !isImporting && (
          <div className="flex flex-col gap-5">
            <div className="text-center">
              <h2 className="text-[26px] font-extrabold text-on-surface leading-tight">
                {m.onboarding.step3Title}
              </h2>
              <p className="text-[15px] font-medium text-on-surface-variant mt-1.5 max-w-sm mx-auto">
                {m.onboarding.step3Subtitle}
              </p>
            </div>

            {/* Bill Input Card */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleAddBill();
              }}
              className="bg-background p-4 sm:p-5 rounded-[24px] border border-outline-variant flex flex-col gap-3"
            >
              <div className="flex flex-col gap-1">
                <label className="text-[13px] font-bold text-on-surface-variant">{m.onboarding.billName}</label>
                <input
                  type="text"
                  value={newBillName}
                  onChange={(e) => setNewBillName(e.target.value)}
                  placeholder={m.onboarding.billNamePlaceholder}
                  className="p-3 bg-surface border border-outline-variant rounded-xl text-[14px] font-medium text-on-surface outline-none focus:border-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="flex flex-col gap-1">
                  <label className="text-[13px] font-bold text-on-surface-variant">{m.onboarding.billAmount}</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={newBillAmount}
                    onChange={(e) => setNewBillAmount(e.target.value)}
                    placeholder={`${symbol} 0.00`}
                    className="p-3 bg-surface border border-outline-variant rounded-xl text-[14px] font-mono font-bold text-on-surface outline-none focus:border-primary"
                  />
                </div>

                <CustomSelect
                  label={m.onboarding.billCategory}
                  value={newBillCategory}
                  onChange={setNewBillCategory}
                  options={[
                    { value: 'Housing', label: m.onboarding.billCategoryOptions.housing },
                    { value: 'Utilities', label: m.onboarding.billCategoryOptions.utilities },
                    { value: 'Internet & Phone', label: m.onboarding.billCategoryOptions.internetPhone },
                    { value: 'Subscriptions', label: m.onboarding.billCategoryOptions.subscriptions },
                    { value: 'Insurance', label: m.onboarding.billCategoryOptions.insurance },
                    { value: 'Transport', label: m.onboarding.billCategoryOptions.transport },
                    { value: 'Food & Groceries', label: m.onboarding.billCategoryOptions.foodGroceries },
                    { value: 'Health', label: m.onboarding.billCategoryOptions.health },
                    { value: 'Education', label: m.onboarding.billCategoryOptions.education },
                    { value: 'Childcare', label: m.onboarding.billCategoryOptions.childcare },
                    { value: 'Entertainment', label: m.onboarding.billCategoryOptions.entertainment },
                    { value: 'Loans', label: m.onboarding.billCategoryOptions.loans },
                    { value: 'Savings', label: m.onboarding.billCategoryOptions.savings },
                    { value: 'Other', label: m.onboarding.billCategoryOptions.other },
                  ]}
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-primary-container hover:bg-primary-container text-primary font-bold rounded-xl text-[14px] flex items-center justify-center gap-1 transition-all mt-1 cursor-pointer"
              >
                <AppIcon name="add" className=" text-[18px]" />
                <span>{m.onboarding.addBill}</span>
              </button>
            </form>

            {/* One-tap suggestions replace the old pre-seeded example bills:
                they only prefill the form, so nothing is saved until the user
                types a real amount and adds it. */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[12px] font-bold text-on-surface-variant">{m.onboarding.suggestedBills}</span>
              {([
                { name: 'Rent', label: m.onboarding.rent, category: 'Housing' },
                { name: 'Electricity', label: m.onboarding.electricity, category: 'Utilities' },
              ] as const)
                .filter((sugg) => !bills.some((b) => b.name === sugg.name))
                .map((sugg) => (
                  <button
                    key={sugg.name}
                    type="button"
                    onClick={() => {
                      setNewBillName(sugg.name);
                      setNewBillCategory(sugg.category);
                    }}
                    className="px-3 py-1.5 bg-surface border border-outline-variant rounded-full text-[13px] font-bold text-on-surface-variant hover:border-primary hover:text-primary transition-all cursor-pointer"
                  >
                    {sugg.label}
                  </button>
                ))}
            </div>

            {/* Added Bills List */}
            {bills.length > 0 && (
              <div className="flex flex-col gap-2">
                <h3 className="text-[17px] font-extrabold text-on-surface">{m.onboarding.addedBills}</h3>
                <div className="flex flex-col gap-2 max-h-[180px] overflow-y-auto">
                  {bills.map((b, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 bg-surface border border-outline-variant rounded-2xl flex justify-between items-center"
                    >
                      <div className="flex items-center gap-3">
                        {(() => {
const billIconMap: Record<string, { icon: string; bg: string; text: string }> = {
  'Housing':            { icon: 'home',            bg: 'bg-[#0f766e]/10', text: 'text-[#0f766e]' }, // teal-adjacent, distinct from --primary
  'Utilities':          { icon: 'bolt',             bg: 'bg-[#a16207]/10', text: 'text-[#a16207]' },
  'Internet & Phone':   { icon: 'wifi',              bg: 'bg-[#1d4ed8]/10', text: 'text-[#1d4ed8]' },
  'Subscriptions':      { icon: 'subscriptions',     bg: 'bg-[#7c3aed]/10', text: 'text-[#7c3aed]' },
  'Insurance':          { icon: 'shield',            bg: 'bg-[#575e70]/10', text: 'text-[#575e70]' }, // app --secondary
  'Transport':          { icon: 'directions_car',    bg: 'bg-[#0e7490]/10', text: 'text-[#0e7490]' },
  'Food & Groceries':   { icon: 'restaurant',        bg: 'bg-[#924628]/10', text: 'text-[#924628]' }, // app --tertiary
  'Health':             { icon: 'favorite',          bg: 'bg-[#be123c]/10', text: 'text-[#be123c]' },
  'Education':          { icon: 'school',            bg: 'bg-[#4338ca]/10', text: 'text-[#4338ca]' },
  'Childcare':          { icon: 'child_care',        bg: 'bg-[#be185d]/10', text: 'text-[#be185d]' },
  'Entertainment':      { icon: 'sports_esports',    bg: 'bg-[#047857]/10', text: 'text-[#047857]' },
  'Loans':              { icon: 'account_balance',   bg: 'bg-[#9f1239]/10', text: 'text-[#9f1239]' },
  'Savings':            { icon: 'savings',           bg: 'bg-[#0f766e]/10', text: 'text-[#0f766e]' }, // shares Housing's hue — both "asset-building"
  'Other':              { icon: 'category',          bg: 'bg-[#3d4947]/10', text: 'text-[#3d4947]' }, // app --on-surface-variant
};
                          const tone = billIconMap[b.category] || billIconMap['Other'];
                          return (
                            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${tone.bg} ${tone.text}`}>
                              <AppIcon name={tone.icon} className=" text-[20px]" />
                            </div>
                          );
                        })()}
                        <div className="flex flex-col">
                          <span className="text-[15px] font-bold text-on-surface">{localizeDefaultBillName(b.name, m)}</span>
                          <span className="text-[12px] font-medium text-on-surface-variant">
                            • {localizeBillCategory(b.category, m)}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="font-mono font-extrabold text-on-surface text-[15px]">
                          {format(b.amount)}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveBill(idx)}
                          aria-label={t(m.onboarding.removeBill, { name: localizeDefaultBillName(b.name, m) })}
                          className="text-on-surface-variant/60 hover:text-red-500 p-1 cursor-pointer"
                        >
                          <AppIcon name="close" className=" text-[18px]" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Total Fixed Bills summary card */}
                <div className="p-4 bg-background border border-outline-variant rounded-2xl flex justify-between items-center mt-1">
                  <span className="text-[15px] font-bold text-on-surface-variant">{m.onboarding.totalBills}</span>
                  <span className="text-[18px] font-extrabold text-on-surface font-mono">
                    {format(totalBills)}
                  </span>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between gap-3 mt-2">
              <button
                type="button"
                onClick={() => setStep(4)}
                className="text-on-surface-variant font-semibold text-[14px] hover:text-on-surface transition-all px-4 py-3 cursor-pointer"
              >
                {m.onboarding.skipForNow}
              </button>
              <button
                type="button"
                onClick={handleStep3Continue}
                className="flex-1 py-4 bg-primary hover:bg-primary active:scale-[0.99] text-white font-bold rounded-2xl text-[16px] transition-all shadow-xs cursor-pointer"
              >
                {m.common.continue}
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: Choose Strategy */}
        {step === 4 && !isImporting && (
          <div className="flex flex-col gap-5">
            <div className="text-center">
              <h2 className="text-[26px] font-extrabold text-on-surface leading-tight">
                {m.onboarding.step4Title}
              </h2>
              <p className="text-[15px] font-medium text-on-surface-variant mt-1.5 max-w-sm mx-auto">
                {t(m.onboarding.step4Subtitle, { income: format(parsedIncome) })}
              </p>
            </div>

            <div className="flex flex-col gap-3 max-h-[380px] overflow-y-auto pe-1">
              {Object.values(STRATEGIES).map((strat) => {
                const selected = selectedStrategy === strat.id;
                const strategyCopy = localizeStrategy(strat.id, m, intlLocale);

                return (
                  // Mouse-only convenience surface; keyboard and AT semantics
                  // live on the real <input type="radio"> inside the card.
                  // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
                  <div
                    key={strat.id}
                    onClick={() => setSelectedStrategy(strat.id)}
                    className={`p-4 rounded-2xl border flex flex-col gap-3 cursor-pointer transition-all focus-within:ring-2 focus-within:ring-primary/60 ${
                      selected
                        ? 'border-2 border-primary bg-primary-container/30 shadow-2xs'
                        : 'border-outline-variant bg-surface hover:bg-surface-container-low'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-[17px] font-extrabold text-on-surface">{strategyCopy.name}</h3>
                        <p className="text-[13px] font-medium text-on-surface-variant mt-0.5 leading-snug">
                          {strategyCopy.description}
                        </p>
                      </div>

                      {/* Real radio input (keyboard + screen-reader semantics);
                          the visual dot renders on top of the invisible control. */}
                      <span
                        className={`relative w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${
                          selected ? 'border-primary bg-primary' : 'border-slate-300'
                        }`}
                      >
                        <input
                          type="radio"
                          name="onboarding-strategy"
                          value={strat.id}
                          checked={selected}
                          onChange={() => setSelectedStrategy(strat.id)}
                          aria-label={strategyCopy.name}
                          className="absolute inset-0 h-full w-full cursor-pointer appearance-none rounded-full opacity-0"
                        />
                        {selected && <span className="w-2 h-2 rounded-full bg-surface" />}
                      </span>
                    </div>

                    {/* Segmented Bar Visual */}
                    {strat.id === '50-30-20' && (
                      <div className="flex flex-col gap-1.5 pt-1">
                        <div className="w-full h-2.5 rounded-full overflow-hidden flex bg-surface-container">
                          <div className="h-full bg-primary" style={{ width: '50%' }} />
                          <div className="h-full bg-tertiary" style={{ width: '30%' }} />
                          <div className="h-full bg-surface-variant" style={{ width: '20%' }} />
                        </div>
                        <div className="flex justify-between text-[11px] font-extrabold uppercase text-on-surface-variant">
                          <span>{m.onboarding.needs}</span>
                          <span>{m.onboarding.wants}</span>
                          <span>{m.onboarding.savings}</span>
                        </div>
                      </div>
                    )}

                    {strat.id === 'zero-based' && (
                      <div className="flex flex-col gap-1.5 pt-1">
                        <div className="w-full h-2.5 rounded-full overflow-hidden flex gap-1">
                          <div className="h-full flex-1 bg-primary rounded-sm" />
                          <div className="h-full flex-1 bg-primary rounded-sm" />
                          <div className="h-full flex-1 bg-primary rounded-sm" />
                          <div className="h-full flex-1 bg-primary rounded-sm" />
                        </div>
                        <span className="text-[12px] font-bold text-on-surface-variant text-center">
                          {t(m.onboarding.everyDollarAllocated, { amount: format(0) })}
                        </span>
                      </div>
                    )}

                    {strat.id === 'envelope' && (
                      <div className="flex gap-2 pt-1">
                        <div className="flex-1 py-1 bg-primary-container rounded-lg border border-primary/20 text-center text-[11px] font-bold text-primary">
                          {m.onboarding.needs}
                        </div>
                        <div className="flex-1 py-1 bg-amber-50 rounded-lg border border-amber-200 text-center text-[11px] font-bold text-amber-800">
                          {m.onboarding.wants}
                        </div>
                        <div className="flex-1 py-1 bg-surface-container rounded-lg border border-outline-variant text-center text-[11px] font-bold text-on-surface-variant">
                          {m.onboarding.savings}
                        </div>
                      </div>
                    )}

                    {strat.id === 'pay-first' && (
                      <div className="flex flex-col gap-1 pt-1">
                        <div className="w-full h-2.5 rounded-full overflow-hidden flex bg-surface-container">
                          <div className="h-full bg-primary" style={{ width: '30%' }} />
                          <div className="h-full bg-surface-variant" style={{ width: '70%' }} />
                        </div>
                        <div className="flex justify-between text-[11px] font-bold text-on-surface-variant">
                          <span className="text-primary">{m.onboarding.saveFirst}</span>
                          <span>{m.onboarding.spendTheRest}</span>
                        </div>
                      </div>
                    )}

                    {/* Custom strategy: definable split, editable in place */}
                    {strat.id === 'custom' && (
                      // Stops card-selection clicks from swallowing editor
                      // interaction; purely a bubbling guard, not a control.
                      // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
                      <div
                        className="flex flex-col gap-3 pt-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="w-full h-2.5 rounded-full overflow-hidden flex bg-surface-container">
                          <div className="h-full bg-primary" style={{ width: `${customSplit.needs}%` }} />
                          <div className="h-full bg-tertiary" style={{ width: `${customSplit.wants}%` }} />
                          <div className="h-full bg-surface-variant" style={{ width: `${customSplit.savings}%` }} />
                        </div>

                        {selected ? (
                          <>
                            {([
                              { key: 'needs' as const, label: m.onboarding.needs, dot: 'bg-primary' },
                              { key: 'wants' as const, label: m.onboarding.wants, dot: 'bg-tertiary' },
                              { key: 'savings' as const, label: m.onboarding.savings, dot: 'bg-surface-variant' },
                            ]).map(({ key, label, dot }) => (
                              <div key={key} className="flex flex-col gap-1">
                                <div className="flex items-center justify-between">
                                  <span className="flex items-center gap-2 text-[12px] font-bold text-on-surface">
                                    <span className={`w-2.5 h-2.5 rounded-full ${dot}`} />
                                    {label}
                                  </span>
                                  <span className="flex items-center gap-1.5">
                                    <input
                                      type="number"
                                      min={0}
                                      max={100}
                                      value={customSplit[key]}
                                      onChange={(e) => handleCustomSplitChange(key, Number(e.target.value))}
                                      aria-label={t(m.strategySelector.percentage, { label })}
                                      className="w-16 rounded-lg border border-outline-variant bg-surface px-2 py-1 text-end text-[13px] font-bold text-on-surface tabular-nums outline-none focus:border-primary"
                                    />
                                    <span className="text-[12px] font-bold text-on-surface-variant">{percentSign}</span>
                                  </span>
                                </div>
                                <input
                                  type="range"
                                  min={0}
                                  max={100}
                                  step={1}
                                  value={customSplit[key]}
                                  onChange={(e) => handleCustomSplitChange(key, Number(e.target.value))}
                                  aria-label={t(m.strategySelector.slider, { label })}
                                  className="w-full cursor-pointer"
                                />
                                <span className="text-[11px] font-bold text-on-surface-variant tabular-nums">
                                  {format(Math.round((parsedIncome * customSplit[key]) / 100))}
                                </span>
                              </div>
                            ))}

                            {!isCustomSplitValid && (
                              <p role="alert" className="text-[11px] font-bold text-error">
                                {t(m.onboarding.customSplitInvalid, { required: formatPercent(100), percent: formatPercent(customSplitTotal) })}
                              </p>
                            )}
                          </>
                        ) : (
                          <div className="flex justify-between text-[11px] font-bold text-on-surface-variant">
                            <span>{t(m.onboarding.customSplitSummary, { percent: formatPercent(customSplit.needs), label: m.onboarding.needs })}</span>
                            <span>{t(m.onboarding.customSplitSummary, { percent: formatPercent(customSplit.wants), label: m.onboarding.wants })}</span>
                            <span>{t(m.onboarding.customSplitSummary, { percent: formatPercent(customSplit.savings), label: m.onboarding.savings })}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => setStep(5)}
              disabled={selectedStrategy === 'custom' && !isCustomSplitValid}
              className="w-full py-4 bg-primary hover:bg-primary active:scale-[0.99] text-white font-bold rounded-2xl text-[16px] transition-all shadow-xs mt-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {m.common.continue}
            </button>
          </div>
        )}

        {/* STEP 5: Budget Overview */}
        {step === 5 && !isImporting && (
          <div className="flex flex-col gap-5">
            <div className="text-center">
              <h2 className="text-[26px] font-extrabold text-on-surface leading-tight">
                {m.onboarding.step5Title}
              </h2>
              <p className="text-[15px] font-medium text-on-surface-variant mt-1.5 max-w-sm mx-auto">
                {t(m.onboarding.step5Subtitle, { strategy: activeStrategyCopy.name })}
              </p>
            </div>

            {/* Donut Chart Card */}
            <div className="bg-surface p-6 rounded-[28px] border border-outline-variant/90 shadow-2xs flex flex-col items-center gap-5">
              <div className="relative w-52 h-52 flex items-center justify-center">
                {(() => {
                  const circumference = 2 * Math.PI * 38; // ~238.76
                  const strategy = activeStrategy;
                  const needsArc = circumference * strategy.needsRatio;
                  const wantsArc = circumference * strategy.wantsRatio;
                  const savingsArc = circumference * strategy.savingsRatio;
                  const wantsOffset = -needsArc;
                  const savingsOffset = -(needsArc + wantsArc);

                  return (
                    <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                      <circle
                        cx="50"
                        cy="50"
                        r="38"
                        fill="none"
                        stroke="var(--surface-variant)"
                        strokeWidth="10"
                      />
                      {/* Needs Arc */}
                      <circle
                        cx="50"
                        cy="50"
                        r="38"
                        fill="none"
                        stroke="var(--primary)"
                        strokeWidth="10"
                        strokeDasharray={`${needsArc} ${circumference}`}
                        strokeDashoffset="0"
                      />
                      {/* Wants Arc */}
                      <circle
                        cx="50"
                        cy="50"
                        r="38"
                        fill="none"
                        stroke="var(--tertiary)"
                        strokeWidth="10"
                        strokeDasharray={`${wantsArc} ${circumference}`}
                        strokeDashoffset={String(wantsOffset)}
                      />
                      {/* Savings Arc */}
                      <circle
                        cx="50"
                        cy="50"
                        r="38"
                        fill="none"
                        stroke="var(--secondary)"
                        strokeWidth="10"
                        strokeDasharray={`${savingsArc} ${circumference}`}
                        strokeDashoffset={String(savingsOffset)}
                      />
                    </svg>
                  );
                })()}

                <div className="absolute flex flex-col items-center text-center px-2">
                  <span className="text-[10px] font-extrabold tracking-wider text-on-surface-variant/60 uppercase">
                    {m.onboarding.monthly}
                  </span>
                  <span className="text-[16px] font-extrabold text-on-surface font-mono leading-tight max-w-full truncate">
                    {format(parsedIncome)}
                  </span>
                </div>
              </div>

              {/* Envelope Items */}
              <div className="w-full flex flex-col gap-2.5">
                <div className="p-3.5 bg-background rounded-2xl border border-outline-variant/50 flex justify-between items-center">
                  <div className="flex items-center gap-2.5">
                    <span className="w-3 h-3 rounded-full bg-primary" />
                    <div className="flex flex-col">
                      <span className="text-[14px] font-bold text-on-surface">{m.onboarding.fixedNeeds}</span>
                      <span className="text-[12px] font-medium text-on-surface-variant">
                        {t(m.onboarding.ofIncome, { percent: formatPercent(Math.round(activeStrategy.needsRatio * 100)) })}
                      </span>
                    </div>
                  </div>
                  <span className="text-[16px] font-extrabold font-mono text-on-surface">
                    {format(envelopes.needs)}
                  </span>
                </div>

                <div className="p-3.5 bg-background rounded-2xl border border-outline-variant/50 flex justify-between items-center">
                  <div className="flex items-center gap-2.5">
                    <span className="w-3 h-3 rounded-full bg-tertiary" />
                    <div className="flex flex-col">
                      <span className="text-[14px] font-bold text-on-surface">{m.onboarding.variableWants}</span>
                      <span className="text-[12px] font-medium text-on-surface-variant">
                        {t(m.onboarding.ofIncome, { percent: formatPercent(Math.round(activeStrategy.wantsRatio * 100)) })}
                      </span>
                    </div>
                  </div>
                  <span className="text-[16px] font-extrabold font-mono text-on-surface">
                    {format(envelopes.wants)}
                  </span>
                </div>

                <div className="p-3.5 bg-background rounded-2xl border border-outline-variant/50 flex justify-between items-center">
                  <div className="flex items-center gap-2.5">
                    <span className="w-3 h-3 rounded-full bg-secondary" />
                    <div className="flex flex-col">
                      <span className="text-[14px] font-bold text-on-surface">{m.onboarding.futureSavings}</span>
                      <span className="text-[12px] font-medium text-on-surface-variant">
                        {t(m.onboarding.ofIncome, { percent: formatPercent(Math.round(activeStrategy.savingsRatio * 100)) })}
                      </span>
                    </div>
                  </div>
                  <span className="text-[16px] font-extrabold font-mono text-primary">
                    {format(envelopes.savings)}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2 mt-2">
              <button
                type="button"
                onClick={handleCompleteOnboarding}
                disabled={isCompleting}
                className="w-full py-4 bg-primary hover:bg-primary active:scale-[0.99] text-white font-bold rounded-2xl text-[16px] flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer disabled:opacity-50"
              >
                <span>{isCompleting ? m.onboarding.finishingSetup : m.onboarding.confirmAndFinish}</span>
                {!isCompleting && (
                  <AppIcon name="check_circle" className=" text-[20px]" />
                )}
              </button>
              <button
                type="button"
                onClick={() => setStep(4)}
                disabled={isCompleting}
                className="text-primary font-bold text-[14px] hover:underline text-center py-1 cursor-pointer"
              >
                {m.onboarding.editAllocation}
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
