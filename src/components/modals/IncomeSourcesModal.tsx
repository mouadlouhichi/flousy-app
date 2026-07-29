'use client';

import { AppIcon } from '@/components/ui/app-icon';

import React, { useState, useEffect, useCallback } from 'react';
import { Modal } from '../ui/Modal';
import { MonthBudget, IncomeSource } from '../../lib/store';
import { useCurrency } from '../../lib/currency-context';

interface IncomeSourcesModalProps {
  isOpen: boolean;
  onClose: () => void;
  month: MonthBudget;
  onSaveIncomeSources: (sources: IncomeSource[], total: number) => void;
}

const CHART_COLORS = [
  '#00685f', '#3b82f6', '#8b5cf6', '#f97316',
  '#ec4899', '#ef4444', '#eab308', '#06b6d4',
  '#6366f1', '#10b981', '#b05e3d', '#84cc16',
];

export function IncomeSourcesModal({
  isOpen,
  onClose,
  month,
  onSaveIncomeSources,
}: IncomeSourcesModalProps) {
  const { format, symbol } = useCurrency();

  const [sources, setSources] = useState<IncomeSource[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // New source form
  const [newName, setNewName] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newCategory, setNewCategory] = useState('');

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSources(
        month.incomeSources && month.incomeSources.length > 0
          ? month.incomeSources
          : [{ id: 'src-1', name: 'Primary Income', amount: month.totalBudget || 15000 }]
      );
      setEditingId(null);
      setNewName('');
      setNewAmount('');
      setNewCategory('');
      setFieldErrors({});
    }
  }, [isOpen, month.totalBudget, month.incomeSources]);

  const totalCalculated = sources.reduce((acc, s) => acc + (s.amount || 0), 0);

  // ── Cancel editing ──
  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setEditName('');
    setEditAmount('');
    setFieldErrors({});
  }, []);

  // ── Start editing a source ──
  const startEdit = (src: IncomeSource) => {
    setEditingId(src.id);
    setEditName(src.name);
    setEditAmount(String(src.amount));
    setFieldErrors({});
  };

  // ── Save inline edit ──
  const saveEdit = () => {
    const trimmedName = editName.trim();
    const parsedAmount = parseFloat(editAmount);

    const errors: Record<string, string> = {};
    if (!trimmedName) errors.editName = 'Name is required';
    if (isNaN(parsedAmount) || parsedAmount <= 0) errors.editAmount = 'Enter a valid amount';
    if (parsedAmount > 1000000000) errors.editAmount = 'Amount exceeds limit';
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setSources((prev) =>
      prev.map((s) =>
        s.id === editingId
          ? { ...s, name: trimmedName, amount: parsedAmount }
          : s
      )
    );
    cancelEdit();
  };

  // ── Add new source ──
  const handleAddSource = () => {
    const trimmedName = newName.trim();
    const parsedAmount = parseFloat(newAmount);

    const errors: Record<string, string> = {};
    if (!trimmedName) errors.newName = 'Required';
    if (isNaN(parsedAmount) || parsedAmount <= 0) errors.newAmount = 'Enter a valid amount';
    if (parsedAmount > 1000000000) errors.newAmount = 'Amount exceeds limit';
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    const item: IncomeSource = {
      id: `src-${Date.now()}`,
      name: trimmedName,
      amount: parsedAmount,
      category: newCategory.trim() || undefined,
    };

    setSources((prev) => [...prev, item]);
    setNewName('');
    setNewAmount('');
    setNewCategory('');
    setFieldErrors({});
  };

  // ── Remove source ──
  const handleRemoveSource = (id: string) => {
    if (sources.length <= 1) return;
    setSources((prev) => prev.filter((s) => s.id !== id));
    if (editingId === id) cancelEdit();
  };

  // ── Save all ──
  const handleSave = () => {
    // If currently editing, save that first
    if (editingId) saveEdit();
    onSaveIncomeSources(sources, totalCalculated);
    onClose();
  };

  // ── Quick amount chips for new source ──
  const quickAmounts = [5000, 10000, 15000, 20000];

  // ── Key handler ──
  const handleKeyDown = (e: React.KeyboardEvent, action: () => void) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      action();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Income Sources">
      <div className="flex flex-col gap-5">
        {/* ── Description ── */}
        <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
          Specify all streams of income contributing to this month's budget.
          Edit each source inline or add new ones below.
        </p>

        {/* ── Total Income Summary Card ── */}
        <div className="p-4 sm:p-5 bg-gradient-to-br from-primary/5 via-primary/5 to-primary/10 rounded-2xl border border-primary/20 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-extrabold tracking-wider text-on-surface-variant uppercase">
              Combined Total Income
            </span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-[28px] sm:text-[32px] font-extrabold text-on-surface font-mono tracking-tight">
                {totalCalculated.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className="text-[14px] font-bold text-on-surface-variant">{symbol}</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <AppIcon name="payments" className=" text-primary text-[24px]" />
          </div>
        </div>

        {/* ── Sources List ── */}
        <div className="flex flex-col gap-2 max-h-64 overflow-y-auto pr-1">
          <span className="text-[11px] font-extrabold tracking-wider text-on-surface-variant uppercase">
            INCOME STREAMS ({sources.length})
          </span>

          {sources.length === 0 ? (
            <div className="p-6 bg-surface-container/40 rounded-2xl border border-dashed border-outline-variant flex flex-col items-center text-center gap-2">
              <AppIcon name="payments" className=" text-outline text-[32px]" />
              <p className="font-body-sm text-body-sm text-on-surface-variant">No income sources yet. Add one below.</p>
            </div>
          ) : (
            sources.map((src, idx) => {
              const pct = totalCalculated > 0 ? Math.round(((src.amount || 0) / totalCalculated) * 100) : 0;
              const isEditing = editingId === src.id;
              const color = CHART_COLORS[idx % CHART_COLORS.length];

              return (
                <div
                  key={src.id}
                  className={`p-3.5 rounded-2xl border transition-all ${
                    isEditing
                      ? 'border-primary bg-primary-container/10 shadow-xs'
                      : 'border-outline-variant bg-surface hover:border-primary/30 hover:shadow-xs'
                  }`}
                >
                  {isEditing ? (
                    /* ── Inline Edit Mode ── */
                    <div className="flex flex-col gap-2.5">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex flex-col gap-0.5">
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEdit(); }}
                            className="px-3 py-2 bg-surface border border-outline-variant rounded-xl text-[14px] font-bold text-on-surface focus:border-primary outline-none transition-colors"
                            autoFocus
                            placeholder="Source name"
                          />
                          {fieldErrors.editName && (
                            <p className="text-[11px] text-error font-medium">{fieldErrors.editName}</p>
                          )}
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <div className="relative">
                            <input
                              type="number"
                              step="any"
                              value={editAmount}
                              onChange={(e) => setEditAmount(e.target.value)}
                              onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEdit(); }}
                              className="w-full px-3 py-2 bg-surface border border-outline-variant rounded-xl text-[14px] font-mono font-bold text-on-surface focus:border-primary outline-none transition-colors pr-7"
                              placeholder="0"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] font-bold text-on-surface-variant">
                              {symbol}
                            </span>
                          </div>
                          {fieldErrors.editAmount && (
                            <p className="text-[11px] text-error font-medium">{fieldErrors.editAmount}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={cancelEdit}
                          className="px-3 py-1.5 text-[13px] font-bold text-on-surface-variant hover:text-on-surface hover:bg-surface-variant rounded-lg transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={saveEdit}
                          className="px-4 py-1.5 bg-primary text-on-primary text-[13px] font-bold rounded-xl hover:bg-accent-foreground transition-colors"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* ── Display Mode ── */
                    <div className="flex items-center gap-3">
                      {/* Color indicator */}
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                        style={{ backgroundColor: `${color}18` }}
                      >
                        <AppIcon name="attach_money" className="text-[18px]" style={{ color }} />
                      </div>

                      {/* Source info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[15px] text-on-surface truncate">{src.name}</span>
                          {src.category && (
                            <span className="text-[10px] font-bold text-on-surface-variant bg-surface-container px-1.5 py-0.5 rounded-full truncate max-w-[80px]">
                              {src.category}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-extrabold text-[15px] text-on-surface">
                            {format(src.amount || 0)}
                          </span>
                          <span className="text-[11px] font-bold text-on-surface-variant">{pct}% of total</span>
                        </div>
                        {/* Mini progress bar */}
                        <div className="w-full h-1 bg-surface-variant rounded-full mt-1 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${pct}%`, backgroundColor: color }}
                          />
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-0.5">
                        <button
                          type="button"
                          onClick={() => startEdit(src)}
                          className="p-1.5 text-on-surface-variant hover:text-primary hover:bg-primary/10 rounded-lg transition-all"
                          aria-label={`Edit ${src.name}`}
                        >
                          <AppIcon name="edit" className=" text-[18px]" />
                        </button>
                        {sources.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveSource(src.id)}
                            className="p-1.5 text-on-surface-variant hover:text-error hover:bg-error-container/20 rounded-lg transition-all"
                            aria-label={`Remove ${src.name}`}
                          >
                            <AppIcon name="close" className=" text-[18px]" />
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* ── Add New Source ── */}
        <div className="p-4 bg-surface-container/60 rounded-2xl border border-dashed border-outline-variant">
          <div className="flex flex-col gap-3">
            <span className="text-[11px] font-extrabold tracking-wider text-primary uppercase">
              ADD INCOME STREAM
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="flex flex-col gap-0.5">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => {
                    setNewName(e.target.value);
                    if (fieldErrors.newName) setFieldErrors((p) => ({ ...p, newName: '' }));
                  }}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleAddSource(); }}
                  placeholder="Source name"
                  className="px-3.5 py-2.5 bg-surface border border-outline-variant rounded-xl text-[14px] text-on-surface placeholder:text-outline-variant focus:border-primary outline-none transition-colors"
                />
                {fieldErrors.newName && (
                  <p className="text-[11px] text-error font-medium">{fieldErrors.newName}</p>
                )}
              </div>

              <div className="flex flex-col gap-0.5">
                <div className="relative">
                  <input
                    type="number"
                    step="any"
                    value={newAmount}
                    onChange={(e) => {
                      setNewAmount(e.target.value);
                      if (fieldErrors.newAmount) setFieldErrors((p) => ({ ...p, newAmount: '' }));
                    }}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleAddSource(); }}
                    placeholder="0"
                    className="w-full px-3.5 py-2.5 bg-surface border border-outline-variant rounded-xl text-[14px] font-mono font-bold text-on-surface placeholder:text-outline-variant focus:border-primary outline-none transition-colors pr-8"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[13px] font-bold text-on-surface-variant">
                    {symbol}
                  </span>
                </div>
                {fieldErrors.newAmount && (
                  <p className="text-[11px] text-error font-medium">{fieldErrors.newAmount}</p>
                )}
              </div>

              <button
                type="button"
                onClick={handleAddSource}
                disabled={!newName.trim() || !newAmount}
                className="py-2.5 px-3 bg-primary text-on-primary rounded-xl font-bold text-[14px] hover:bg-accent-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-1.5"
              >
                <AppIcon name="add" className=" text-[18px]" />
                <span>Add</span>
              </button>
            </div>

            {/* Quick amount chips */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-bold text-on-surface-variant mr-0.5">Quick:</span>
              {quickAmounts.map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => {
                    setNewAmount(String(amt));
                    if (fieldErrors.newAmount) setFieldErrors((p) => ({ ...p, newAmount: '' }));
                  }}
                  className="px-2.5 py-1 bg-surface border border-outline-variant text-[12px] font-bold text-on-surface-variant hover:bg-primary/10 hover:border-primary/30 hover:text-primary rounded-lg transition-all"
                >
                  {symbol}{(amt).toLocaleString()}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Save Button ── */}
        <button
          type="button"
          onClick={handleSave}
          className="w-full py-3 sm:py-3.5 bg-primary text-on-primary rounded-xl font-bold text-[15px] shadow-md hover:bg-accent-foreground active:scale-[0.99] transition-all flex items-center justify-center gap-2"
        >
          <AppIcon name="check" className=" text-[20px]" />
          <span>Save Income Sources ({format(totalCalculated)})</span>
        </button>
      </div>
    </Modal>
  );
}
