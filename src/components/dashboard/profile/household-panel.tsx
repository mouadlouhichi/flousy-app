'use client';

import { useEffect, useState } from 'react';
import { AppIcon } from '@/components/ui/app-icon';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { useAuth } from '@/lib/auth-context';
import { useCurrency } from '@/lib/currency-context';
import { isProUser } from '@/lib/pro-features';
import { useHousehold, type InviteRole } from '@/lib/household-context';
import { useLanguage } from '@/lib/i18n-context';
import type { Messages } from '@/lib/i18n-core';
import { localizeHouseholdRole } from '@/lib/localized-labels';
import { fixedPaidAmount, type MonthBudget } from '@/lib/store';
import { isAssignableMemberRole, type HouseholdMember } from '@/lib/household';
import { TOOL_AREA } from '@/lib/household-rbac';
import { AreaRestricted } from '../area-restricted';

interface HouseholdPanelProps {
  onOpenPro?: () => void;
  month?: MonthBudget;
  initialInviteCode?: string;
}

/** Household setup, invitations, access and shared contribution visibility. */
export function HouseholdPanel({
  onOpenPro,
  month,
  initialInviteCode,
}: HouseholdPanelProps) {
  const { profile, user } = useAuth();
  const { format } = useCurrency();
  const { messages: m, t, language } = useLanguage();
  const h = m.household;
  const isPro = isProUser(profile);
  const { household, members, isOwner, renameHousehold, create, invite, acceptInvite, updateMember, canViewArea, workspace } =
    useHousehold();
  // The roster, per-member contribution totals and the invite form are all
  // `members` data. Someone with an invitation code still has no membership
  // row (personal workspace), so the join form below stays reachable.
  const canSeeMembers = canViewArea(TOOL_AREA.household);
  // Household management is a Pro feature. A free user in their personal
  // workspace must not reach the create form, member roster or invitations just
  // by opening this page — switching workspace leaves `activeHouseholdId` set,
  // which is what used to keep the household document loaded here.
  const canManageHousehold = isPro || workspace === 'household';
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [memberName, setMemberName] = useState('');
  const [role, setRole] = useState<InviteRole>('contributor');
  const [code, setCode] = useState(initialInviteCode || '');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [lastInviteCode, setLastInviteCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameDraft, setRenameDraft] = useState('');

  const submitRename = async () => {
    setBusy(true);
    try {
      await renameHousehold(renameDraft);
      setRenameOpen(false);
      setNotice(h.renameSaved);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : h.genericError);
    } finally {
      setBusy(false);
    }
  };

  const [editingMember, setEditingMember] = useState<HouseholdMember | null>(null);

  const saveMember = async (updated: HouseholdMember) => {
    setBusy(true);
    try {
      await updateMember(updated);
      setEditingMember(null);
      setNotice(h.memberUpdated);
    } catch {
      setNotice(h.genericError);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (initialInviteCode) setCode(initialInviteCode);
  }, [initialInviteCode]);

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
      total:
        (month?.variableExpenses || [])
          .filter((expense) => expense.payerMemberId === member.id)
          .reduce((sum, expense) => sum + expense.amount, 0)
        + (month?.fixedExpenses || [])
          .filter((expense) => expense.payerMemberId === member.id)
          .reduce((sum, expense) => sum + fixedPaidAmount(expense), 0),
    }));
  const paidTotal = contributions.reduce((sum, item) => sum + item.total, 0);
  const equalShare = contributions.length ? paidTotal / contributions.length : 0;
  const roleOptions = [
    { value: 'contributor', label: h.contributor },
    { value: 'editor', label: h.fullAccess },
    { value: 'viewer', label: h.viewOnly },
  ];
  const memberStatus = (status: string) => {
    if (status === 'active') return m.common.active;
    if (status === 'inactive') return m.common.inactive;
    if (status === 'invited') return h.invited;
    return status;
  };

  // An invitation link (?invite=CODE) is the one exception: that is how a
  // member who is not Pro themselves joins somebody else's household.
  if (!canManageHousehold && !initialInviteCode) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-outline-variant bg-surface-container p-8 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-variant text-on-surface-variant">
          <AppIcon name="inventory_2" className="text-[22px]" />
        </span>
        <p className="text-sm font-bold text-on-surface">{h.title}</p>
        <p className="max-w-sm text-xs text-on-surface-variant">{h.createDescription}</p>
        <button
          type="button"
          onClick={onOpenPro}
          className="mt-1 w-full max-w-xs rounded-xl bg-primary py-3 font-bold text-on-primary"
        >
          {h.unlockWithPro}
        </button>
      </div>
    );
  }

  return (
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
        ) : !canSeeMembers ? (
          <AreaRestricted area={TOOL_AREA.household} icon="family_restroom" />
        ) : (
          <>
            <div className="rounded-xl bg-primary/10 p-4">
              {renameOpen ? (
                <form
                  className="flex items-center gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void submitRename();
                  }}
                >
                  <input
                    value={renameDraft}
                    onChange={(event) => setRenameDraft(event.target.value)}
                    maxLength={100}
                    autoFocus
                    aria-label={h.renameHousehold}
                    placeholder={h.householdNamePlaceholder}
                    className="min-w-0 flex-1 rounded-lg border border-outline-variant bg-surface p-2 text-sm text-on-surface"
                  />
                  <button
                    type="submit"
                    disabled={busy}
                    className="rounded-lg bg-primary px-3 py-2 text-sm font-bold text-on-primary disabled:opacity-50"
                  >
                    {m.common.save}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setRenameOpen(false)}
                    className="rounded-lg px-2 py-2 text-sm text-on-surface-variant hover:bg-primary/10"
                  >
                    {m.common.cancel}
                  </button>
                </form>
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <p className="font-bold text-on-surface">{household.name}</p>
                  {isOwner && (
                    <button
                      type="button"
                      onClick={() => {
                        setRenameDraft(household.name);
                        setRenameOpen(true);
                      }}
                      aria-label={h.renameHousehold}
                      className="rounded-lg p-1.5 text-primary transition-colors hover:bg-primary/10"
                    >
                      <AppIcon name="edit" className="text-[18px]" />
                    </button>
                  )}
                </div>
              )}
              <p className="text-sm text-on-surface-variant">
                {t(h.activeMembers, { count: members.filter((member) => member.status === 'active').length })}{' '}
                · {h.sharedBudgetLive}
              </p>
            </div>

            <div className="space-y-2">
              {members.map((member) =>
                editingMember?.id === member.id ? (
                  <MemberEditor
                    key={member.id}
                    member={member}
                    m={m}
                    h={h}
                    onSave={saveMember}
                    onCancel={() => setEditingMember(null)}
                  />
                ) : (
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
                    <>
                      {member.role !== 'profile' && (
                        <button
                          type="button"
                          onClick={() => setEditingMember(member)}
                          aria-label={h.editMember}
                          className="rounded-lg p-1.5 text-primary transition-colors hover:bg-primary/10"
                        >
                          <AppIcon name="edit" className="text-[18px]" />
                        </button>
                      )}
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
                    </>
                  )}
                </div>
                )
              )}
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
                        const inviteId = await invite(memberName, email, role);
                        setLastInviteCode(inviteId);
                        setCopied(false);
                        if (email && !user) {
                          // No Firebase session (demo mode, or a deployment whose
                          // config failed to load) has no ID token to present, and
                          // the endpoint refuses anonymous callers by design. Not
                          // worth a doomed round-trip and a confusing "(401)": the
                          // code below is the working path.
                          setNotice(h.inviteCodeReady);
                        } else if (email) {
                          // The endpoint mails from our own domain, so it only
                          // accepts a request that proves who is asking: without
                          // the ID token there is no sender identity to check the
                          // invitation against, and the request is refused.
                          const idToken = await user?.getIdToken().catch(() => null);
                          const response = await fetch('/api/household-invitations', {
                            method: 'POST',
                            headers: {
                              'Content-Type': 'application/json',
                              ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
                            },
                            body: JSON.stringify({ inviteId, locale: language }),
                          });
                          if (response.ok) {
                            setNotice(t(h.invitationSent, { email }));
                          } else {
                            // The invitation exists and its code works either way,
                            // so this must not read as a failed invite — but it also
                            // must not look like an email went out. The endpoint
                            // answers with a stable `code`, so the reason (missing
                            // RESEND_API_KEY on this environment, sandbox sender,
                            // expired session, rate limit) is visible where it can
                            // be acted on instead of being swallowed here.
                            const detail = await response
                              .json()
                              .catch(() => null) as { code?: string; hint?: string } | null;
                            if (detail?.code) {
                              console.warn('[household-invitations] email not sent', {
                                status: response.status,
                                code: detail.code,
                                hint: detail.hint,
                              });
                            }
                            setNotice(t(h.invitationUnavailable, { status: response.status }));
                          }
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
  );
}

/**
 * Inline owner-only editor for a member's display name and enforceable role.
 * Legacy custom members can be migrated to editor, viewer, or contributor;
 * field-level custom maps are never offered because Firestore cannot enforce
 * them on the shared month document.
 */
function MemberEditor({
  member,
  m,
  h,
  onSave,
  onCancel,
}: {
  member: HouseholdMember;
  m: Messages;
  h: Messages['household'];
  onSave: (updated: HouseholdMember) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(member.displayName);
  const [role, setRole] = useState<InviteRole>(
    isAssignableMemberRole(member.role) ? member.role : 'contributor',
  );
  const roleOptions = [
    { value: 'editor', label: h.fullAccess },
    { value: 'contributor', label: m.householdRoles.contributor },
    { value: 'viewer', label: h.viewOnly },
  ];
  return (
    <div className="space-y-3 rounded-xl border border-primary/40 bg-surface-container p-3">
      <input
        value={name}
        onChange={(event) => setName(event.target.value)}
        maxLength={60}
        aria-label={h.fullName}
        placeholder={h.fullName}
        className="w-full rounded-lg border border-outline-variant bg-surface p-2 text-sm text-on-surface"
      />
      <CustomSelect
        value={role}
        onChange={(value) => setRole(value as InviteRole)}
        options={roleOptions}
        ariaLabel={h.customAccess}
        triggerClassName="!h-10 !text-xs"
      />
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg px-3 py-2 text-sm text-on-surface-variant hover:bg-primary/10"
        >
          {m.common.cancel}
        </button>
        <button
          type="button"
          onClick={() =>
            onSave({
              ...member,
              displayName: name.trim() || member.displayName,
              role,
              permissions: undefined,
            })
          }
          className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-on-primary"
        >
          {m.common.save}
        </button>
      </div>
    </div>
  );
}
