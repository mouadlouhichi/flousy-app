'use client';

import { AppIcon } from '@/components/ui/app-icon';
import React, { useEffect, useMemo, useState } from 'react';
import { Modal } from '../ui/Modal';
import {
  STRATEGIES,
  StrategyId,
  CustomRatios,
  DEFAULT_CUSTOM_RATIOS,
  calculateEnvelopeAmounts,
  normalizeCustomRatios,
  resolveStrategy,
} from '../../lib/store';
import { useCurrency } from '../../lib/currency-context';

interface StrategySelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentStrategyId: StrategyId;
  totalBudget: number;
  /** Ratios currently saved for the custom strategy (fractions of income). */
  customRatios?: CustomRatios | null;
  onSelect: (strategyId: StrategyId, customRatios?: CustomRatios) => void;
}

const STRATEGY_ICONS: Record<string, string> = {
  '50-30-20': 'pie_chart',
  '70-20-10': 'shield',
  '80-20': 'sliders',
  'zero-based': 'grid_3x3',
  'envelope': 'mail',
  'pay-first': 'savings',
  custom: 'tune',
};

const STRATEGY_TAGS: Record<string, { label: string; color: string }> = {
  '50-30-20': { label: 'Popular', color: 'bg-primary/10 text-primary' },
  '70-20-10': { label: 'Beginner', color: 'bg-blue-50 text-blue-700' },
  '80-20': { label: 'Simple', color: 'bg-amber-50 text-amber-700' },
  'zero-based': { label: 'Detailed', color: 'bg-purple-50 text-purple-700' },
  'envelope': { label: 'Visual', color: 'bg-orange-50 text-orange-700' },
  'pay-first': { label: 'Saver', color: 'bg-emerald-50 text-emerald-700' },
  custom: { label: 'Yours', color: 'bg-primary/10 text-primary' },
};

type PercentSplit = { needs: number; wants: number; savings: number };

function toPercents(ratios?: Partial<CustomRatios> | null): PercentSplit {
  const normalized = normalizeCustomRatios(ratios ?? DEFAULT_CUSTOM_RATIOS);
  return {
    needs: Math.round(normalized.needs * 100),
    wants: Math.round(normalized.wants * 100),
    savings: Math.round(normalized.savings * 100),
  };
}

export function StrategySelectorModal({
  isOpen,
  onClose,
  currentStrategyId,
  totalBudget,
  customRatios,
  onSelect,
}: StrategySelectorModalProps) {
  const { format } = useCurrency();
  const [hoveredId, setHoveredId] = useState<StrategyId | null>(null);
  const [isCustomOpen, setIsCustomOpen] = useState(currentStrategyId === 'custom');
  const [split, setSplit] = useState<PercentSplit>(() => toPercents(customRatios));

  // Re-seed the editor whenever the modal (re)opens with saved ratios.
  useEffect(() => {
    if (isOpen) {
      setSplit(toPercents(customRatios));
      setIsCustomOpen(currentStrategyId === 'custom');
      setHoveredId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const strategies = Object.values(STRATEGIES).filter((s) => s.id !== 'custom');

  const splitTotal = split.needs + split.wants + split.savings;
  const isSplitValid = splitTotal === 100;

  const draftCustomRatios = useMemo<CustomRatios>(
    () =>
      normalizeCustomRatios({
        needs: split.needs / 100,
        wants: split.wants / 100,
        savings: split.savings / 100,
      }),
    [split],
  );

  // Preview follows the hovered card, or the custom editor while it's open.
  const previewId: StrategyId = hoveredId || (isCustomOpen ? 'custom' : currentStrategyId);
  const previewRatios = previewId === 'custom' ? draftCustomRatios : undefined;
  const previewStrategy = resolveStrategy(previewId, previewRatios);
  const preview = calculateEnvelopeAmounts(totalBudget, previewId, previewRatios);

  const handleSelect = (id: StrategyId) => {
    onSelect(id);
    onClose();
  };

  /**
   * Adjust one envelope and rebalance the others so the split always stays at
   * 100% — the remainder is taken from (or given back to) the other two
   * proportionally, which keeps the sliders usable without manual math.
   */
  const handleSliderChange = (key: keyof PercentSplit, rawValue: number) => {
    const value = Math.min(100, Math.max(0, Math.round(rawValue)));
    const others = (Object.keys(split) as (keyof PercentSplit)[]).filter((k) => k !== key);
    const remaining = 100 - value;
    const othersTotal = others.reduce((acc, k) => acc + split[k], 0);

    let first: number;
    if (othersTotal <= 0) {
      first = Math.round(remaining / 2);
    } else {
      first = Math.round((split[others[0]] / othersTotal) * remaining);
    }
    const second = remaining - first;

    setSplit({
      ...split,
      [key]: value,
      [others[0]]: first,
      [others[1]]: second,
    } as PercentSplit);
  };

  const handleSaveCustom = () => {
    if (!isSplitValid) return;
    onSelect('custom', draftCustomRatios);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Choose Budget Strategy" className="max-w-lg">
      <div className="flex flex-col gap-4">
        {/* Live Preview Banner */}
        <div className="bg-gradient-to-br from-primary/5 to-primary/10 rounded-2xl p-4 border border-primary/20">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <span className="font-label-sm text-label-sm font-bold text-on-surface-variant uppercase tracking-wider">
              Preview Allocation
            </span>
            <span className="ml-auto whitespace-nowrap font-label-md text-label-md font-extrabold text-primary font-mono">
              {format(totalBudget)}
            </span>
          </div>

          {/* Ratio Bar */}
          <div className="w-full h-3 rounded-full overflow-hidden flex bg-surface-variant/50 mb-3">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${previewStrategy.needsRatio * 100}%` }}
            />
            <div
              className="h-full bg-amber-500 transition-all duration-300"
              style={{ width: `${previewStrategy.wantsRatio * 100}%` }}
            />
            <div
              className="h-full bg-slate-600 transition-all duration-300"
              style={{ width: `${previewStrategy.savingsRatio * 100}%` }}
            />
          </div>

          {/* Keep the three allocation cards in one row. Each card is a
              flex column, so its label and amount remain vertically ordered. */}
          <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
            {[
              { label: 'Needs', value: preview.needs, color: 'bg-primary' },
              { label: 'Wants', value: preview.wants, color: 'bg-amber-500' },
              { label: 'Savings', value: preview.savings, color: 'bg-slate-600' },
            ].map(({ label, value, color }) => (
              <div
                key={label}
                className="flex min-w-0 flex-col items-start gap-0.5 rounded-lg bg-surface/45 px-2 py-1.5 sm:px-3 sm:py-2"
              >
                <div className="flex min-w-0 items-center gap-1">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${color}`} />
                  <span className="truncate text-[10px] font-bold text-on-surface-variant sm:text-[11px]">{label}</span>
                </div>
                <span title={format(value)} className="max-w-full truncate font-mono text-[10px] font-extrabold text-on-surface sm:text-[13px]">
                  {format(value)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Strategy List */}
        <div className="flex flex-col gap-2.5 max-h-[45vh] overflow-y-auto pr-1">
          {strategies.map((strat) => {
            const isSelected = strat.id === currentStrategyId;
            const isHovered = strat.id === hoveredId;
            const tag = STRATEGY_TAGS[strat.id];
            const icon = STRATEGY_ICONS[strat.id] || 'tune';
            const amounts = calculateEnvelopeAmounts(totalBudget, strat.id);

            return (
              <button
                key={strat.id}
                type="button"
                onClick={() => handleSelect(strat.id)}
                onMouseEnter={() => setHoveredId(strat.id)}
                onMouseLeave={() => setHoveredId(null)}
                className={`w-full text-left p-4 rounded-2xl border-2 transition-all cursor-pointer ${
                  isSelected
                    ? 'border-primary bg-primary/5 shadow-sm'
                    : isHovered
                    ? 'border-primary/40 bg-surface-container'
                    : 'border-outline-variant/50 bg-surface hover:bg-surface-container'
                }`}
              >
                <div className="flex flex-wrap items-start gap-3 sm:flex-nowrap">
                  {/* Icon */}
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                      isSelected
                        ? 'bg-primary text-on-primary'
                        : 'bg-surface-variant text-primary'
                    }`}
                  >
                    <AppIcon name={icon} className="text-[20px]" />
                  </div>

                  {/* Content */}
                  <div className="order-3 w-full min-w-0 sm:order-none sm:w-auto sm:flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h4 className="font-label-lg text-label-lg font-extrabold text-on-surface">
                        {strat.name}
                      </h4>
                      {tag && (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${tag.color}`}>
                          {tag.label}
                        </span>
                      )}
                    </div>
                    <p className="text-[12px] font-medium text-on-surface-variant leading-snug mb-2">
                      {strat.description}
                    </p>

                    {/* Mini Ratio Bar */}
                    <div className="w-full h-2 rounded-full overflow-hidden flex bg-surface-variant/60">
                      <div
                        className="h-full bg-primary"
                        style={{ width: `${strat.needsRatio * 100}%` }}
                      />
                      <div
                        className="h-full bg-amber-500"
                        style={{ width: `${strat.wantsRatio * 100}%` }}
                      />
                      <div
                        className="h-full bg-slate-600"
                        style={{ width: `${strat.savingsRatio * 100}%` }}
                      />
                    </div>

                    {/* All three percentage items stay in one row. Their
                        contents are flex columns to keep the amount below its
                        percentage label. */}
                    <div className="mt-1.5 grid grid-cols-3 gap-1 sm:gap-2">
                      {[
                        { label: 'Needs', percent: strat.needsRatio, value: amounts.needs },
                        { label: 'Wants', percent: strat.wantsRatio, value: amounts.wants },
                        { label: 'Savings', percent: strat.savingsRatio, value: amounts.savings },
                      ].map(({ label, percent, value }) => (
                        <span
                          key={label}
                          className="flex min-w-0 flex-col items-start gap-0.5 rounded-md bg-surface-container-low px-2 py-1.5 text-[9px] font-bold text-on-surface-variant sm:text-[10px]"
                        >
                          <span className="max-w-full truncate">
                            {label} · {Math.round(percent * 100)}%
                          </span>
                          <span title={format(value)} className="max-w-full truncate font-mono text-[9px] text-on-surface sm:text-[10px]">
                            {format(value)}
                          </span>
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Selected indicator */}
                  <div className="ml-auto mt-1 shrink-0 sm:ml-0">
                    {isSelected ? (
                      <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                        <AppIcon name="check" className="text-[14px] text-on-primary" />
                      </div>
                    ) : (
                      <div className="w-5 h-5 rounded-full border-2 border-outline-variant" />
                    )}
                  </div>
                </div>
              </button>
            );
          })}

          {/* ── Custom Strategy (definable) ── */}
          <div
            className={`w-full rounded-2xl border-2 transition-all ${
              currentStrategyId === 'custom'
                ? 'border-primary bg-primary/5 shadow-sm'
                : isCustomOpen
                ? 'border-primary/40 bg-surface-container'
                : 'border-outline-variant/50 bg-surface'
            }`}
          >
            <button
              type="button"
              onClick={() => setIsCustomOpen((open) => !open)}
              aria-expanded={isCustomOpen}
              className="w-full text-left p-4 cursor-pointer"
            >
              <div className="flex items-start gap-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                    currentStrategyId === 'custom'
                      ? 'bg-primary text-on-primary'
                      : 'bg-surface-variant text-primary'
                  }`}
                >
                  <AppIcon name="sliders" className="text-[20px]" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <h4 className="font-label-lg text-label-lg font-extrabold text-on-surface">
                      Custom Strategy
                    </h4>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                      Yours
                    </span>
                  </div>
                  <p className="text-[12px] font-medium text-on-surface-variant leading-snug mb-2">
                    Set your own Needs / Wants / Savings split.
                  </p>

                  <div className="w-full h-2 rounded-full overflow-hidden flex bg-surface-variant/60">
                    <div className="h-full bg-primary" style={{ width: `${split.needs}%` }} />
                    <div className="h-full bg-amber-500" style={{ width: `${split.wants}%` }} />
                    <div className="h-full bg-slate-600" style={{ width: `${split.savings}%` }} />
                  </div>

                  <div className="mt-1 grid grid-cols-3 gap-1">
                    <span className="flex min-w-0 flex-col text-[9px] font-bold text-on-surface-variant sm:text-[10px]">
                      <span>{split.needs}%</span>
                      <span className="truncate">Needs</span>
                    </span>
                    <span className="flex min-w-0 flex-col text-[9px] font-bold text-on-surface-variant sm:text-[10px]">
                      <span>{split.wants}%</span>
                      <span className="truncate">Wants</span>
                    </span>
                    <span className="flex min-w-0 flex-col text-[9px] font-bold text-on-surface-variant sm:text-[10px]">
                      <span>{split.savings}%</span>
                      <span className="truncate">Savings</span>
                    </span>
                  </div>
                </div>

                <div className="shrink-0 mt-1 flex items-center gap-2">
                  {currentStrategyId === 'custom' && (
                    <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                      <AppIcon name="check" className="text-[14px] text-on-primary" />
                    </div>
                  )}
                  <AppIcon
                    name="expand_more"
                    className={`text-[18px] text-on-surface-variant transition-transform ${
                      isCustomOpen ? 'rotate-180' : ''
                    }`}
                  />
                </div>
              </div>
            </button>

            {isCustomOpen && (
              <div className="px-4 pb-4 flex flex-col gap-3 border-t border-outline-variant/50 pt-3">
                {([
                  { key: 'needs' as const, label: 'Needs', color: 'accent-[var(--primary)]', dot: 'bg-primary' },
                  { key: 'wants' as const, label: 'Wants', color: 'accent-amber-500', dot: 'bg-amber-500' },
                  { key: 'savings' as const, label: 'Savings', color: 'accent-slate-600', dot: 'bg-slate-600' },
                ]).map(({ key, label, color, dot }) => (
                  <div key={key} className="flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-[12px] font-bold text-on-surface">
                        <span className={`w-2.5 h-2.5 rounded-full ${dot}`} />
                        {label}
                      </span>
                      <span className="flex items-center gap-2">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={split[key]}
                          onChange={(e) => handleSliderChange(key, Number(e.target.value))}
                          aria-label={`${label} percentage`}
                          className="w-16 rounded-lg border border-outline-variant bg-surface-container-lowest px-2 py-1 text-right font-mono text-[13px] font-bold text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                        />
                        <span className="text-[12px] font-bold text-on-surface-variant">%</span>
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={1}
                      value={split[key]}
                      onChange={(e) => handleSliderChange(key, Number(e.target.value))}
                      aria-label={`${label} slider`}
                      className={`w-full cursor-pointer ${color}`}
                    />
                    <span className="font-mono text-[11px] font-bold text-on-surface-variant">
                      {format(Math.round((totalBudget * split[key]) / 100))}
                    </span>
                  </div>
                ))}

                <div
                  className={`flex items-center justify-between rounded-xl px-3 py-2 text-[12px] font-bold ${
                    isSplitValid
                      ? 'bg-primary/10 text-primary'
                      : 'bg-error-container text-on-error-container'
                  }`}
                >
                  <span>Total allocated</span>
                  <span className="font-mono">{splitTotal}%</span>
                </div>

                {!isSplitValid && (
                  <p role="alert" className="text-[11px] font-semibold text-error">
                    Needs, Wants and Savings must add up to exactly 100%.
                  </p>
                )}

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setSplit(toPercents(DEFAULT_CUSTOM_RATIOS))}
                    className="px-3 py-2.5 rounded-xl border border-outline-variant text-[13px] font-bold text-on-surface-variant hover:bg-surface-variant/50 transition-colors cursor-pointer"
                  >
                    Reset
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveCustom}
                    disabled={!isSplitValid}
                    className="flex-1 py-2.5 rounded-xl bg-primary text-on-primary text-[13px] font-bold shadow-sm hover:bg-accent-foreground transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <AppIcon name="check" className="text-[16px]" />
                    <span>Apply Custom Split</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
