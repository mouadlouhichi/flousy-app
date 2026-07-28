'use client';

import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { MonthBudget, IncomeSource } from '../../lib/store';
import { useCurrency } from '../../lib/currency-context';

interface IncomeSourcesModalProps {
  isOpen: boolean;
  onClose: () => void;
  month: MonthBudget;
  onSaveIncomeSources: (sources: IncomeSource[], total: number) => void;
}

export function IncomeSourcesModal({
  isOpen,
  onClose,
  month,
  onSaveIncomeSources,
}: IncomeSourcesModalProps) {
  const { format, symbol } = useCurrency();

  const [sources, setSources] = useState<IncomeSource[]>(
    month.incomeSources && month.incomeSources.length > 0
      ? month.incomeSources
      : [{ id: 'src-1', name: 'Primary Salary', amount: month.totalBudget || 15000 }]
  );

  const [newName, setNewName] = useState('');
  const [newAmount, setNewAmount] = useState('');

  const totalCalculated = sources.reduce((acc, s) => acc + (s.amount || 0), 0);

  const handleAddSource = () => {
    if (!newName.trim()) return;
    const val = parseFloat(newAmount);
    if (isNaN(val) || val <= 0) return;

    const item: IncomeSource = {
      id: `src-${Date.now()}`,
      name: newName.trim(),
      amount: val,
    };

    setSources([...sources, item]);
    setNewName('');
    setNewAmount('');
  };

  const handleRemoveSource = (id: string) => {
    if (sources.length <= 1) return;
    setSources(sources.filter((s) => s.id !== id));
  };

  const handleSave = () => {
    onSaveIncomeSources(sources, totalCalculated);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Income Sources">
      <div className="space-y-md">
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          Specify all streams of income contributing to this month's budget.
        </p>

        {/* Total Summary */}
        <div className="p-md bg-surface-container rounded-2xl border border-outline-variant flex justify-between items-center">
          <div>
            <span className="font-label-sm text-label-sm text-on-surface-variant block">Combined Total Income</span>
            <span className="font-headline-md text-headline-md font-extrabold text-primary">
              {format(totalCalculated)}
            </span>
          </div>
          <span className="material-symbols-outlined text-primary text-[36px]">payments</span>
        </div>

        {/* Sources List */}
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {sources.map((s) => (
            <div
              key={s.id}
              className="p-3 bg-surface-container-low rounded-xl border border-outline-variant flex items-center justify-between"
            >
              <div>
                <h4 className="font-label-lg text-label-lg font-bold text-on-surface">{s.name}</h4>
                <span className="font-body-sm text-body-sm text-primary font-bold">{format(s.amount)}</span>
              </div>
              {sources.length > 1 && (
                <button
                  type="button"
                  onClick={() => handleRemoveSource(s.id)}
                  className="p-1.5 text-error hover:bg-error-container/20 rounded-lg transition-colors"
                  aria-label="Remove income source"
                >
                  <span className="material-symbols-outlined text-[20px]">delete</span>
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Add New Source Form */}
        <div className="p-md bg-surface-container-high rounded-2xl space-y-sm">
          <h4 className="font-label-md text-label-md font-bold text-on-surface">Add Income Source</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-xs">
            <input
              type="text"
              placeholder="Source Name (e.g., Freelance, Rental)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="px-3 py-2 bg-surface rounded-xl border border-outline-variant text-body-sm text-on-surface focus:outline-none focus:border-primary"
            />
            <div className="relative">
              <input
                type="number"
                placeholder="Amount"
                value={newAmount}
                onChange={(e) => setNewAmount(e.target.value)}
                className="w-full px-3 py-2 bg-surface rounded-xl border border-outline-variant text-body-sm text-on-surface focus:outline-none focus:border-primary pr-8"
              />
              <span className="absolute right-3 top-2.5 font-bold text-body-sm text-on-surface-variant">
                {symbol}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleAddSource}
            disabled={!newName.trim() || !newAmount}
            className="w-full py-2 px-md bg-secondary text-on-secondary rounded-xl font-label-md text-label-md font-bold hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center gap-xs"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            <span>Add Income Stream</span>
          </button>
        </div>

        {/* Save CTA */}
        <button
          type="button"
          onClick={handleSave}
          className="w-full py-3 px-md bg-primary text-on-primary rounded-xl font-label-lg text-label-lg font-bold shadow-md hover:opacity-90 transition-all"
        >
          Save Income Sources ({format(totalCalculated)})
        </button>
      </div>
    </Modal>
  );
}
