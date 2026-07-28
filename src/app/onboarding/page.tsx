'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth-context';
import { useCurrency } from '../../lib/currency-context';
import { SUPPORTED_CURRENCIES } from '../../lib/currency';
import { STRATEGIES, StrategyId, calculateEnvelopeAmounts, createNewMonth } from '../../lib/store';
import { saveMonthBudget, setUserProfile } from '../../lib/db';

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
  const { user } = useAuth();
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
    '#d946ef', '#a855f7', '#f43f5e', '#006A60',
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
        const dbPromise = Promise.all([
          saveMonthBudget(user.uid, monthKey, newMonth),
          setUserProfile(user.uid, { currency, onboardingComplete: true }),
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
    <div className="min-h-screen bg-[#f8faf9] text-slate-900 flex flex-col font-sans px-4 py-6 max-w-lg mx-auto justify-between">
      {/* Sticky Header Bar */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <button
            type="button"
            onClick={handleBack}
            className="w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700 transition-all active:scale-95 cursor-pointer"
            aria-label="Back"
          >
            <span className="material-symbols-outlined text-[22px]">arrow_back</span>
          </button>

          <span className="text-[22px] font-extrabold text-[#006A60] tracking-tight">Flousy</span>

          <span className="text-[13px] font-bold text-slate-500 min-w-[60px] text-right">
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
          <div className="flex justify-between items-center text-[12px] font-extrabold text-slate-500 uppercase tracking-wider">
            <span>STEP {step} OF 5</span>
            <span>{step * 20}%</span>
          </div>
          <div className="w-full h-2 bg-slate-200/80 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#006A60] transition-all duration-300 rounded-full"
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
              <h2 className="text-[26px] font-extrabold text-slate-900 leading-tight">
                What is your monthly income?
              </h2>
              <p className="text-[15px] font-medium text-slate-500 mt-1.5 max-w-sm mx-auto">
                We use this to set up your baseline budget and recommend saving goals.
              </p>
            </div>

            <div className="bg-[#f8faf9] p-5 rounded-[24px] border border-slate-200 flex flex-col gap-4 shadow-2xs">
              <label className="text-[13px] font-bold text-slate-700">Average Monthly Income</label>

              <div className="flex items-center justify-between p-3.5 bg-white border border-slate-200/90 rounded-2xl">
                {/* Currency Dropdown */}
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl px-3 py-2 text-[15px] font-bold text-slate-800 outline-none cursor-pointer"
                >
                  {Object.values(SUPPORTED_CURRENCIES).map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code} ({c.symbol})
                    </option>
                  ))}
                </select>

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
                  className="text-[32px] sm:text-[36px] font-extrabold text-slate-900 text-right bg-transparent outline-none w-full ml-2"
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
                    className={`px-4 py-2 bg-white border rounded-full text-[14px] font-bold transition-all shadow-2xs cursor-pointer ${
                      income === amt
                        ? 'border-[#006A60] bg-[#e8f5f3] text-[#006A60]'
                        : 'border-slate-200 text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    {Number(amt).toLocaleString()}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-4 bg-[#006A60] hover:bg-[#00544c] active:scale-[0.99] text-white font-bold rounded-2xl text-[16px] flex items-center justify-center gap-2 transition-all shadow-xs mt-4 cursor-pointer"
            >
              <span>Continue</span>
              <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
            </button>
          </form>
        )}

        {/* STEP 2: Select Budget Categories */}
        {step === 2 && (
          <div className="flex flex-col gap-5">
            <div className="text-center">
              <h2 className="text-[26px] font-extrabold text-slate-900 leading-tight">
                Select your budget categories
              </h2>
              <p className="text-[15px] font-medium text-slate-500 mt-1.5 max-w-sm mx-auto">
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
                        ? 'bg-[#e8f5f3] border-2 border-[#006A60] shadow-2xs'
                        : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: cat.color }}
                      />
                      <span className="material-symbols-outlined text-[20px] text-slate-700 shrink-0">
                        {cat.icon}
                      </span>
                      <span className="text-[15px] font-bold text-slate-900 truncate">
                        {cat.name}
                      </span>
                    </div>

                    {selected && (
                      <span className="material-symbols-outlined text-[#006A60] text-[20px] shrink-0 ml-1">
                        check_circle
                      </span>
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
                className="flex flex-col gap-2.5 p-3 bg-white border border-slate-200 rounded-2xl"
              >
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customCatName}
                    onChange={(e) => setCustomCatName(e.target.value)}
                    placeholder="Category Name (e.g. Gym)"
                    className="flex-1 px-3 py-2 text-[14px] font-bold text-slate-900 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-[#006A60]"
                    autoFocus
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 bg-[#006A60] text-white font-bold rounded-xl text-[13px] hover:bg-[#00544c] cursor-pointer shrink-0"
                  >
                    Add
                  </button>
                </div>
                <div className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">Pick an Icon</span>
                  <div className="grid grid-cols-8 gap-1">
                    {CUSTOM_ICONS.map((ic) => (
                      <button
                        key={ic}
                        type="button"
                        onClick={() => setCustomCatIcon(ic)}
                        className={`p-1.5 rounded-lg flex items-center justify-center transition-colors ${
                          customCatIcon === ic
                            ? 'bg-[#006A60] text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[18px]">{ic}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setShowAddCustom(true)}
                className="text-[#006A60] font-bold text-[15px] hover:underline flex items-center justify-center gap-1 my-1 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">add</span>
                <span>Add Custom Category</span>
              </button>
            )}

            <div className="flex flex-col gap-2.5 mt-2">
              <button
                type="button"
                onClick={() => setStep(3)}
                className="w-full py-4 bg-[#006A60] hover:bg-[#00544c] active:scale-[0.99] text-white font-bold rounded-2xl text-[16px] transition-all shadow-xs cursor-pointer"
              >
                Continue
              </button>
              <button
                type="button"
                onClick={() => setStep(3)}
                className="text-slate-500 font-semibold text-[14px] hover:text-slate-800 transition-all text-center py-1 cursor-pointer"
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
              <h2 className="text-[26px] font-extrabold text-slate-900 leading-tight">
                Add your monthly bills
              </h2>
              <p className="text-[15px] font-medium text-slate-500 mt-1.5 max-w-sm mx-auto">
                Enter recurring expenses like rent, utilities, and subscriptions.
              </p>
            </div>

            {/* Bill Input Card */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleAddBill();
              }}
              className="bg-[#f8faf9] p-4 sm:p-5 rounded-[24px] border border-slate-200 flex flex-col gap-3"
            >
              <div className="flex flex-col gap-1">
                <label className="text-[13px] font-bold text-slate-700">Bill Name</label>
                <input
                  type="text"
                  value={newBillName}
                  onChange={(e) => setNewBillName(e.target.value)}
                  placeholder="e.g. Rent, Netflix, Electricity"
                  className="p-3 bg-white border border-slate-200 rounded-xl text-[14px] font-medium text-slate-900 outline-none focus:border-[#006A60]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="flex flex-col gap-1">
                  <label className="text-[13px] font-bold text-slate-700">Amount</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={newBillAmount}
                    onChange={(e) => setNewBillAmount(e.target.value)}
                    placeholder={`${symbol} 0.00`}
                    className="p-3 bg-white border border-slate-200 rounded-xl text-[14px] font-mono font-bold text-slate-900 outline-none focus:border-[#006A60]"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[13px] font-bold text-slate-700">Category</label>
                  <select
                    value={newBillCategory}
                    onChange={(e) => setNewBillCategory(e.target.value)}
                    className="p-3 bg-white border border-slate-200 rounded-xl text-[14px] font-medium text-slate-900 outline-none focus:border-[#006A60] cursor-pointer"
                  >
                    <option value="Housing">Housing / Rent</option>
                    <option value="Utilities">Utilities</option>
                    <option value="Internet & Phone">Internet & Phone</option>
                    <option value="Subscriptions">Subscriptions</option>
                    <option value="Insurance">Insurance</option>
                    <option value="Transport">Transport / Fuel</option>
                    <option value="Food & Groceries">Food & Groceries</option>
                    <option value="Health">Health / Medical</option>
                    <option value="Education">Education</option>
                    <option value="Childcare">Childcare</option>
                    <option value="Entertainment">Entertainment</option>
                    <option value="Loans">Loans / Debt</option>
                    <option value="Savings">Savings / Investment</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-[#e6f2f0] hover:bg-[#d0ece8] text-[#006A60] font-bold rounded-xl text-[14px] flex items-center justify-center gap-1 transition-all mt-1 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">add</span>
                <span>Add Bill</span>
              </button>
            </form>

            {/* Added Bills List */}
            {bills.length > 0 && (
              <div className="flex flex-col gap-2">
                <h3 className="text-[17px] font-extrabold text-slate-900">Added Bills</h3>
                <div className="flex flex-col gap-2 max-h-[180px] overflow-y-auto">
                  {bills.map((b, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 bg-white border border-slate-200 rounded-2xl flex justify-between items-center"
                    >
                      <div className="flex items-center gap-3">
                        {(() => {
                          const billIconMap: Record<string, { icon: string; bg: string; text: string }> = {
                            'Housing': { icon: 'home', bg: 'bg-amber-100', text: 'text-amber-700' },
                            'Utilities': { icon: 'bolt', bg: 'bg-yellow-100', text: 'text-yellow-700' },
                            'Internet & Phone': { icon: 'wifi', bg: 'bg-blue-100', text: 'text-blue-700' },
                            'Subscriptions': { icon: 'subscriptions', bg: 'bg-purple-100', text: 'text-purple-700' },
                            'Insurance': { icon: 'shield', bg: 'bg-slate-100', text: 'text-slate-700' },
                            'Transport': { icon: 'directions_car', bg: 'bg-cyan-100', text: 'text-cyan-700' },
                            'Food & Groceries': { icon: 'restaurant', bg: 'bg-orange-100', text: 'text-orange-700' },
                            'Health': { icon: 'favorite', bg: 'bg-red-100', text: 'text-red-700' },
                            'Education': { icon: 'school', bg: 'bg-indigo-100', text: 'text-indigo-700' },
                            'Childcare': { icon: 'child_care', bg: 'bg-pink-100', text: 'text-pink-700' },
                            'Entertainment': { icon: 'sports_esports', bg: 'bg-emerald-100', text: 'text-emerald-700' },
                            'Loans': { icon: 'account_balance', bg: 'bg-rose-100', text: 'text-rose-700' },
                            'Savings': { icon: 'savings', bg: 'bg-teal-100', text: 'text-teal-700' },
                            'Other': { icon: 'category', bg: 'bg-gray-100', text: 'text-gray-700' },
                          };
                          const m = billIconMap[b.category] || billIconMap['Other'];
                          return (
                            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${m.bg} ${m.text}`}>
                              <span className="material-symbols-outlined text-[20px]">{m.icon}</span>
                            </div>
                          );
                        })()}
                        <div className="flex flex-col">
                          <span className="text-[15px] font-bold text-slate-900">{b.name}</span>
                          <span className="text-[12px] font-medium text-slate-500">
                            • {b.category}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="font-mono font-extrabold text-slate-900 text-[15px]">
                          {format(b.amount)}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveBill(idx)}
                          className="text-slate-400 hover:text-red-500 p-1 cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[18px]">close</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Total Fixed Bills summary card */}
                <div className="p-4 bg-[#f8faf9] border border-slate-200 rounded-2xl flex justify-between items-center mt-1">
                  <span className="text-[15px] font-bold text-slate-700">Total Fixed Bills</span>
                  <span className="text-[18px] font-extrabold text-slate-900 font-mono">
                    {format(totalBills)}
                  </span>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between gap-3 mt-2">
              <button
                type="button"
                onClick={() => setStep(4)}
                className="text-slate-500 font-semibold text-[14px] hover:text-slate-800 transition-all px-4 py-3 cursor-pointer"
              >
                Skip for now
              </button>
              <button
                type="button"
                onClick={handleStep3Continue}
                className="flex-1 py-4 bg-[#006A60] hover:bg-[#00544c] active:scale-[0.99] text-white font-bold rounded-2xl text-[16px] transition-all shadow-xs cursor-pointer"
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
              <h2 className="text-[26px] font-extrabold text-slate-900 leading-tight">
                Choose your strategy
              </h2>
              <p className="text-[15px] font-medium text-slate-500 mt-1.5 max-w-sm mx-auto">
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
                        ? 'border-2 border-[#006A60] bg-[#e8f5f3]/30 shadow-2xs'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-[17px] font-extrabold text-slate-900">{strat.name}</h3>
                        <p className="text-[13px] font-medium text-slate-500 mt-0.5 leading-snug">
                          {strat.description}
                        </p>
                      </div>

                      {/* Custom Radio Button */}
                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${
                          selected ? 'border-[#006A60] bg-[#006A60]' : 'border-slate-300'
                        }`}
                      >
                        {selected && <div className="w-2 h-2 rounded-full bg-white" />}
                      </div>
                    </div>

                    {/* Segmented Bar Visual */}
                    {strat.id === '50-30-20' && (
                      <div className="flex flex-col gap-1.5 pt-1">
                        <div className="w-full h-2.5 rounded-full overflow-hidden flex bg-slate-100">
                          <div className="h-full bg-[#006A60]" style={{ width: '50%' }} />
                          <div className="h-full bg-[#9a3412]" style={{ width: '30%' }} />
                          <div className="h-full bg-[#cbd5e1]" style={{ width: '20%' }} />
                        </div>
                        <div className="flex justify-between text-[11px] font-extrabold uppercase text-slate-500">
                          <span>Needs</span>
                          <span>Wants</span>
                          <span>Save</span>
                        </div>
                      </div>
                    )}

                    {strat.id === 'zero-based' && (
                      <div className="flex flex-col gap-1.5 pt-1">
                        <div className="w-full h-2.5 rounded-full overflow-hidden flex gap-1">
                          <div className="h-full flex-1 bg-[#006A60] rounded-sm" />
                          <div className="h-full flex-1 bg-[#006A60] rounded-sm" />
                          <div className="h-full flex-1 bg-[#006A60] rounded-sm" />
                          <div className="h-full flex-1 bg-[#006A60] rounded-sm" />
                        </div>
                        <span className="text-[12px] font-bold text-slate-600 text-center">
                          Every dollar allocated ({format(0)} left)
                        </span>
                      </div>
                    )}

                    {strat.id === 'envelope' && (
                      <div className="flex gap-2 pt-1">
                        <div className="flex-1 py-1 bg-[#e8f5f3] rounded-lg border border-[#006A60]/20 text-center text-[11px] font-bold text-[#006A60]">
                          Needs
                        </div>
                        <div className="flex-1 py-1 bg-amber-50 rounded-lg border border-amber-200 text-center text-[11px] font-bold text-amber-800">
                          Wants
                        </div>
                        <div className="flex-1 py-1 bg-slate-100 rounded-lg border border-slate-200 text-center text-[11px] font-bold text-slate-700">
                          Savings
                        </div>
                      </div>
                    )}

                    {strat.id === 'pay-first' && (
                      <div className="flex flex-col gap-1 pt-1">
                        <div className="w-full h-2.5 rounded-full overflow-hidden flex bg-slate-100">
                          <div className="h-full bg-[#006A60]" style={{ width: '30%' }} />
                          <div className="h-full bg-slate-200" style={{ width: '70%' }} />
                        </div>
                        <div className="flex justify-between text-[11px] font-bold text-slate-500">
                          <span className="text-[#006A60]">Save First</span>
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
              className="w-full py-4 bg-[#006A60] hover:bg-[#00544c] active:scale-[0.99] text-white font-bold rounded-2xl text-[16px] transition-all shadow-xs mt-2 cursor-pointer"
            >
              Continue
            </button>
          </div>
        )}

        {/* STEP 5: Budget Overview */}
        {step === 5 && (
          <div className="flex flex-col gap-5">
            <div className="text-center">
              <h2 className="text-[26px] font-extrabold text-slate-900 leading-tight">
                Your Budget Overview
              </h2>
              <p className="text-[15px] font-medium text-slate-500 mt-1.5 max-w-sm mx-auto">
                Here is your calculated monthly plan based on the {STRATEGIES[selectedStrategy].name}.
              </p>
            </div>

            {/* Donut Chart Card */}
            <div className="bg-white p-6 rounded-[28px] border border-slate-200/90 shadow-2xs flex flex-col items-center gap-5">
              <div className="relative w-52 h-52 flex items-center justify-center">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                  <circle
                    cx="50"
                    cy="50"
                    r="38"
                    fill="none"
                    stroke="#e2e8f0"
                    strokeWidth="10"
                  />
                  {/* Needs Arc (50%) */}
                  <circle
                    cx="50"
                    cy="50"
                    r="38"
                    fill="none"
                    stroke="#006A60"
                    strokeWidth="10"
                    strokeDasharray="119.38 238.76"
                    strokeDashoffset="0"
                  />
                  {/* Wants Arc (30%) */}
                  <circle
                    cx="50"
                    cy="50"
                    r="38"
                    fill="none"
                    stroke="#9a3412"
                    strokeWidth="10"
                    strokeDasharray="71.63 238.76"
                    strokeDashoffset="-119.38"
                  />
                  {/* Savings Arc (20%) */}
                  <circle
                    cx="50"
                    cy="50"
                    r="38"
                    fill="none"
                    stroke="#475569"
                    strokeWidth="10"
                    strokeDasharray="47.75 238.76"
                    strokeDashoffset="-191.01"
                  />
                </svg>

                <div className="absolute flex flex-col items-center text-center px-2">
                  <span className="text-[10px] font-extrabold tracking-wider text-slate-400 uppercase">
                    MONTHLY
                  </span>
                  <span className="text-[18px] font-extrabold text-slate-900 font-mono leading-tight max-w-full truncate">
                    {format(parsedIncome)}
                  </span>
                </div>
              </div>

              {/* Envelope Items */}
              <div className="w-full flex flex-col gap-2.5">
                <div className="p-3.5 bg-[#f8faf9] rounded-2xl border border-slate-100 flex justify-between items-center">
                  <div className="flex items-center gap-2.5">
                    <span className="w-3 h-3 rounded-full bg-[#006A60]" />
                    <div className="flex flex-col">
                      <span className="text-[14px] font-bold text-slate-900">Fixed Needs</span>
                      <span className="text-[12px] font-medium text-slate-500">
                        {Math.round(STRATEGIES[selectedStrategy].needsRatio * 100)}% of income
                      </span>
                    </div>
                  </div>
                  <span className="text-[16px] font-extrabold font-mono text-slate-900">
                    {format(envelopes.needs)}
                  </span>
                </div>

                <div className="p-3.5 bg-[#f8faf9] rounded-2xl border border-slate-100 flex justify-between items-center">
                  <div className="flex items-center gap-2.5">
                    <span className="w-3 h-3 rounded-full bg-[#9a3412]" />
                    <div className="flex flex-col">
                      <span className="text-[14px] font-bold text-slate-900">Variable Wants</span>
                      <span className="text-[12px] font-medium text-slate-500">
                        {Math.round(STRATEGIES[selectedStrategy].wantsRatio * 100)}% of income
                      </span>
                    </div>
                  </div>
                  <span className="text-[16px] font-extrabold font-mono text-slate-900">
                    {format(envelopes.wants)}
                  </span>
                </div>

                <div className="p-3.5 bg-[#f8faf9] rounded-2xl border border-slate-100 flex justify-between items-center">
                  <div className="flex items-center gap-2.5">
                    <span className="w-3 h-3 rounded-full bg-[#475569]" />
                    <div className="flex flex-col">
                      <span className="text-[14px] font-bold text-slate-900">Future Savings</span>
                      <span className="text-[12px] font-medium text-slate-500">
                        {Math.round(STRATEGIES[selectedStrategy].savingsRatio * 100)}% of income
                      </span>
                    </div>
                  </div>
                  <span className="text-[16px] font-extrabold font-mono text-[#006A60]">
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
                className="w-full py-4 bg-[#006A60] hover:bg-[#00544c] active:scale-[0.99] text-white font-bold rounded-2xl text-[16px] flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer disabled:opacity-50"
              >
                <span>{isCompleting ? 'Finishing setup...' : 'Confirm & Finish'}</span>
                {!isCompleting && (
                  <span className="material-symbols-outlined text-[20px]">check_circle</span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setStep(4)}
                disabled={isCompleting}
                className="text-[#006A60] font-bold text-[14px] hover:underline text-center py-1 cursor-pointer"
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
