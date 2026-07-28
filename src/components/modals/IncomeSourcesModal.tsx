'use client';

import React, { useEffect, useState } from 'react';
import { Modal } from '../ui/Modal';
import { CustomInput } from '../ui/CustomInput';
import { MonthBudget, IncomeSource } from '../../lib/store';
import { incomeSourceSchema } from '../../lib/validation';
import { useCurrency } from '../../lib/currency-context';

interface IncomeSourcesModalProps {
  isOpen: boolean;
  onClose: () => void;
  month: MonthBudget;
  onSaveIncomeSources: (sources: IncomeSource[], total: number) => void;
}

const DEFAULT_SOURCE_NAME = 'Primary Salary';

function makeSourceId() {
  return `src-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function getInitialSources(month: MonthBudget): IncomeSource[] {
  if (month.incomeSources && month.incomeSources.length > 0) {
    return month.incomeSources;
  }
  return [{ id: makeSourceId(), name: DEFAULT_SOURCE_NAME, amount: month.totalBudget || 0 }];
}

export function IncomeSourcesModal({
  isOpen,
  onClose,
  month,
  onSaveIncomeSources,
}: IncomeSourcesModalProps) {
  const { format, symbol } = useCurrency();

  const [sources, setSources] = useState<IncomeSource[]>(() => getInitialSources(month));

  // Inline edit state for existing sources
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});

  // New source form state
  const [newName, setNewName] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [addErrors, setAddErrors] = useState<Record<string, string>>({});

  const [formError, setFormError] = useState('');

  // Re-sync local state whenever the modal is (re)opened with fresh month data
  useEffect(() => {
    if (isOpen) {
      setSources(getInitialSources(month));
      setEditingId(null);
      setEditErrors({});
      setAddErrors({});
      setNewName('');
      setNewAmount('');
      setFormError('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const totalCalculated = sources.reduce((acc, s) => acc + (s.amount || 0), 0);

  const startEditing = (source: IncomeSource) => {
    setEditingId(source.id);
    setEditName(source.name);
    setEditAmount(String(source.amount));
    setEditErrors({});
    setFormError('');
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditErrors({});
  };

  const commitEdit = () => {
    if (!editingId) return;
    const parsedAmount = parseFloat(editAmount);
    const result = incomeSourceSchema.safeParse({ name: editName, amount: parsedAmount });

    if (!result.success) {
      const errs: Record<string, string> = {};
      const issues = result.error.issues || (result.error as any).errors || [];
      issues.forEach((err: any) => {
        if (err.path[0]) errs[String(err.path[0])] = err.message;
      });
      setEditErrors(errs);
      return;
    }

    setSources((prev) =>
      prev.map((s) =>
        s.id === editingId ? { ...s, name: result.data.name, amount: result.data.amount } : s
      )
    );
    setEditingId(null);
    setEditErrors({});
  };

  const handleAddSource = () => {
    const parsedAmount = parseFloat(newAmount);
    const result = incomeSourceSchema.safeParse({ name: newName, amount: parsedAmount });

    if (!result.success) {
      const errs: Record<string, string> = {};
      const issues = result.error.issues || (result.error as any).errors || [];
      issues.forEach((err: any) => {
        if (err.path[0]) errs[String(err.path[0])] = err.message;
      });
      setAddErrors(errs);
      return;
    }

    const item: IncomeSource = {
      id: makeSourceId(),
      name: result.data.name,
      amount: result.data.amount,
    };

    setSources((prev) => [...prev, item]);
    setNewName('');
    setNewAmount('');
    setAddErrors({});
    setFormError('');
  };

  const handleRemoveSource = (id: string) => {
    if (sources.length <= 1) return;
    setSources((prev) => prev.filter((s) => s.id !== id));
    if (editingId === id) cancelEditing();
  };

  const handleSave = () => {
    if (sources.length === 0) {
      setFormError('Add at least one income source before saving.');
      return;
    }
    if (editingId) {
      // Force user to resolve any in-progress edit before saving
      commitEdit();
      return;
    }
    if (totalCalculated <= 0) {
      setFormError('Total income must be greater than zero.');
      return;
    }

    onSaveIncomeSources(sources, totalCalculated);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Income Sources">
      <div className="space-y-md">
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          Specify all streams of income contributing to this month&apos;s budget.
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
        <div className="space-y-2 max-h-72 overflow-y-auto">
          {sources.map((s) => {
            const isEditing = editingId === s.id;
            const share = totalCalculated > 0 ? Math.round(((s.amount || 0) / totalCalculated) * 100) : 0;

            if (isEditing) {
              return (
                <div
                  key={s.id}
                  className="p-3 bg-surface-container-low rounded-xl border border-primary/50 space-y-sm"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-xs">
                    <CustomInput
                      autoFocus
                      value={editName}
                      onChange={(e) => {
                        setEditName(e.target.value);
                        setEditErrors((prev) => ({ ...prev, name: '' }));
                      }}
                      placeholder="Source name"
                      error={editErrors.name}
                      className="h-10"
                    />
                    <div className="relative">
                      <input
                        type="number"
                        step="any"
                        placeholder="Amount"
                        value={editAmount}
                        onChange={(e) => {
                          setEditAmount(e.target.value);
                          setEditErrors((prev) => ({ ...prev, amount: '' }));
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            commitEdit();
                          }
                        }}
                        className={`w-full h-10 px-3 bg-surface rounded-xl border text-body-sm text-on-surface focus:outline-none pr-8 ${
                          editErrors.amount
                            ? 'border-error focus:border-error'
                            : 'border-outline-variant focus:border-primary'
                        }`}
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 font-bold text-body-sm text-on-surface-variant">
                        {symbol}
                      </span>
                    </div>
                  </div>
                  {editErrors.amount && (
                    <p role="alert" className="font-label-sm text-label-sm text-error">
                      {editErrors.amount}
                    </p>
                  )}
                  <div className="flex gap-xs justify-end">
                    <button
                      type="button"
                      onClick={cancelEditing}
                      className="px-3 py-1.5 rounded-lg text-label-sm font-bold text-on-surface-variant hover:bg-surface-variant/40 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={commitEdit}
                      className="px-3 py-1.5 rounded-lg text-label-sm font-bold bg-primary text-on-primary hover:opacity-90 transition-colors"
                    >
                      Confirm
                    </button>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={s.id}
                className="p-3 bg-surface-container-low rounded-xl border border-outline-variant"
              >
                <div className="flex items-center justify-between gap-sm">
                  <div className="min-w-0 flex-1">
                    <h4 className="font-label-lg text-label-lg font-bold text-on-surface truncate">{s.name}</h4>
                    <div className="flex items-center gap-xs">
                      <span className="font-body-sm text-body-sm text-primary font-bold">{format(s.amount)}</span>
                      <span className="font-label-sm text-label-sm text-on-surface-variant">· {share}%</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => startEditing(s)}
                      className="p-1.5 text-on-surface-variant hover:bg-surface-variant/50 hover:text-primary rounded-lg transition-colors"
                      aria-label={`Edit ${s.name}`}
                    >
                      <span className="material-symbols-outlined text-[20px]">edit</span>
                    </button>
                    {sources.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveSource(s.id)}
                        className="p-1.5 text-error hover:bg-error-container/20 rounded-lg transition-colors"
                        aria-label={`Remove ${s.name}`}
                      >
                        <span className="material-symbols-outlined text-[20px]">delete</span>
                      </button>
                    )}
                  </div>
                </div>
                {/* Share bar */}
                <div className="mt-2 h-1.5 w-full rounded-full bg-surface-variant/50 overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all"
                    style={{ width: `${share}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Add New Source Form */}
        <div className="p-md bg-surface-container-high rounded-2xl space-y-sm">
          <h4 className="font-label-md text-label-md font-bold text-on-surface">Add Income Source</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-xs">
            <div>
              <input
                type="text"
                placeholder="Source Name (e.g., Freelance, Rental)"
                value={newName}
                onChange={(e) => {
                  setNewName(e.target.value);
                  setAddErrors((prev) => ({ ...prev, name: '' }));
                }}
                className={`w-full px-3 py-2 bg-surface rounded-xl border text-body-sm text-on-surface focus:outline-none ${
                  addErrors.name ? 'border-error focus:border-error' : 'border-outline-variant focus:border-primary'
                }`}
              />
              {addErrors.name && (
                <p role="alert" className="font-label-sm text-label-sm text-error mt-1">
                  {addErrors.name}
                </p>
              )}
            </div>
            <div>
              <div className="relative">
                <input
                  type="number"
                  step="any"
                  placeholder="Amount"
                  value={newAmount}
                  onChange={(e) => {
                    setNewAmount(e.target.value);
                    setAddErrors((prev) => ({ ...prev, amount: '' }));
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddSource();
                    }
                  }}
                  className={`w-full px-3 py-2 bg-surface rounded-xl border text-body-sm text-on-surface focus:outline-none pr-8 ${
                    addErrors.amount ? 'border-error focus:border-error' : 'border-outline-variant focus:border-primary'
                  }`}
                />
                <span className="absolute right-3 top-2.5 font-bold text-body-sm text-on-surface-variant">
                  {symbol}
                </span>
              </div>
              {addErrors.amount && (
                <p role="alert" className="font-label-sm text-label-sm text-error mt-1">
                  {addErrors.amount}
                </p>
              )}
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

        {formError && (
          <p role="alert" className="font-label-sm text-label-sm text-error text-center">
            {formError}
          </p>
        )}

        {/* Save CTA */}
        <button
          type="button"
          onClick={handleSave}
          className="w-full py-2.5 sm:py-3 px-md bg-primary text-on-primary rounded-xl font-label-md sm:font-label-lg text-label-md sm:text-label-lg font-bold shadow-md hover:opacity-90 disabled:opacity-50 transition-all"
        >
          Save Income Sources ({format(totalCalculated)})
        </button>
      </div>
    </Modal>
  );
}
