'use client';

import { AppIcon } from '@/components/ui/app-icon';

import React, { useState, useEffect, useCallback } from 'react';
import { Modal } from '../ui/Modal';
import { MonthDayPicker } from '../ui/month-day-picker';
import { MonthBudget, IncomeSource, type LifecycleStatus, incomeReceivedAmount } from '../../lib/store';
import { CustomSelect } from '../ui/CustomSelect';
import { useCurrency } from '../../lib/currency-context';
import { getSourcePeriod } from '../../lib/utils';
import { useLanguage } from '../../lib/i18n-context';
import { formatLocalizedPercent } from '@/lib/i18n';
import { formatLocalizedDayOfMonth, localizeIncomeSourceName } from '../../lib/localized-labels';
import { useAuth } from '../../lib/auth-context';
import { useHousehold } from '../../lib/household-context';
import { isProFeatureUnlocked } from '../../lib/household';
import { isProUser } from '../../lib/pro-features';
import { useDashboard } from '../dashboard/dashboard-provider';

interface IncomeSourcesModalProps {
  isOpen: boolean;
  onClose: () => void;
  month: MonthBudget;
  /** Current budget month key (YYYY-MM), used to resolve each source's period. */
  monthKey: string;
  /** Default monthly start date from settings, pre-filled on new sources. */
  defaultPayDay?: number;
  onSaveIncomeSources: (sources: IncomeSource[], total: number) => void;
  /**
   * True when the member's household role may read income but not change it.
   * The list stays visible (that is what `income: 'view'` grants) while every
   * affordance that would write is removed.
   */
  readOnly?: boolean;
}

const CHART_COLORS = [
  '#00685f', '#3b82f6', '#8b5cf6', '#f97316',
  '#ec4899', '#ef4444', '#eab308', '#06b6d4',
  '#6366f1', '#10b981', '#b05e3d', '#84cc16',
];

/** "2026-08-25" → "Aug 25" for compact period badges. */
function formatPeriodDate(iso: string, locale: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(locale, { month: 'short', day: 'numeric' });
}

export function IncomeSourcesModal({
  isOpen,
  onClose,
  month,
  monthKey,
  defaultPayDay,
  onSaveIncomeSources,
  readOnly = false,
}: IncomeSourcesModalProps) {
  const { format, symbol } = useCurrency();
  const { messages: m, t, language, intlLocale } = useLanguage();
  const copy = m.modals.incomeSources;
  const { profile } = useAuth();
  const { workspace, household } = useHousehold();
  const { openProModal } = useDashboard();
  // Multiple income sources are a Pro capability (household members inherit
  // the owner's entitlement). Re-resolved per render so a trial that expires
  // while the modal is open cannot be outrun by a stale boolean.
  const multiSourceUnlocked = isProFeatureUnlocked(isProUser(profile), workspace, household);
  const canAddSources = multiSourceUnlocked;
  const statusOptions = [
    { value: 'planned', label: copy.statusPlanned },
    { value: 'partial', label: copy.statusPartial },
    { value: 'paid', label: copy.statusReceived },
    { value: 'skipped', label: copy.statusSkipped },
  ];
  const monthKeyRef = React.useRef(monthKey);
  monthKeyRef.current = monthKey;

  const [sources, setSources] = useState<IncomeSource[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editStatus, setEditStatus] = useState<LifecycleStatus>('paid');
  const [editReceivedAmount, setEditReceivedAmount] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // New source form
  const [newName, setNewName] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [newPayDay, setNewPayDay] = useState<number | ''>('');
  const [newStatus, setNewStatus] = useState<LifecycleStatus>('planned');
  const [newReceivedAmount, setNewReceivedAmount] = useState('');

  // Edit form
  const [editPayDay, setEditPayDay] = useState<number | ''>('');

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSources(
        month.incomeSources && month.incomeSources.length > 0
          ? month.incomeSources
          : [{
              id: 'src-1',
              name: copy.primaryIncome,
              amount: month.totalBudget || 15000,
              status: 'paid',
              receivedAmount: month.totalBudget || 15000,
              recurring: true,
            }]
      );
      setEditingId(null);
      setNewName('');
      setNewAmount('');
      setNewCategory('');
      setNewPayDay(defaultPayDay ?? '');
      setNewStatus('planned');
      setNewReceivedAmount('');
      setFieldErrors({});
    }
    // `copy.primaryIncome` only seeds a newly opened form; depending on the
    // message catalog would clear an edit in progress the moment the UI language
    // changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, month.totalBudget, month.incomeSources, defaultPayDay]);

  const totalCalculated = sources.reduce((acc, source) => acc + (source.amount || 0), 0);
  const receivedCalculated = sources.reduce((acc, source) => acc + incomeReceivedAmount(source), 0);

  // ── Cancel editing ──
  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setEditName('');
    setEditAmount('');
    setEditStatus('paid');
    setEditReceivedAmount('');
    setEditPayDay('');
    setFieldErrors({});
  }, []);

  // ── Start editing a source ──
  const startEdit = (src: IncomeSource) => {
    setEditingId(src.id);
    setEditName(src.name);
    setEditAmount(String(src.amount));
    setEditStatus(src.status || 'paid');
    setEditReceivedAmount(String(incomeReceivedAmount(src)));
    setEditPayDay(src.payDay ?? '');
    setFieldErrors({});
  };

  // ── Save inline edit ──
  const saveEdit = () => {
    const trimmedName = editName.trim();
    const parsedAmount = parseFloat(editAmount);

    const errors: Record<string, string> = {};
    if (!trimmedName) errors.editName = copy.nameRequired;
    if (isNaN(parsedAmount) || parsedAmount <= 0) errors.editAmount = copy.validAmount;
    if (parsedAmount > 1000000000) errors.editAmount = copy.amountExceedsLimit;
    const parsedReceived = editStatus === 'partial' ? parseFloat(editReceivedAmount) : editStatus === 'paid' ? parsedAmount : 0;
    if (editStatus === 'partial' && (!Number.isFinite(parsedReceived) || parsedReceived <= 0 || parsedReceived >= parsedAmount)) {
      errors.editReceivedAmount = copy.partialAmountError;
    }
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setSources((prev) =>
      prev.map((s) =>
        s.id === editingId
          ? {
              ...s,
              name: trimmedName,
              amount: parsedAmount,
              status: editStatus,
              receivedAmount: parsedReceived,
              receivedAt: parsedReceived > 0 ? s.receivedAt || new Date().toISOString() : undefined,
              recurring: s.recurring ?? true,
              templateId: s.templateId || s.id,
              payDay: editPayDay === '' ? undefined : Number(editPayDay),
            }
          : s
      )
    );
    cancelEdit();
  };

  // ── Add new source ──
  const handleAddSource = () => {
    // The first source is free; each additional one needs an active entitlement.
    if (sources.length >= 1 && !canAddSources) return;
    const trimmedName = newName.trim();
    const parsedAmount = parseFloat(newAmount);

    const errors: Record<string, string> = {};
    if (!trimmedName) errors.newName = copy.required;
    if (isNaN(parsedAmount) || parsedAmount <= 0) errors.newAmount = copy.validAmount;
    if (parsedAmount > 1000000000) errors.newAmount = copy.amountExceedsLimit;
    const parsedReceived = newStatus === 'partial' ? parseFloat(newReceivedAmount) : newStatus === 'paid' ? parsedAmount : 0;
    if (newStatus === 'partial' && (!Number.isFinite(parsedReceived) || parsedReceived <= 0 || parsedReceived >= parsedAmount)) {
      errors.newReceivedAmount = copy.partialAmountError;
    }
    if (newPayDay !== '' && (Number(newPayDay) < 1 || Number(newPayDay) > 31)) {
      errors.newPayDay = copy.dayRange;
    }
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    const item: IncomeSource = {
      id: `src-${Date.now()}`,
      name: trimmedName,
      amount: parsedAmount,
      category: newCategory.trim() || undefined,
      status: newStatus,
      receivedAmount: parsedReceived,
      receivedAt: parsedReceived > 0 ? new Date().toISOString() : undefined,
      recurring: true,
      payDay: newPayDay === '' ? undefined : Number(newPayDay),
    };

    setSources((prev) => [...prev, item]);
    setNewName('');
    setNewAmount('');
    setNewCategory('');
    setNewPayDay('');
    setNewStatus('planned');
    setNewReceivedAmount('');
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
    // The UI is read-only for viewers; this also blocks stale/programmatic calls.
    if (readOnly) return;
    // If currently editing, validate and apply the pending edit synchronously
    // so React's async state update cannot drop it when the modal closes.
    let finalSources = sources;
    if (editingId) {
      const trimmedName = editName.trim();
      const parsedAmount = parseFloat(editAmount);
      const parsedReceived = editStatus === 'partial'
        ? parseFloat(editReceivedAmount)
        : editStatus === 'paid'
          ? parsedAmount
          : 0;
      if (
        !trimmedName
        || !Number.isFinite(parsedAmount)
        || parsedAmount <= 0
        || (editStatus === 'partial' && (
          !Number.isFinite(parsedReceived) || parsedReceived <= 0 || parsedReceived >= parsedAmount
        ))
      ) {
        saveEdit();
        return;
      }
      finalSources = sources.map((source) =>
        source.id === editingId
          ? {
              ...source,
              name: trimmedName,
              amount: parsedAmount,
              status: editStatus,
              receivedAmount: parsedReceived,
              receivedAt: parsedReceived > 0 ? source.receivedAt || new Date().toISOString() : undefined,
              recurring: source.recurring ?? true,
              templateId: source.templateId || source.id,
              payDay: editPayDay === '' ? undefined : Number(editPayDay),
            }
          : source,
      );
    }
    const finalTotal = finalSources.reduce((acc, source) => acc + (source.amount || 0), 0);
    try {
      onSaveIncomeSources(finalSources, finalTotal);
      onClose();
    } catch {
      // Reclassifying previously received income can require taking cash back
      // out of the bank balance. Keep the modal open when that cash was already
      // spent instead of closing and pretending the lifecycle edit succeeded.
      setFieldErrors((previous) => ({ ...previous, form: copy.cashAdjustmentError }));
    }
  };

  // ── Quick amount chips for new source ──
  const quickAmounts = [5000, 10000, 15000, 20000];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={copy.title}>
      <div className="flex flex-col gap-5">
        {/* ── Description ── */}
        <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
          {copy.description}
        </p>

        {/* ── Total Income Summary Card ── */}
        <div className="p-4 sm:p-5 bg-gradient-to-br from-primary/5 via-primary/5 to-primary/10 rounded-2xl border border-primary/20 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-extrabold tracking-wider text-on-surface-variant uppercase">
              {copy.combinedTotal}
            </span>
            <div className="mt-1">
              <span className="text-[28px] sm:text-[32px] font-extrabold text-on-surface font-mono tracking-tight">
                {format(totalCalculated)}
              </span>
            </div>
            <p className="mt-1 text-xs font-bold text-primary">
              {t(copy.receivedSummary, { amount: format(receivedCalculated) })}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <AppIcon name="payments" className=" text-primary text-[24px]" />
          </div>
        </div>

        {/* ── Sources List ── */}
        <div className="flex flex-col gap-2 max-h-64 overflow-y-auto pe-1">
          <span className="text-[11px] font-extrabold tracking-wider text-on-surface-variant uppercase">
            {t(copy.incomeStreams, { count: new Intl.NumberFormat(intlLocale).format(sources.length) })}
          </span>

          {sources.length === 0 ? (
            <div className="p-6 bg-surface-container rounded-2xl border border-dashed border-outline-variant flex flex-col items-center text-center gap-2">
              <AppIcon name="payments" className=" text-outline text-[32px]" />
              <p className="font-body-sm text-body-sm text-on-surface-variant">{copy.noSources}</p>
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
                            className="px-3 py-2 bg-surface-container-lowest border border-outline-variant rounded-xl text-[14px] font-bold text-on-surface focus:border-primary outline-none transition-colors"
                            autoFocus
                            placeholder={copy.sourceNamePlaceholder}
                            aria-label={copy.sourceName}
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
                              className="w-full px-3 py-2 bg-surface-container-lowest border border-outline-variant rounded-xl text-[14px] font-mono font-bold text-on-surface focus:border-primary outline-none transition-colors pe-7"
                              placeholder={copy.amountPlaceholder}
                              aria-label={m.common.amount}
                            />
                            <span className="absolute end-3 top-1/2 -translate-y-1/2 text-[12px] font-bold text-on-surface-variant" aria-hidden="true">
                              {symbol}
                            </span>
                          </div>
                          {fieldErrors.editAmount && (
                            <p className="text-[11px] text-error font-medium">{fieldErrors.editAmount}</p>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <CustomSelect
                          label={copy.lifecycleStatus}
                          value={editStatus}
                          onChange={(value) => setEditStatus(value as LifecycleStatus)}
                          options={statusOptions}
                        />
                        {editStatus === 'partial' && (
                          <label className="flex flex-col gap-1 text-xs font-bold text-on-surface-variant">
                            {copy.receivedAmount}
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={editReceivedAmount}
                              onChange={(event) => setEditReceivedAmount(event.target.value)}
                              className="h-12 rounded-xl border border-outline-variant bg-surface px-3 font-mono text-on-surface outline-none focus:border-primary"
                            />
                            {fieldErrors.editReceivedAmount && <span className="text-error">{fieldErrors.editReceivedAmount}</span>}
                          </label>
                        )}
                      </div>
                      <MonthDayPicker
                        value={editPayDay === '' ? undefined : Number(editPayDay)}
                        onChange={(d) => setEditPayDay(d === undefined ? '' : d)}
                        label={copy.monthlyStartDate}
                        allowClear
                      />
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={cancelEdit}
                          className="px-3 py-1.5 text-[13px] font-bold text-on-surface-variant hover:text-on-surface hover:bg-surface-variant rounded-lg transition-colors"
                        >
                          {m.common.cancel}
                        </button>
                        <button
                          type="button"
                          onClick={saveEdit}
                          className="px-4 py-1.5 bg-primary text-on-primary text-[13px] font-bold rounded-xl hover:bg-accent-foreground transition-colors"
                        >
                          {m.common.save}
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
                          <span className="font-bold text-[15px] text-on-surface truncate">{localizeIncomeSourceName(src.name, m)}</span>
                          {src.category && (
                            <span className="text-[10px] font-bold text-on-surface-variant bg-surface-container px-1.5 py-0.5 rounded-full truncate max-w-[80px]">
                              {src.category}
                            </span>
                          )}
                          <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                            {statusOptions.find((option) => option.value === (src.status || 'paid'))?.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-extrabold text-[15px] text-on-surface">
                            {format(src.amount || 0)}
                          </span>
                          <span className="text-[11px] font-bold text-on-surface-variant">{t(copy.shareOfTotal, { pct: formatLocalizedPercent(pct, intlLocale) })}</span>
                          {incomeReceivedAmount(src) !== src.amount && (
                            <span className="text-[11px] font-bold text-primary">
                              {t(copy.receivedShort, { amount: format(incomeReceivedAmount(src)) })}
                            </span>
                          )}
                        </div>
                        {src.payDay &&
                          (() => {
                            const period = getSourcePeriod(monthKeyRef.current, src.payDay);
                            return (
                              <div className="flex flex-wrap items-center gap-1 mt-1">
                                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                                  <AppIcon name="calendar_clock" className="text-[11px]" />
                                  {t(copy.startsOn, { day: formatLocalizedDayOfMonth(src.payDay, language, intlLocale) })}
                                </span>
                                {period && (
                                  <span className="inline-flex items-center rounded-full bg-surface-variant px-2 py-0.5 text-[10px] font-bold text-on-surface-variant">
                                    {t(copy.period, { start: formatPeriodDate(period.startDate, intlLocale), end: formatPeriodDate(period.endDate, intlLocale) })}
                                  </span>
                                )}
                              </div>
                            );
                          })()}
                        {/* Mini progress bar */}
                        <div className="w-full h-1 bg-surface-variant rounded-full mt-1 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${pct}%`, backgroundColor: color }}
                          />
                        </div>
                      </div>

                      {/* Actions — only for members who may edit income */}
                      {!readOnly && (
                        <div className="flex items-center gap-0.5">
                          <button
                            type="button"
                            onClick={() => startEdit(src)}
                            className="tap-target p-1.5 text-on-surface-variant hover:text-primary hover:bg-primary/10 rounded-lg transition-all"
                            aria-label={t(copy.editSource, { name: src.name })}
                          >
                            <AppIcon name="edit" className=" text-[18px]" />
                          </button>
                          {sources.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveSource(src.id)}
                              className="tap-target p-1.5 text-on-surface-variant hover:text-error hover:bg-error-container/20 rounded-lg transition-all"
                              aria-label={t(copy.removeSource, { name: src.name })}
                            >
                              <AppIcon name="close" className=" text-[18px]" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {readOnly && (
          <p className="flex items-start gap-2 rounded-2xl border border-outline-variant bg-surface-container p-3 text-[12px] font-bold text-on-surface-variant">
            <AppIcon name="lock" className="mt-0.5 shrink-0 text-[16px]" />
            <span>{m.household.incomeReadOnly}</span>
          </p>
        )}

        {/* ── Add New Source ── */}
        {!readOnly && sources.length >= 1 && !canAddSources ? (
          <div className="p-4 bg-surface-container rounded-2xl border border-dashed border-outline-variant flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <span className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <AppIcon name="workspace_premium" className="text-[20px]" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-bold text-on-surface">{copy.multiSourceProTitle}</p>
                <p className="text-xs text-on-surface-variant">{copy.multiSourceProBody}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={openProModal}
              className="shrink-0 px-4 py-2 bg-primary text-on-primary text-xs font-bold rounded-full hover:bg-primary/90 transition-all"
            >
              {m.profile.links.pro}
            </button>
          </div>
        ) : !readOnly && (
        <div className="p-4 bg-surface-container rounded-2xl border border-dashed border-outline-variant">
          <div className="flex flex-col gap-3">
            <span className="text-[11px] font-extrabold tracking-wider text-primary uppercase">
              {copy.addIncomeStreamLabel}
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
                  placeholder={copy.sourceNamePlaceholder}
                  aria-label={copy.sourceName}
                  className="px-3.5 py-2.5 bg-surface-container-lowest border border-outline-variant rounded-xl text-[14px] text-on-surface placeholder:text-outline-variant focus:border-primary outline-none transition-colors"
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
                    placeholder={copy.amountPlaceholder}
                    aria-label={m.common.amount}
                    className="w-full px-3.5 py-2.5 bg-surface-container-lowest border border-outline-variant rounded-xl text-[14px] font-mono font-bold text-on-surface placeholder:text-outline-variant focus:border-primary outline-none transition-colors pe-8"
                  />
                  <span className="absolute end-3.5 top-1/2 -translate-y-1/2 text-[13px] font-bold text-on-surface-variant" aria-hidden="true">
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
                <span>{m.common.add}</span>
              </button>
            </div>

            {/* Quick amount chips */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-bold text-on-surface-variant me-0.5">{copy.quick}</span>
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
                  {format(amt)}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-2 border-t border-outline-variant/40 pt-3 sm:grid-cols-2">
              <CustomSelect
                label={copy.lifecycleStatus}
                value={newStatus}
                onChange={(value) => setNewStatus(value as LifecycleStatus)}
                options={statusOptions}
              />
              {newStatus === 'partial' && (
                <label className="flex flex-col gap-1 text-xs font-bold text-on-surface-variant">
                  {copy.receivedAmount}
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={newReceivedAmount}
                    onChange={(event) => setNewReceivedAmount(event.target.value)}
                    className="h-12 rounded-xl border border-outline-variant bg-surface px-3 font-mono text-on-surface outline-none focus:border-primary"
                  />
                  {fieldErrors.newReceivedAmount && <span className="text-error">{fieldErrors.newReceivedAmount}</span>}
                </label>
              )}
            </div>

            {/* Monthly start date (payday) */}
            <div className="flex flex-col gap-2 pt-1 border-t border-outline-variant/40">
              <MonthDayPicker
                value={newPayDay === '' ? undefined : Number(newPayDay)}
                onChange={(d) => {
                  setNewPayDay(d === undefined ? '' : d);
                  if (fieldErrors.newPayDay) setFieldErrors((p) => ({ ...p, newPayDay: '' }));
                }}
                label={copy.monthlyStartDate}
                hint={
                  newPayDay !== ''
                    ? t(copy.payDayHint, {
                        day: formatLocalizedDayOfMonth(Number(newPayDay), language, intlLocale),
                      })
                    : copy.payDayOptional
                }
              />
            </div>
          </div>
        </div>
        )}

        {fieldErrors.form && (
          <p role="alert" className="rounded-xl bg-error-container px-3 py-2 text-sm font-semibold text-on-error-container">
            {fieldErrors.form}
          </p>
        )}

        {/* ── Save Button ── */}
        {readOnly ? (
          <button
            type="button"
            onClick={onClose}
            className="w-full py-3 sm:py-3.5 border border-outline-variant text-on-surface-variant rounded-xl font-bold text-[15px] hover:bg-surface-variant/50 transition-all flex items-center justify-center gap-2"
          >
            <span>{m.common.close}</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSave}
            className="w-full py-3 sm:py-3.5 bg-primary text-on-primary rounded-xl font-bold text-[15px] shadow-md hover:bg-accent-foreground active:scale-[0.99] transition-all flex items-center justify-center gap-2"
          >
            <AppIcon name="check" className=" text-[20px]" />
            <span>{t(copy.saveIncomeSources, { total: format(totalCalculated) })}</span>
          </button>
        )}
      </div>
    </Modal>
  );
}
