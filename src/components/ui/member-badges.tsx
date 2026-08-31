'use client';
import React from 'react';
import { AppIcon } from './app-icon';
import { useHousehold } from '@/lib/household-context';
import { useLanguage } from '@/lib/i18n-context';

interface MemberBadgesProps { label?: string; value: string; onChange: (id: string, label: string) => void; }
/** Pro payer selector. It uses real Household member IDs while retaining legacy labels for old personal budgets. */
export function MemberBadges({ label, value, onChange }: MemberBadgesProps) {
  const { payers } = useHousehold();
  const { messages: m } = useLanguage();
  const visibleLabel = label || m.modals.expense.householdMember;
  return <div className="flex flex-col gap-1.5">
    {visibleLabel && <label className="text-[11px] font-extrabold tracking-wider text-on-surface-variant uppercase">{visibleLabel}</label>}
    <div role="group" aria-label={visibleLabel} className="flex flex-wrap gap-2 py-0.5">
      {payers.map((member) => { const isActive = value === member.id || value === member.label;
        return <button key={member.id} type="button" aria-pressed={isActive} onClick={() => onChange(member.id, member.label)} className={`flex items-center gap-1.5 rounded-full py-1.5 ps-1.5 pe-3 text-[12px] font-semibold transition-all ${isActive ? 'bg-primary text-on-primary shadow-sm' : 'border border-outline-variant bg-surface-container-lowest text-on-surface hover:bg-surface-variant/40'}`}>
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-surface-container-highest text-[10px] font-extrabold text-on-surface-variant" style={member.color ? { backgroundColor: member.color, color: 'white' } : undefined}>{isActive ? <AppIcon name="check" className="text-[13px]" /> : member.label.charAt(0)}</span><span>{member.label}</span>
        </button>; })}
    </div>
  </div>;
}
