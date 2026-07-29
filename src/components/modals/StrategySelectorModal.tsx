import { AppIcon } from '@/components/ui/app-icon';
import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { STRATEGIES, StrategyId, calculateEnvelopeAmounts } from '../../lib/store';
import { useCurrency } from '../../lib/currency-context';

interface StrategySelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentStrategyId: StrategyId;
  totalBudget: number;
  onSelect: (strategyId: StrategyId) => void;
}

const STRATEGY_ICONS: Record<string, string> = {
  '50-30-20': 'pie_chart',
  '70-20-10': 'shield',
  '80-20': 'sliders',
  'zero-based': 'grid_3x3',
  'envelope': 'mail',
  'pay-first': 'savings',
};

const STRATEGY_TAGS: Record<string, { label: string; color: string }> = {
  '50-30-20': { label: 'Popular', color: 'bg-primary/10 text-primary' },
  '70-20-10': { label: 'Beginner', color: 'bg-blue-50 text-blue-700' },
  '80-20': { label: 'Simple', color: 'bg-amber-50 text-amber-700' },
  'zero-based': { label: 'Detailed', color: 'bg-purple-50 text-purple-700' },
  'envelope': { label: 'Visual', color: 'bg-orange-50 text-orange-700' },
  'pay-first': { label: 'Saver', color: 'bg-emerald-50 text-emerald-700' },
};

export function StrategySelectorModal({
  isOpen,
  onClose,
  currentStrategyId,
  totalBudget,
  onSelect,
}: StrategySelectorModalProps) {
  const { format } = useCurrency();
  const [hoveredId, setHoveredId] = useState<StrategyId | null>(null);

  const strategies = Object.values(STRATEGIES).filter((s) => s.id !== 'custom');
  const previewId = hoveredId || currentStrategyId;
  const preview = calculateEnvelopeAmounts(totalBudget, previewId);

  const handleSelect = (id: StrategyId) => {
    onSelect(id);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Choose Budget Strategy" className="max-w-lg">
      <div className="flex flex-col gap-4">
        {/* Live Preview Banner */}
        <div className="bg-gradient-to-br from-primary/5 to-primary/10 rounded-2xl p-4 border border-primary/20">
          <div className="flex items-center justify-between mb-3">
            <span className="font-label-sm text-label-sm font-bold text-on-surface-variant uppercase tracking-wider">
              Preview Allocation
            </span>
            <span className="font-label-md text-label-md font-extrabold text-primary font-mono">
              {format(totalBudget)}
            </span>
          </div>

          {/* Ratio Bar */}
          <div className="w-full h-3 rounded-full overflow-hidden flex bg-surface-variant/50 mb-3">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${STRATEGIES[previewId].needsRatio * 100}%` }}
            />
            <div
              className="h-full bg-amber-500 transition-all duration-300"
              style={{ width: `${STRATEGIES[previewId].wantsRatio * 100}%` }}
            />
            <div
              className="h-full bg-slate-600 transition-all duration-300"
              style={{ width: `${STRATEGIES[previewId].savingsRatio * 100}%` }}
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-0.5">
                <span className="w-2 h-2 rounded-full bg-primary" />
                <span className="text-[11px] font-bold text-on-surface-variant">Needs</span>
              </div>
              <span className="font-mono text-[13px] font-extrabold text-on-surface">
                {format(preview.needs)}
              </span>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-0.5">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span className="text-[11px] font-bold text-on-surface-variant">Wants</span>
              </div>
              <span className="font-mono text-[13px] font-extrabold text-on-surface">
                {format(preview.wants)}
              </span>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-0.5">
                <span className="w-2 h-2 rounded-full bg-slate-600" />
                <span className="text-[11px] font-bold text-on-surface-variant">Savings</span>
              </div>
              <span className="font-mono text-[13px] font-extrabold text-on-surface">
                {format(preview.savings)}
              </span>
            </div>
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
                <div className="flex items-start gap-3">
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
                  <div className="flex-1 min-w-0">
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

                    {/* Ratio Labels */}
                    <div className="flex justify-between mt-1">
                      <span className="text-[10px] font-bold text-on-surface-variant">
                        {Math.round(strat.needsRatio * 100)}% · {format(amounts.needs)}
                      </span>
                      <span className="text-[10px] font-bold text-on-surface-variant">
                        {Math.round(strat.wantsRatio * 100)}% · {format(amounts.wants)}
                      </span>
                      <span className="text-[10px] font-bold text-on-surface-variant">
                        {Math.round(strat.savingsRatio * 100)}% · {format(amounts.savings)}
                      </span>
                    </div>
                  </div>

                  {/* Selected indicator */}
                  <div className="shrink-0 mt-1">
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
        </div>
      </div>
    </Modal>
  );
}
