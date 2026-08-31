'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { AppIcon } from '@/components/ui/app-icon';
import { useAuth } from '@/lib/auth-context';
import { useDashboard } from '../dashboard-provider';
import { useHousehold } from '@/lib/household-context';
import { HouseholdModal } from '@/components/modals/HouseholdModal';
import { ContributorInvoiceForm } from '../contributor-invoice-form';
import { HouseholdInvoiceReview } from '../household-invoice-review';
import { useLanguage } from '@/lib/i18n-context';
import { localizeHouseholdRole } from '@/lib/localized-labels';

export function WorkspacePanel() {
  const searchParams = useSearchParams();
  const inviteCode = searchParams.get('invite') || undefined;
  const { profile } = useAuth();
  const { month, openProModal } = useDashboard();
  const { household, workspace, selectWorkspace, memberRole } = useHousehold();
  const { messages: m, t, isRTL } = useLanguage();
  const p = m.profile.workspace;
  const [householdOpen, setHouseholdOpen] = useState(false);
  useEffect(() => { if (inviteCode) setHouseholdOpen(true); }, [inviteCode]);

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-2xl border border-outline-variant bg-surface-container p-4">
        <p className="mb-3 text-xs font-bold uppercase tracking-[0.12em] text-on-surface-variant">{m.profile.groups.workspace}</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => selectWorkspace('personal')}
            className={`rounded-xl border p-3 text-start ${workspace === 'personal' ? 'border-primary bg-primary/10 text-primary' : 'border-outline-variant bg-surface text-on-surface'}`}
          >
            <span className="block font-bold">{p.mySmartJib}</span>
            <span className="text-xs text-on-surface-variant">{p.personalDashboard}</span>
          </button>
          {profile?.activeHouseholdId && (
            <button
              type="button"
              onClick={() => selectWorkspace('household')}
              className={`rounded-xl border p-3 text-start ${workspace === 'household' ? 'border-primary bg-primary/10 text-primary' : 'border-outline-variant bg-surface text-on-surface'}`}
            >
              <span className="block font-bold">{household?.name || p.householdDashboard}</span>
              <span className="text-xs text-on-surface-variant">{t(p.memberAccess, { role: memberRole ? localizeHouseholdRole(memberRole, m) : m.householdRoles.viewer })}</span>
            </button>
          )}
        </div>
      </section>

      <ContributorInvoiceForm />
      <HouseholdInvoiceReview />

      <button
        type="button"
        onClick={() => setHouseholdOpen(true)}
        className="flex items-center justify-between rounded-2xl border border-outline-variant bg-surface-container p-4 text-start transition-colors hover:bg-surface-container-high"
      >
        <span className="flex items-center gap-3">
          <AppIcon name="family_restroom" className="text-[20px] text-primary" />
          <span className="text-sm font-bold text-on-surface">{p.manageHousehold}</span>
        </span>
        <AppIcon name="chevron_right" className={`text-[18px] text-on-surface-variant ${isRTL ? 'rotate-180' : ''}`} />
      </button>

      <HouseholdModal
        isOpen={householdOpen}
        onClose={() => setHouseholdOpen(false)}
        onOpenPro={openProModal}
        month={month}
        initialInviteCode={inviteCode}
      />
    </div>
  );
}
