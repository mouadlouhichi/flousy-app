'use client';

import { AppIcon } from '@/components/ui/app-icon';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth-context';
import { useCurrency } from '../../lib/currency-context';
import { SUPPORTED_CURRENCIES } from '../../lib/currency';
import { STRATEGIES, StrategyId, calculateEnvelopeAmounts, createNewMonth } from '../../lib/store';
import { saveMonthBudget } from '../../lib/db';
import { CustomSelect } from '../../components/ui/CustomSelect';

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
  const router = useRouter();
  const { user, updateProfileData } = useAuth();
  const { currency, setCurrency, symbol, format } = useCurrency();

  const [step, setStep] = useState<number>(1);
  const [income, setIncome] = useState<string>('15000');
  const [selectedStrategy, setSelectedStrategy] = useState<StrategyId>('50-30-20');

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

  const [bills, setBills] = useState<{ name: string; amount: number; category: string }[]>([
    { name: 'Rent', amount: 1500, category: 'Housing' },
    { name: 'Electricity', amount: 120, category: 'Utilities' },
  ]);

  const [newBillName, setNewBillName] = useState('');
  const [newBillAmount, setNewBillAmount] = useState('');
  const [newBillCategory, setNewBillCategory] = useState('Housing');

  const [isCompleting, setIsCompleting] = useState(false);
  const [incomeError, setIncomeError] = useState('');

  // Clean numeric string parsing for income (handles comma/formatting)
  const cleanNumStr = (income || '').toString().replace(/[^0-9.]/g, '');
  const parsedIncome = parseFloat(cleanNumStr) || 0;
  const envelopes = calculateEnvelopeAmounts(parsedIncome, selectedStrategy);
  const totalBills = bills.reduce((acc, b) => acc + b.amount, 0);

  const handleStep1Continue = () => {
    setIncomeError('');
    if (parsedIncome <= 0) {
      setIncomeError('Please enter a valid monthly income greater than 0.');
      return;
    }
    setStep(2);
  };

  const handleAddBill = () => {
    if (!newBillName.trim() || !newBillAmount) return;
    const amt = parseFloat(newBillAmount.toString().replace(/[^0-9.]/g, ''));
    if (amt <= 0) return;

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
      const amt = parseFloat(newBillAmount.toString().replace(/[^0-9.]/g, ''));
      if (amt > 0) {
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

  const handleCompleteOnboarding = async () => {
    if (isCompleting) return;
    setIsCompleting(true);

    const today = new Date();
    const monthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    const newMonth = createNewMonth(parsedIncome, selectedStrategy, selectedCategoryNames, bills, monthKey);

    // Save in localStorage immediately
    try {
      localStorage.setItem(`flousy_month_${monthKey}`, JSON.stringify(newMonth));
      localStorage.setItem('flousy_onboarding_done', 'true');
      localStorage.setItem('flousy_currency', currency);
    } catch (e) {
      console.warn('LocalStorage save warning:', e);
    }

    // Try saving to Firebase with a strict 2s timeout so navigation never hangs
    if (user) {
      try {
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Firebase timeout')), 2000)
        );
        // updateProfileData also flips the in-context profile so route guards
        // immediately treat onboarding as complete.
        const dbPromise = Promise.all([
          saveMonthBudget(user.uid, monthKey, newMonth),
          updateProfileData({ currency, onboardingComplete: true }),
        ]);
        await Promise.race([dbPromise, timeoutPromise]);
      } catch (e) {
        console.warn('Firebase save skipped or timed out:', e);
      }
    }

    // Redirect to dashboard smoothly
    try {
      router.push('/dashboard');
    } catch {
      window.location.href = '/dashboard';
    }
  };

  const handleBack = () => {
    if (step === 1) {
      router.push('/');
    } else {
      setStep(step - 1);
    }
  };

  return (
    <div className="min-h-screen bg-background text-on-surface flex flex-col font-sans px-4 py-6 max-w-lg mx-auto justify-between">
      {/* Sticky Header Bar */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <button
            type="button"
            onClick={handleBack}
            className="w-10 h-10 rounded-full bg-surface-container hover:bg-surface-variant flex items-center justify-center text-on-surface-variant transition-all active:scale-95 cursor-pointer"
            aria-label="Back"
          >
            <AppIcon name="arrow_back" className=" text-[22px]" />
          </button>

          <span className="font-display text-[22px] font-extrabold text-primary tracking-tight">Flousy</span>

          <span className="text-[13px] font-bold text-on-surface-variant min-w-[60px] text-right">
            {step === 1
              ? '1/5'
              : step === 2
              ? '2/5'
              : step === 3
              ? '3/5'
              : step === 4
              ? '4/5'
              : '5/5'}
          </span>
        </div>

        {/* Step Progress Bar */}
        <div className="flex flex-col gap-1 mb-6">
          <div className="flex justify-between items-center text-[12px] font-extrabold text-on-surface-variant uppercase tracking-wider">
            <span>STEP {step} OF 5</span>
            <span>{step * 20}%</span>
          </div>
          <div className="w-full h-2 bg-surface-variant/80 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300 rounded-full"
              style={{ width: `${step * 20}%` }}
            />
          </div>
        </div>

        {/* STEP 1: Monthly Income */}
        {step === 1 && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleStep1Continue();
            }}
            className="flex flex-col gap-5"
          >
            <div className="text-center">
              <h2 className="text-[26px] font-extrabold text-on-surface leading-tight">
                What is your monthly income?
              </h2>
              <p className="text-[15px] font-medium text-on-surface-variant mt-1.5 max-w-sm mx-auto">
                We use this to set up your baseline budget and recommend saving goals.
              </p>
            </div>

            <div className="bg-background p-5 rounded-[24px] border border-outline-variant flex flex-col gap-4 shadow-2xs">
              <label className="text-[13px] font-bold text-on-surface-variant">Average Monthly Income</label>

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
                  className="text-[32px] sm:text-[36px] font-extrabold text-on-surface text-right bg-transparent outline-none w-full ml-2"
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
                    {Number(amt).toLocaleString()}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-4 bg-primary hover:bg-primary active:scale-[0.99] text-white font-bold rounded-2xl text-[16px] flex items-center justify-center gap-2 transition-all shadow-xs mt-4 cursor-pointer"
            >
              <span>Continue</span>
              <AppIcon name="arrow_forward" className=" text-[20px]" />
            </button>
          </form>
        )}

        {/* STEP 2: Select Budget Categories */}
        {step === 2 && (
          <div className="flex flex-col gap-5">
            <div className="text-center">
              <h2 className="text-[26px] font-extrabold text-on-surface leading-tight">
                Select your budget categories
              </h2>
              <p className="text-[15px] font-medium text-on-surface-variant mt-1.5 max-w-sm mx-auto">
                Choose the main areas where you spend your money to tailor your dashboard.
              </p>
            </div>

            {/* Grid of Categories */}
            <div className="grid grid-cols-2 gap-3 max-h-[340px] overflow-y-auto pr-1">
              {allCategories.map((cat) => {
                const selected = selectedCategoryNames.includes(cat.name);
                return (
                  <div
                    key={cat.name}
                    onClick={() => toggleCategory(cat.name)}
                    className={`p-3.5 rounded-2xl flex items-center justify-between cursor-pointer transition-all border ${
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
                        {cat.name}
                      </span>
                    </div>

                    {selected && (
                      <AppIcon name="check_circle" className=" text-primary text-[20px] shrink-0 ml-1" />
                    )}
                  </div>
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
                    placeholder="Category Name (e.g. Gym)"
                    className="flex-1 px-3 py-2 text-[14px] font-bold text-on-surface bg-surface-container-low border border-outline-variant rounded-xl outline-none focus:border-primary"
                    autoFocus
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 bg-primary text-white font-bold rounded-xl text-[13px] hover:bg-primary cursor-pointer shrink-0"
                  >
                    Add
                  </button>
                </div>
                <div className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-extrabold text-on-surface-variant uppercase tracking-wider">Pick an Icon</span>
                  <div className="grid grid-cols-8 gap-1">
                    {CUSTOM_ICONS.map((ic) => (
                      <button
                        key={ic}
                        type="button"
                        onClick={() => setCustomCatIcon(ic)}
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
                <span>Add Custom Category</span>
              </button>
            )}

            <div className="flex flex-col gap-2.5 mt-2">
              <button
                type="button"
                onClick={() => setStep(3)}
                className="w-full py-4 bg-primary hover:bg-primary active:scale-[0.99] text-white font-bold rounded-2xl text-[16px] transition-all shadow-xs cursor-pointer"
              >
                Continue
              </button>
              <button
                type="button"
                onClick={() => setStep(3)}
                className="text-on-surface-variant font-semibold text-[14px] hover:text-on-surface transition-all text-center py-1 cursor-pointer"
              >
                Skip for now
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Fixed Bills */}
        {step === 3 && (
          <div className="flex flex-col gap-5">
            <div className="text-center">
              <h2 className="text-[26px] font-extrabold text-on-surface leading-tight">
                Add your monthly bills
              </h2>
              <p className="text-[15px] font-medium text-on-surface-variant mt-1.5 max-w-sm mx-auto">
                Enter recurring expenses like rent, utilities, and subscriptions.
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
                <label className="text-[13px] font-bold text-on-surface-variant">Bill Name</label>
                <input
                  type="text"
                  value={newBillName}
                  onChange={(e) => setNewBillName(e.target.value)}
                  placeholder="e.g. Rent, Netflix, Electricity"
                  className="p-3 bg-surface border border-outline-variant rounded-xl text-[14px] font-medium text-on-surface outline-none focus:border-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="flex flex-col gap-1">
                  <label className="text-[13px] font-bold text-on-surface-variant">Amount</label>
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
                  label="Category"
                  value={newBillCategory}
                  onChange={setNewBillCategory}
                  options={[
                    { value: 'Housing', label: 'Housing / Rent' },
                    { value: 'Utilities', label: 'Utilities' },
                    { value: 'Internet & Phone', label: 'Internet & Phone' },
                    { value: 'Subscriptions', label: 'Subscriptions' },
                    { value: 'Insurance', label: 'Insurance' },
                    { value: 'Transport', label: 'Transport / Fuel' },
                    { value: 'Food & Groceries', label: 'Food & Groceries' },
                    { value: 'Health', label: 'Health / Medical' },
                    { value: 'Education', label: 'Education' },
                    { value: 'Childcare', label: 'Childcare' },
                    { value: 'Entertainment', label: 'Entertainment' },
                    { value: 'Loans', label: 'Loans / Debt' },
                    { value: 'Savings', label: 'Savings / Investment' },
                    { value: 'Other', label: 'Other' },
                  ]}
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-primary-container hover:bg-primary-container text-primary font-bold rounded-xl text-[14px] flex items-center justify-center gap-1 transition-all mt-1 cursor-pointer"
              >
                <AppIcon name="add" className=" text-[18px]" />
                <span>Add Bill</span>
              </button>
            </form>

            {/* Added Bills List */}
            {bills.length > 0 && (
              <div className="flex flex-col gap-2">
                <h3 className="text-[17px] font-extrabold text-on-surface">Added Bills</h3>
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
                          const m = billIconMap[b.category] || billIconMap['Other'];
                          return (
                            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${m.bg} ${m.text}`}>
                              <AppIcon name={m.icon} className=" text-[20px]" />
                            </div>
                          );
                        })()}
                        <div className="flex flex-col">
                          <span className="text-[15px] font-bold text-on-surface">{b.name}</span>
                          <span className="text-[12px] font-medium text-on-surface-variant">
                            • {b.category}
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
                  <span className="text-[15px] font-bold text-on-surface-variant">Total Fixed Bills</span>
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
                Skip for now
              </button>
              <button
                type="button"
                onClick={handleStep3Continue}
                className="flex-1 py-4 bg-primary hover:bg-primary active:scale-[0.99] text-white font-bold rounded-2xl text-[16px] transition-all shadow-xs cursor-pointer"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: Choose Strategy */}
        {step === 4 && (
          <div className="flex flex-col gap-5">
            <div className="text-center">
              <h2 className="text-[26px] font-extrabold text-on-surface leading-tight">
                Choose your strategy
              </h2>
              <p className="text-[15px] font-medium text-on-surface-variant mt-1.5 max-w-sm mx-auto">
                Select a foundation for your financial goals. You can always adjust this later.
              </p>
            </div>

            <div className="flex flex-col gap-3 max-h-[380px] overflow-y-auto pr-1">
              {Object.values(STRATEGIES).map((strat) => {
                const selected = selectedStrategy === strat.id;

                return (
                  <div
                    key={strat.id}
                    onClick={() => setSelectedStrategy(strat.id)}
                    className={`p-4 rounded-2xl border flex flex-col gap-3 cursor-pointer transition-all ${
                      selected
                        ? 'border-2 border-primary bg-primary-container/30 shadow-2xs'
                        : 'border-outline-variant bg-surface hover:bg-surface-container-low'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-[17px] font-extrabold text-on-surface">{strat.name}</h3>
                        <p className="text-[13px] font-medium text-on-surface-variant mt-0.5 leading-snug">
                          {strat.description}
                        </p>
                      </div>

                      {/* Custom Radio Button */}
                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${
                          selected ? 'border-primary bg-primary' : 'border-slate-300'
                        }`}
                      >
                        {selected && <div className="w-2 h-2 rounded-full bg-surface" />}
                      </div>
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
                          <span>Needs</span>
                          <span>Wants</span>
                          <span>Save</span>
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
                          Every dollar allocated ({format(0)} left)
                        </span>
                      </div>
                    )}

                    {strat.id === 'envelope' && (
                      <div className="flex gap-2 pt-1">
                        <div className="flex-1 py-1 bg-primary-container rounded-lg border border-primary/20 text-center text-[11px] font-bold text-primary">
                          Needs
                        </div>
                        <div className="flex-1 py-1 bg-amber-50 rounded-lg border border-amber-200 text-center text-[11px] font-bold text-amber-800">
                          Wants
                        </div>
                        <div className="flex-1 py-1 bg-surface-container rounded-lg border border-outline-variant text-center text-[11px] font-bold text-on-surface-variant">
                          Savings
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
                          <span className="text-primary">Save First</span>
                          <span>Spend the rest</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => setStep(5)}
              className="w-full py-4 bg-primary hover:bg-primary active:scale-[0.99] text-white font-bold rounded-2xl text-[16px] transition-all shadow-xs mt-2 cursor-pointer"
            >
              Continue
            </button>
          </div>
        )}

        {/* STEP 5: Budget Overview */}
        {step === 5 && (
          <div className="flex flex-col gap-5">
            <div className="text-center">
              <h2 className="text-[26px] font-extrabold text-on-surface leading-tight">
                Your Budget Overview
              </h2>
              <p className="text-[15px] font-medium text-on-surface-variant mt-1.5 max-w-sm mx-auto">
                Here is your calculated monthly plan based on the {STRATEGIES[selectedStrategy].name}.
              </p>
            </div>

            {/* Donut Chart Card */}
            <div className="bg-surface p-6 rounded-[28px] border border-outline-variant/90 shadow-2xs flex flex-col items-center gap-5">
              <div className="relative w-52 h-52 flex items-center justify-center">
                {(() => {
                  const circumference = 2 * Math.PI * 38; // ~238.76
                  const strategy = STRATEGIES[selectedStrategy];
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
                    MONTHLY
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
                      <span className="text-[14px] font-bold text-on-surface">Fixed Needs</span>
                      <span className="text-[12px] font-medium text-on-surface-variant">
                        {Math.round(STRATEGIES[selectedStrategy].needsRatio * 100)}% of income
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
                      <span className="text-[14px] font-bold text-on-surface">Variable Wants</span>
                      <span className="text-[12px] font-medium text-on-surface-variant">
                        {Math.round(STRATEGIES[selectedStrategy].wantsRatio * 100)}% of income
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
                      <span className="text-[14px] font-bold text-on-surface">Future Savings</span>
                      <span className="text-[12px] font-medium text-on-surface-variant">
                        {Math.round(STRATEGIES[selectedStrategy].savingsRatio * 100)}% of income
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
                <span>{isCompleting ? 'Finishing setup...' : 'Confirm & Finish'}</span>
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
                Edit Allocation
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
