'use client';

import React, { useState } from 'react';
import { MonthBudget, DebtItem, DebtType } from '../../lib/store';
import { useCurrency } from '../../lib/currency-context';

interface DebtsTabProps {
  month: MonthBudget;
  onOpenDebtModal: () => void;
}

type TabKey = 'debts' | 'credits';

export function DebtsTab({ month, onOpenDebtModal }: DebtsTabProps) {
  const { format } = useCurrency();
  const [activeTab, setActiveTab] = useState<TabKey>('debts');

  const debts = month.debts || [];
  const filtered = debts.filter((d) => d.type === (activeTab === 'debts' ? 'debt' : 'credit'));

  const openCount = filtered.filter((d) => d.status === 'open').length;
  const settledCount = filtered.filter((d) => d.status === 'settled').length;
  const totalAmount = filtered.reduce((acc, d) => acc + d.amount, 0);

  const label = activeTab === 'debts' ? 'TOTAL YOU OWE' : 'TOTAL OWED TO YOU';
  const emptyTitle = activeTab === 'debts' ? 'No debts yet' : 'No credits yet';
  const emptyDesc =
    activeTab === 'debts'
      ? 'Keep your finances clear and balanced. Add any personal loans or money you owe to stay on top of your budget.'
      : 'Track money others owe you. Add credits to keep a clear record and stay on top of repayments.';

  return (
    <div className="space-y-6 pb-24">
      {/* Tab Toggle */}
      <div className="flex bg-surface-variant/40 rounded-2xl p-1">
        <button
          type="button"
          onClick={() => setActiveTab('debts')}
          className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
            activeTab === 'debts'
              ? 'bg-primary text-on-primary shadow-sm'
              : 'text-on-surface-variant hover:text-on-surface'
          }`}
        >
          Debts (I owe)
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('credits')}
          className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
            activeTab === 'credits'
              ? 'bg-primary text-on-primary shadow-sm'
              : 'text-on-surface-variant hover:text-on-surface'
          }`}
        >
          Credits (owed to me)
        </button>
      </div>

      {/* Summary Card */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <span className="text-[11px] font-extrabold tracking-wider text-slate-500 uppercase">
            {label}
          </span>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-[44px] font-extrabold text-slate-900 leading-none">
              {filtered.length > 0 ? format(totalAmount).replace(/[^0-9.,]/g, '').trim() : '0'}
            </span>
            <span className="text-[20px] font-extrabold text-slate-400 leading-none">
              {format(totalAmount).replace(/^[\d.,\s]+/, '').trim()}
            </span>
          </div>
          <span className="text-[13px] text-slate-500 mt-1.5 block">
            {openCount} open · {settledCount} settled
          </span>
        </div>
        <button
          type="button"
          onClick={onOpenDebtModal}
          className="sm:self-start px-5 py-2.5 bg-primary text-on-primary rounded-xl font-bold text-sm flex items-center gap-1.5 hover:bg-primary/90 transition-all shadow-sm"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          Add
        </button>
      </div>

      {/* Debts List or Empty State */}
      {filtered.length > 0 ? (
        <div className="flex flex-col gap-3">
          {filtered.map((d) => (
            <div
              key={d.id}
              className="bg-white rounded-2xl border border-slate-200/80 p-4 flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                    d.status === 'settled'
                      ? 'bg-slate-100 text-slate-400'
                      : 'bg-primary/10 text-primary'
                  }`}
                >
                  <span className="material-symbols-outlined text-[20px]">
                    {d.status === 'settled' ? 'check_circle' : 'account_balance'}
                  </span>
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="font-bold text-slate-900 text-[15px] truncate">{d.name}</span>
                  <span className="text-[12px] text-slate-500">{d.date}</span>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <span
                  className={`font-extrabold font-mono text-[16px] ${
                    d.status === 'settled' ? 'text-slate-400 line-through' : 'text-slate-900'
                  }`}
                >
                  {format(d.amount)}
                </span>
                <span
                  className={`text-[11px] font-bold uppercase px-2 py-0.5 rounded-full ${
                    d.status === 'settled'
                      ? 'bg-slate-100 text-slate-500'
                      : 'bg-amber-50 text-amber-700'
                  }`}
                >
                  {d.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center text-center py-8">
          {/* Illustration */}
          <div className="w-64 h-56 mb-6 flex items-center justify-center">
            <svg viewBox="0 0 240 200" fill="none" xmlns="http://www.w3.org/2000/svg">
              {/* Background circle */}
              <ellipse cx="120" cy="180" rx="80" ry="10" fill="#e8f5f3" />
              {/* Person body */}
              <rect x="95" y="110" width="50" height="60" rx="8" fill="#006A60" />
              {/* Head */}
              <circle cx="120" cy="90" r="20" fill="#006A60" />
              {/* Hair */}
              <path d="M100 85 C100 70, 140 70, 140 85 C140 80, 100 80, 100 85" fill="#1a1a2e" />
              {/* Face */}
              <circle cx="113" cy="88" r="2" fill="white" />
              <circle cx="127" cy="88" r="2" fill="white" />
              <path d="M115 95 Q120 98 125 95" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" />
              {/* Legs */}
              <rect x="100" y="170" width="14" height="18" rx="4" fill="#1a1a2e" />
              <rect x="126" y="170" width="14" height="18" rx="4" fill="#1a1a2e" />
              {/* Arm holding coin */}
              <rect x="145" y="115" width="8" height="30" rx="4" fill="#006A60" transform="rotate(15 145 115)" />
              {/* Coin */}
              <circle cx="160" cy="110" r="18" fill="#f59e0b" />
              <text x="160" y="116" textAnchor="middle" fill="white" fontWeight="bold" fontSize="16">$</text>
              {/* Coin glow */}
              <circle cx="160" cy="110" r="22" fill="none" stroke="#f59e0b" strokeWidth="1" opacity="0.3" />
              <line x1="160" y1="82" x2="160" y2="78" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
              <line x1="175" y1="92" x2="178" y2="89" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
              <line x1="145" y1="92" x2="142" y2="89" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
              {/* Balance scale */}
              <line x1="60" y1="170" x2="60" y2="100" stroke="#006A60" strokeWidth="3" strokeLinecap="round" />
              <line x1="40" y1="100" x2="80" y2="100" stroke="#006A60" strokeWidth="3" strokeLinecap="round" />
              {/* Left pan */}
              <line x1="40" y1="100" x2="32" y2="130" stroke="#006A60" strokeWidth="2" />
              <line x1="40" y1="100" x2="48" y2="130" stroke="#006A60" strokeWidth="2" />
              <ellipse cx="40" cy="132" rx="10" ry="4" fill="#006A60" />
              {/* Left coins */}
              <rect x="34" y="124" width="6" height="6" rx="1" fill="#f59e0b" />
              <rect x="40" y="122" width="6" height="6" rx="1" fill="#f59e0b" />
              <rect x="37" y="118" width="6" height="6" rx="1" fill="#f59e0b" />
              {/* Right pan */}
              <line x1="80" y1="100" x2="72" y2="130" stroke="#006A60" strokeWidth="2" />
              <line x1="80" y1="100" x2="88" y2="130" stroke="#006A60" strokeWidth="2" />
              <ellipse cx="80" cy="132" rx="10" ry="4" fill="#006A60" />
              {/* Right coins */}
              <rect x="74" y="124" width="6" height="6" rx="1" fill="#f59e0b" />
              <rect x="80" y="122" width="6" height="6" rx="1" fill="#f59e0b" />
              <rect x="77" y="118" width="6" height="6" rx="1" fill="#f59e0b" />
            </svg>
          </div>
          <span className="text-[13px] font-extrabold tracking-wider text-[#006A60] uppercase mb-4">
            MANAGE DEBT PEACEFULLY
          </span>
          <h3 className="text-[22px] font-extrabold text-slate-900">{emptyTitle}</h3>
          <p className="text-[15px] text-slate-600 mt-2 max-w-xs leading-relaxed">
            {emptyDesc}
          </p>
        </div>
      )}
    </div>
  );
}
