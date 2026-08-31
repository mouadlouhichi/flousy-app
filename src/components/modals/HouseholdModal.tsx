'use client';

import { useState } from 'react';
import { Modal } from '../ui/Modal';
import { AppIcon } from '../ui/app-icon';
import { CustomSelect } from '../ui/CustomSelect';
import { useAuth } from '@/lib/auth-context';
import { useCurrency } from '@/lib/currency-context';
import { isProUser } from '@/lib/pro-features';
import { useHousehold } from '@/lib/household-context';
import { useLanguage } from '@/lib/i18n-context';
import { localizeHouseholdRole } from '@/lib/localized-labels';
import type { MonthBudget } from '@/lib/store';
import { HOUSEHOLD_AREAS, type AccessLevel, type HouseholdPermissions } from '@/lib/household-rbac';

type InviteRole = 'editor' | 'viewer' | 'custom';

interface HouseholdModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenPro?: () => void;
  month?: MonthBudget;
  initialInviteCode?: string;
}

/** Controls household setup, invitations, access and shared contribution visibility. */
export function HouseholdModal({
  isOpen,
  onClose,
  onOpenPro,
  month,
  initialInviteCode,
}: HouseholdModalProps) {
  const { profile } = useAuth();
  const { format } = useCurrency();
  const { messages: m, t, language } = useLanguage();
  const h = m.household;
  const isPro = isProUser(profile);
  const { household, members, isOwner, create, invite, acceptInvite, updateMember } = useHousehold();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [memberName, setMemberName] = useState('');
  const [role, setRole] = useState<InviteRole>('custom');
  const [permissions, setPermissions] = useState<HouseholdPermissions>({
    expenses: 'editOwn',
    invoices: 'editOwn',
  });
  const [code, setCode] = useState(initialInviteCode || '');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [lastInviteCode, setLastInviteCode] = useState('');
  const [copied, setCopied] = useState(false);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setNotice('');
    try {
      await action();
    } catch {
      // Server and Firebase failures can be technical or language-specific;
      // expose a concise catalog-backed message instead of a raw fallback.
      setNotice(h.genericError);
    } finally {
      setBusy(false);
    }
  };

  const contributions = members
    .filter((member) => member.status === 'active' && member.role !== 'profile')
    .map((member) => ({
      member,
      total: [...(month?.variableExpenses || []), ...(month?.fixedExpenses || [])]
        .filter((expense) => expense.payerMemberId === member.id)
        .reduce((sum, expense) => sum + expense.amount, 0),
    }));
  const paidTotal = contributions.reduce((sum, item) => sum + item.total, 0);
  const equalShare = contributions.length ? paidTotal / contributions.length : 0;
  const roleOptions = [
    { value: 'custom', label: h.customAccess },
    { value: 'editor', label: h.fullAccess },
    { value: 'viewer', label: h.viewOnly },
  ];
  const accessOptions = (editable?: boolean) => [
    { value: 'none', label: h.noAccess },
    { value: 'view', label: h.view },
    ...(editable
      ? [
          { value: 'editOwn', label: h.editOwn },
          { value: 'editAll', label: h.editAll },
        ]
      : []),
  ];
  const memberStatus = (status: string) => {
    if (status === 'active') return m.common.active;
    if (status === 'inactive') return m.common.inactive;
    if (status === 'invited') return h.invited;
    return status;
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={h.title} className="max-w-lg">
      <div className="space-y-5">
        {!household ? (
          <>
            <p className="text-body-sm text-on-surface-variant">{h.createDescription}</p>
            {!isPro ? (
              <button
                type="button"
                onClick={onOpenPro}
                className="w-full rounded-xl bg-primary py-3 font-bold text-on-primary"
              >
                {h.unlockWithPro}
              </button>
            ) : (
              <>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder={h.householdNamePlaceholder}
                  aria-label={h.householdNamePlaceholder}
                  className="w-full rounded-xl border border-outline-variant bg-surface p-3"
                />
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      await create(name);
                      setNotice(h.householdCreated);
                    })
                  }
                  className="w-full rounded-xl bg-primary py-3 font-bold text-on-primary disabled:opacity-50"
                >
                  {h.createHousehold}
                </button>
              </>
            )}
            <div className="border-t border-outline-variant pt-4">
              <label className="text-sm font-bold" htmlFor="household-invite-code">
                {h.invitationCode}
              </label>
              <div className="mt-2 flex gap-2">
                <input
                  id="household-invite-code"
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  placeholder={h.invitationCodePlaceholder}
                  className="min-w-0 flex-1 rounded-xl border border-outline-variant bg-surface p-3"
                />
                <button
                  type="button"
                  disabled={!code || busy}
                  onClick={() =>
                    run(async () => {
                      await acceptInvite(code);
                      setNotice(h.joined);
                    })
                  }
                  className="rounded-xl bg-primary px-4 font-bold text-on-primary disabled:opacity-50"
                >
                  {h.join}
                </button>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="rounded-xl bg-primary/10 p-4">
              <p className="font-bold text-on-surface">{household.name}</p>
              <p className="text-sm text-on-surface-variant">
                {t(h.activeMembers, { count: members.filter((member) => member.status === 'active').length })}{' '}
                · {h.sharedBudgetLive}
              </p>
            </div>

            <div className="space-y-2">
              {members.map((member) => (
                <div key={member.id} className="flex items-center gap-3 rounded-xl border border-outline-variant p-3">
                  <span
                    className="flex h-9 w-9 items-center justify-center rounded-full font-bold text-white"
                    style={{ backgroundColor: member.avatarColor }}
                    aria-hidden
                  >
                    {member.displayName[0] || '?'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{member.displayName}</p>
                    <p className="truncate text-xs text-on-surface-variant">
                      {localizeHouseholdRole(member.role, m)} · {memberStatus(member.status)}
                      {member.email ? ` · ${member.email}` : ''}
                    </p>
                  </div>
                  {isOwner && member.role !== 'owner' && (
                    <button
                      type="button"
                      onClick={() =>
                        run(() =>
                          updateMember({
                            ...member,
                            status: member.status === 'inactive' ? 'active' : 'inactive',
                          }),
                        )
                      }
                      className="text-xs font-bold text-primary"
                    >
                      {member.status === 'inactive' ? h.restore : h.remove}
                    </button>
                  )}
                </div>
              ))}
            </div>

            {contributions.length > 0 && (
              <div className="border-t border-outline-variant pt-4">
                <p className="mb-2 font-bold">{h.monthlyContributions}</p>
                <div className="space-y-2">
                  {contributions.map(({ member, total }) => {
                    const balance = total - equalShare;
                    return (
                      <div key={member.id} className="flex justify-between gap-3 rounded-lg bg-surface-container p-3 text-sm">
                        <span className="min-w-0 truncate">{member.displayName}</span>
                        <span className="shrink-0 font-semibold tabular-nums">
                          {format(total)} ·{' '}
                          <span className={balance >= 0 ? 'text-primary' : 'text-error'}>
                            {balance >= 0 ? '+' : '−'}{format(Math.abs(balance))}
                          </span>
                        </span>
                      </div>
                    );
                  })}
                </div>
                <p className="mt-2 text-xs text-on-surface-variant">{h.contributionGuide}</p>
              </div>
            )}

            {isOwner && (
              <div className="space-y-3 border-t border-outline-variant pt-4">
                <div>
                  <p className="font-bold">{h.inviteMember}</p>
                  <p className="mt-1 text-xs text-on-surface-variant">{h.inviteDescription}</p>
                </div>
                <input
                  value={memberName}
                  onChange={(event) => setMemberName(event.target.value)}
                  placeholder={h.fullName}
                  aria-label={h.fullName}
                  className="w-full rounded-xl border border-outline-variant bg-surface p-3"
                />
                <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_11rem_auto] sm:items-end">
                  <input
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    type="email"
                    placeholder={h.emailAddress}
                    aria-label={h.emailAddress}
                    className="min-w-0 rounded-xl border border-outline-variant bg-surface p-3"
                  />
                  <CustomSelect
                    value={role}
                    onChange={(value) => setRole(value as InviteRole)}
                    options={roleOptions}
                    ariaLabel={h.customAccess}
                    triggerClassName="!h-[46px]"
                  />
                  <button
                    type="button"
                    disabled={!memberName || busy}
                    onClick={() =>
                      run(async () => {
                        const inviteId = await invite(
                          memberName,
                          email,
                          role,
                          role === 'custom' ? permissions : undefined,
                        );
                        setLastInviteCode(inviteId);
                        setCopied(false);
                        if (email) {
                          const response = await fetch('/api/household-invitations', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              inviteId,
                              email,
                              householdName: household.name,
                              role,
                              locale: language,
                            }),
                          });
                          setNotice(
                            response.ok
                              ? t(h.invitationSent, { email })
                              : h.inviteCodeReady,
                          );
                        } else {
                          setNotice(h.inviteCodeReady);
                        }
                        setEmail('');
                        setMemberName('');
                      })
                    }
                    className="rounded-xl bg-primary px-3 py-3 font-bold text-on-primary disabled:opacity-50"
                  >
                    {h.send}
                  </button>
                </div>

                {lastInviteCode && (
                  <div className="rounded-xl border border-outline-variant bg-surface-container p-3 space-y-2">
                    <p className="text-xs font-bold uppercase tracking-wide text-on-surface-variant">
                      {h.invitationCode}
                    </p>
                    <div className="flex gap-2">
                      <code className="min-w-0 flex-1 truncate rounded-lg bg-surface px-3 py-2 text-sm font-semibold">
                        {lastInviteCode}
                      </code>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(lastInviteCode);
                            setCopied(true);
                          } catch {
                            setCopied(false);
                          }
                        }}
                        className="rounded-xl bg-primary px-3 py-2 text-sm font-bold text-on-primary"
                      >
                        {copied ? h.copied : h.copyCode}
                      </button>
                    </div>
                    <p className="text-xs text-on-surface-variant">{h.inviteCodeHint}</p>
                  </div>
                )}

                {role === 'custom' && (
                  <div className="rounded-xl border border-outline-variant bg-surface-container p-3">
                    <p className="mb-2 text-xs font-bold uppercase tracking-wide text-on-surface-variant">
                      {h.customAccess}
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {HOUSEHOLD_AREAS.map((area) => (
                        <div key={area.id} className="min-w-0">
                          <CustomSelect
                            value={permissions[area.id] || 'none'}
                            onChange={(value) =>
                              setPermissions((current) => ({
                                ...current,
                                [area.id]: value as AccessLevel,
                              }))
                            }
                            options={accessOptions(area.editable)}
                            label={h.areas[area.id]}
                            triggerClassName="!h-10 !text-xs"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {notice && (
          <p role="status" className="rounded-lg bg-surface-container p-3 text-sm text-on-surface">
            {notice}
          </p>
        )}
      </div>
    </Modal>
  );
}
