'use client';

import { useCallback, useEffect, useState } from 'react';
import { AppIcon } from '@/components/ui/app-icon';
import { Modal } from '@/components/ui/Modal';
import { ChoiceChips, type ChoiceChipOption } from '@/components/ui/choice-chips';
import { AmountSymbol } from '@/components/ui/amount-symbol';
import { useLanguage } from '@/lib/i18n-context';
import { useCurrency } from '@/lib/currency-context';
import { useAuth } from '@/lib/auth-context';
import { DARAT_MAX_MEMBERS, DARAT_MIN_MEMBERS } from '@/lib/darat-firestore';
import { isLooseDaratPhone, type DaratRotation } from '@/lib/darat';
import { formatCurrency } from '@/lib/currency';
import { parseAmountInput } from '@/lib/parse-amount';
import { formatYmd } from './darat-ui';
import type { InviteSummary } from './darat-screen';

interface MemberDraft {
  /** Stable key for drag-and-drop + list rendering. */
  key: string;
  displayName: string;
  phone: string;
}

interface CreatedInvite {
  id: string;
  displayName: string;
  phone: string;
}

interface Props {
  onClose: () => void;
  /**
   * Called with the form payload. The handler is responsible for
   * writing the circle in a transaction; on success it returns the
   * generated invite summaries (UUID + phone) so the modal can
   * render share links.
   */
  onSubmit: (input: {
    name: string;
    contribution: number;
    members: MemberDraft[];
    /** Owner participates in the rotation (default true). */
    organizerParticipates: boolean;
    /** First round date (YYYY-MM-DD). */
    startDate: string;
    /** Rotation chosen at create time: random or agreed (fixed) order. */
    rotation: DaratRotation;
    /** For agreed order: memberOrder ids in payout position order. */
    fixedOrder: string[] | null;
  }) => Promise<{
    ok: boolean;
    circleId?: string;
    invites?: InviteSummary[];
    error?: string;
  }>;
}

const AMOUNT_PLACEHOLDER = '0';
const PHONE_PLACEHOLDER_FALLBACK = '+212 6 12 34 56 78';
// The cap on invitees is the membership cap minus the organizer, who is
// always implicit. Surfacing "20 max" to the user would invite the bug
// of trying to add a 20th invitee with themselves nowhere in the list.
const MAX_INVITEES = DARAT_MAX_MEMBERS - 1;

let nextMemberKey = 0;
const newMemberKey = (): string => `m_${Date.now()}_${++nextMemberKey}`;

/**
 * Create-circle modal — step 1.
 *
 * Intentionally minimal: only the three things you cannot edit as
 * easily later (name, monthly amount, member list with drag-to-reorder).
 * Frequency, rotation, first round date, and the source money place are
 * all set with sensible defaults and edited on the detail screen.
 *
 * Members are entered as name + phone. The order you set here is the
 * order they will be invited (and the order shown in the round
 * timeline if the rotation is "agreed order"). Drag the handle to
 * reorder.
 *
 * The phone number is the organizer's reference for the invitee. It
 * is **not** the join gate — the join gate is the UUID code shown
 * after the circle is created (and the share-link format
 * `<origin>/dashboard/darat?join=<code>`).
 *
 * Visual style matches the rest of SmartJib's modals: tall input rows,
 * a big centered amount, uppercase tracking-wider labels, an
 * error message below the field, and a primary submit button that
 * fills the width of the actions bar.
 */
export function DaratCreateModal({ onClose, onSubmit }: Props) {
  const { messages: m, intlLocale } = useLanguage();
  const { symbol, currency } = useCurrency();
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [members, setMembers] = useState<MemberDraft[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agreedToInvite, setAgreedToInvite] = useState(false);
  // Owner participation: when unchecked the organizer runs the circle
  // without a seat in the rotation (no member row, no rounds for them).
  // They keep owner rights and the circle stays in "my circles".
  const [organizerParticipates, setOrganizerParticipates] = useState(true);
  // First round date — defaults to a week out, same default the create
  // handler used before this field existed on the form.
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + 7);
    return d.toISOString().slice(0, 10);
  });
  // Rotation picked at create time. Bidding is intentionally not offered
  // here — a draw or an agreed order is decided on day one; an auction can
  // be switched to later from the edit screen.
  const [rotation, setRotation] = useState<DaratRotation>('random');
  // Agreed-order payout sequence (memberOrder ids: the organizer uid first
  // when participating, then the invitee phones), kept in sync with the
  // members list below and draggable when the rotation is 'fixed'.
  const [order, setOrder] = useState<string[]>([]);
  const [orderDragKey, setOrderDragKey] = useState<string | null>(null);
  const [orderDragOverKey, setOrderDragOverKey] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; amount?: string; members?: string; startDate?: string }>({});
  // The post-create summary, shown after the transaction commits.
  // When this is non-null the form is replaced by the share-links panel.
  const [created, setCreated] = useState<{ circleId: string; invites: CreatedInvite[] } | null>(null);
  // Per-invite "Copied!" toast (auto-clears after a short delay).
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Drag-and-drop state. We pass the source key through `dataTransfer`
  // rather than reading from React state in `onDrop` — closures over
  // state can see a stale value when the user drops after several
  // intermediate renders. `dragOverKey` only drives the highlight.
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);

  const numericAmount = parseAmountInput(amount) ?? 0;

  const addMember = () => {
    if (members.length >= MAX_INVITEES) return;
    setMembers((prev) => [...prev, { key: newMemberKey(), displayName: '', phone: '' }]);
    setFieldErrors((prev) => ({ ...prev, members: '' }));
  };
  const updateMember = (key: string, patch: Partial<MemberDraft>) => {
    setMembers((prev) => prev.map((m) => (m.key === key ? { ...m, ...patch } : m)));
  };
  const removeMember = (key: string) => {
    setMembers((prev) => prev.filter((m) => m.key !== key));
  };

  const moveMember = useCallback((fromKey: string, toKey: string) => {
    if (fromKey === toKey) return;
    setMembers((prev) => {
      const fromIdx = prev.findIndex((m) => m.key === fromKey);
      const toIdx = prev.findIndex((m) => m.key === toKey);
      if (fromIdx === -1 || toIdx === -1) return prev;
      const next = [...prev];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      return next;
    });
  }, []);

  // The whole card is the drag target. The handle on the left is a
  // visual affordance — the user can grab anywhere on the card.
  // Inputs must not steal the drag, so we suppress the default drag
  // start on them and rely on the card's own draggable={true}.
  const onDragStart = (key: string) => (e: React.DragEvent<HTMLDivElement>) => {
    setDragKey(key);
    e.dataTransfer.effectAllowed = 'move';
    // Required for Firefox; only the key matters, not the payload.
    e.dataTransfer.setData('text/plain', key);
  };
  const onDragOver = (key: string) => (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (key !== dragOverKey) setDragOverKey(key);
  };
  const onDrop = (key: string) => (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const fromKey = e.dataTransfer.getData('text/plain') || dragKey;
    if (fromKey) moveMember(fromKey, key);
    setDragKey(null);
    setDragOverKey(null);
  };
  const onDragEnd = () => {
    setDragKey(null);
    setDragOverKey(null);
  };
  // Inputs do not initiate a drag on the card.
  const stopDrag: React.DragEventHandler = (e) => e.preventDefault();

  // Keep the agreed-order list aligned with the members list: dropping the
  // participation checkbox or removing/adding invitees updates the order
  // (existing positions preserved, new seats appended at the end).
  useEffect(() => {
    const validIds = [
      ...(organizerParticipates && user?.uid ? [user.uid] : []),
      ...members.map((mem) => mem.phone.trim()),
    ].filter((id) => id.length > 0);
    setOrder((prev) => {
      const kept = prev.filter((id) => validIds.includes(id));
      for (const id of validIds) {
        if (!kept.includes(id)) kept.push(id);
      }
      return kept;
    });
  }, [members, organizerParticipates, user?.uid]);

  const moveOrderEntry = (fromId: string, toId: string) => {
    if (fromId === toId) return;
    setOrder((prev) => {
      const fromIdx = prev.indexOf(fromId);
      const toIdx = prev.indexOf(toId);
      if (fromIdx === -1 || toIdx === -1) return prev;
      const next = [...prev];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      return next;
    });
  };
  const onOrderDragStart = (id: string) => (e: React.DragEvent<HTMLElement>) => {
    setOrderDragKey(id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
  };
  const onOrderDragOver = (id: string) => (e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (id !== orderDragOverKey) setOrderDragOverKey(id);
  };
  const onOrderDrop = (id: string) => (e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
    const fromId = e.dataTransfer.getData('text/plain') || orderDragKey;
    if (fromId) moveOrderEntry(fromId, id);
    setOrderDragKey(null);
    setOrderDragOverKey(null);
  };
  const onOrderDragEnd = () => {
    setOrderDragKey(null);
    setOrderDragOverKey(null);
  };
  // Label per agreed-order id: the organizer's account name, or the name
  // typed on the invitee row (phone as fallback).
  const orderLabel = (id: string): string => {
    if (user?.uid && id === user.uid) {
      return user.displayName?.trim() || user.email || 'Organizer';
    }
    const row = members.find((mem) => mem.phone.trim() === id);
    return row?.displayName.trim() || id;
  };

  // Per-row validation: classify each member row so the form can show the
  // exact issue next to the field that caused it. The "duplicate" check
  // uses the same lowercased (trimmed) comparison the server's
  // `validateDaratCreate` does, so a form that passes here will not
  // bounce off the server as `duplicatePhones`.
  //
  // The organizer's own row is no longer carried in the form: there
  // is no email field any more, so there is no self-invite path. The
  // server always puts the organizer at position 0 of `memberOrder`.
  type RowError = 'nameRequired' | 'phoneFormat' | 'duplicate';
  const rowErrors = new Map<string, RowError>();
  const seenPhones = new Map<string, string>(); // normalized phone -> first row key
  const normalizePhone = (raw: string): string => raw.replace(/\D/g, '');
  for (const m of members) {
    const nameOk = m.displayName.trim().length > 0;
    if (!nameOk) {
      rowErrors.set(m.key, 'nameRequired');
      continue;
    }
    const phoneRaw = m.phone.trim();
    if (phoneRaw.length === 0) {
      rowErrors.set(m.key, 'phoneFormat');
      continue;
    }
    if (!isLooseDaratPhone(phoneRaw)) {
      rowErrors.set(m.key, 'phoneFormat');
      continue;
    }
    // Duplicate detection uses the digit-only form so cosmetic
    // separator differences (spaces, dashes, parens) do not slip
    // through as two different numbers.
    const normalized = normalizePhone(phoneRaw);
    const firstKey = seenPhones.get(normalized);
    if (firstKey) {
      rowErrors.set(m.key, 'duplicate');
      // Mark the first occurrence too so the user sees both rows.
      if (!rowErrors.has(firstKey)) rowErrors.set(firstKey, 'duplicate');
      continue;
    }
    seenPhones.set(normalized, m.key);
  }
  const hasRowErrors = rowErrors.size > 0;
  const totalMembers = (organizerParticipates ? 1 : 0) + members.length;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const next: typeof fieldErrors = {};
    if (!name.trim()) next.name = (m.darat.create.errors as Record<string, string>).nameRequired ?? m.errors.generic;
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) next.amount = (m.darat.create.errors as Record<string, string>).amountInvalid ?? m.errors.generic;
    {
      // Same rule the server applies (validateDaratCreate): YYYY-MM-DD,
      // not before today. The date input enforces the format; the floor
      // check gives the user a localized inline error instead of a
      // server bounce.
      const today = new Date().toISOString().slice(0, 10);
      if (!startDate || startDate < today) {
        next.startDate = (m.darat.create.errors as Record<string, string>).startDateInvalid ?? m.errors.generic;
      }
    }
    if (totalMembers < DARAT_MIN_MEMBERS) {
      // An owner who does not participate needs the invitees alone to
      // carry the rotation — one invitee is not a rotation.
      next.members = !organizerParticipates
        ? (m.darat.create.errors as Record<string, string>).minInviteesNoOrganizer ?? m.errors.generic
        : (m.darat.create.errors as Record<string, string>).membersTooFew ?? m.errors.generic;
    }
    if (totalMembers > DARAT_MAX_MEMBERS) next.members = (m.darat.create.errors as Record<string, string>).membersTooMany ?? m.errors.generic;
    if (hasRowErrors) next.members = (m.darat.create.errors as Record<string, string>).duplicatePhones ?? m.errors.generic;
    if (Object.keys(next).length > 0) {
      setFieldErrors(next);
      return;
    }
    setSubmitting(true);
    try {
      const invitees = members.map((m) => ({
        key: m.key,
        displayName: m.displayName.trim(),
        phone: m.phone.trim(),
      }));
      const res = await onSubmit({
        name: name.trim(),
        contribution: numericAmount,
        members: invitees,
        organizerParticipates,
        startDate,
        rotation,
        fixedOrder: rotation === 'fixed' ? order : null,
      });
      if (!res.ok) {
        setError(res.error ?? 'genericError');
        return;
      }
      // The transaction committed. Move into the post-create summary
      // and let the user copy each share link. We do not close the
      // modal — the user can still read the codes if the share
      // messages get lost.
      setCreated({
        circleId: res.circleId ?? '',
        invites: (res.invites ?? []).map((inv) => ({
          id: inv.id,
          displayName: inv.displayName,
          phone: inv.phone,
        })),
      });
    } catch (err) {
      console.error('[darat] create failed', err);
      setError('genericError');
    } finally {
      setSubmitting(false);
    }
  };

  // The share-link format: same origin, `/dashboard/darat?join=<id>`.
  // The Darat landing page reads the `join` query param and pre-fills
  // the join modal with the code, so the recipient just confirms.
  // `window.location.origin` resolves to the deployed app (preview, prod,
  // or local), so the link works wherever the organizer is browsing from.
  const buildShareLink = (inviteId: string): string => {
    if (typeof window === 'undefined') return `/dashboard/darat?join=${inviteId}`;
    return `${window.location.origin}/dashboard/darat?join=${inviteId}`;
  };

  // The automated WhatsApp invite: a ready-to-send message (name, circle,
  // amount, first round date, one-tap link + code) opened in wa.me with the
  // invitee's number when we have one, or the contact picker otherwise.
  // Nothing is sent automatically — the organizer sees the message in
  // WhatsApp and presses send, which keeps the consent promise of the
  // invite checkbox.
  const buildWhatsappMessage = (invite: CreatedInvite): string => {
    return (m.darat.create.whatsappInvite as string)
      .replace('{name}', invite.displayName)
      .replace('{circle}', name.trim() || m.darat.title)
      .replace('{amount}', formatCurrency(numericAmount, currency, intlLocale))
      .replace('{date}', formatYmd(startDate, intlLocale, { day: 'numeric', month: 'short' }))
      .replace('{link}', buildShareLink(invite.id))
      .replace('{code}', invite.id);
  };
  const openWhatsappInvite = (invite: CreatedInvite) => {
    const digits = invite.phone.replace(/\D/g, '');
    const target = digits.length >= 8 ? `https://wa.me/${digits}` : 'https://wa.me/';
    const url = `${target}?text=${encodeURIComponent(buildWhatsappMessage(invite))}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const copyInviteLink = async (inviteId: string) => {
    const link = buildShareLink(inviteId);
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(link);
      } else if (typeof document !== 'undefined') {
        // Fallback for older browsers / non-secure contexts: a hidden
        // textarea + `document.execCommand('copy')`. The fallback is
        // deprecated but still works in modern browsers as a safety net.
        const ta = document.createElement('textarea');
        ta.value = link;
        ta.setAttribute('readonly', '');
        ta.style.position = 'absolute';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopiedId(inviteId);
      window.setTimeout(() => {
        setCopiedId((current) => (current === inviteId ? null : current));
      }, 1500);
    } catch (err) {
      console.error('[darat] clipboard copy failed', err);
    }
  };

  const errorKey = error
    ? ((m.darat.create.errors as unknown) as Record<string, string>)[error] ?? m.errors.generic
    : null;

  const consentChips: ChoiceChipOption[] = [
    { value: 'yes', label: m.common.confirm, icon: 'check' },
    { value: 'no', label: m.common.cancel, icon: 'close' },
  ];

  // Post-create summary view: replaces the form once the transaction
  // commits. Renders one row per invite with a copy-link button.
  if (created) {
    return (
      <Modal isOpen onClose={onClose} title={m.darat.create.created}>
        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <h2 className="text-base font-bold text-on-surface">{m.darat.create.shareLinksTitle}</h2>
            <p className="text-[13px] text-on-surface-variant leading-relaxed">
              {m.darat.create.shareLinksHint}
            </p>
          </div>
          <ul className="flex flex-col gap-2">
            {created.invites.map((invite) => {
              const link = buildShareLink(invite.id);
              const justCopied = copiedId === invite.id;
              return (
                <li key={invite.id} className="list-none">
                  <div className="flex flex-col gap-1.5 rounded-xl border border-outline-variant bg-surface-container-lowest p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex flex-col min-w-0">
                        <span className="truncate text-sm font-bold text-on-surface">
                          {invite.displayName}
                        </span>
                        <span className="truncate text-xs text-on-surface-variant">
                          {invite.phone}
                        </span>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openWhatsappInvite(invite)}
                          className="inline-flex items-center gap-1.5 rounded-full bg-[#25D366] px-3 py-1.5 text-xs font-bold text-white transition-all hover:brightness-105 active:scale-[0.97]"
                          aria-label={`${m.darat.create.whatsappButton} ${invite.displayName}`}
                          title={m.darat.create.whatsappButton}
                        >
                          <AppIcon name="send" className="text-[14px]" />
                          {m.darat.create.whatsappButton}
                        </button>
                        <button
                          type="button"
                          onClick={() => copyInviteLink(invite.id)}
                          className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 px-3 py-1.5 text-xs font-bold text-primary transition-colors hover:bg-primary/10"
                          aria-label={`${m.darat.create.copyLink} ${invite.displayName}`}
                        >
                          <AppIcon name={justCopied ? 'check' : 'copy'} className="text-[14px]" />
                          {justCopied ? m.darat.create.copied : m.darat.create.copyLink}
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-on-surface-variant">
                      <span className="font-extrabold uppercase tracking-wider">
                        {m.darat.create.codeLabel}:
                      </span>
                      <code className="select-all break-all rounded-md bg-surface-container px-2 py-0.5 font-mono text-[11px] text-on-surface">
                        {invite.id}
                      </code>
                    </div>
                    <a
                      href={link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="select-all break-all text-[11px] text-primary underline-offset-2 hover:underline"
                    >
                      {link}
                    </a>
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="flex gap-3 pt-2 border-t border-surface-variant">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-primary text-on-primary font-bold text-[15px] py-3 rounded-full hover:bg-primary-hover transition-all active:scale-[0.98] shadow-sm hover:shadow-md"
            >
              {m.common.done}
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal isOpen onClose={onClose} title={m.darat.create.title}>
      <form onSubmit={submit} className="flex min-w-0 flex-col gap-5">
        {/* ── Name ── */}
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="darat-name"
            className="text-[11px] font-extrabold tracking-wider text-on-surface-variant uppercase"
          >
            {m.darat.create.name}
          </label>
          <div
            className={`flex items-center gap-2 w-full h-12 ps-4 pe-2 bg-surface-container-lowest border rounded-xl transition-all duration-200 hover:border-outline hover:bg-surface-container-low focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 ${
              fieldErrors.name ? 'border-error focus-within:border-error focus-within:ring-error/20' : 'border-outline-variant'
            }`}
          >
            <AppIcon name="groups" className="text-[20px] text-on-surface-variant" />
            <input
              id="darat-name"
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (fieldErrors.name) setFieldErrors((prev) => ({ ...prev, name: '' }));
              }}
              placeholder={m.darat.create.namePlaceholder}
              className="flex-1 min-w-0 bg-transparent border-none p-0 font-body-md text-base md:text-body-md text-on-surface placeholder:text-on-surface-variant/50 focus:ring-0 focus:outline-none"
              maxLength={100}
            />
          </div>
          {fieldErrors.name && (
            <p role="alert" className="text-[12px] font-medium text-error mt-1">{fieldErrors.name}</p>
          )}
        </div>

        {/* ── Monthly amount ── */}
        <div className="flex flex-col items-center justify-center py-2">
          <div className="flex items-center gap-2 mb-1">
            <label htmlFor="darat-amount" className="text-[11px] font-extrabold tracking-wider text-on-surface-variant uppercase">
              {m.darat.create.amount}
            </label>
            <span className="rounded-md bg-surface-container-high px-1.5 py-0.5 text-[10px] font-extrabold tracking-widest text-on-surface-variant uppercase">
              {currency}
            </span>
          </div>
          <div className="flex items-center text-primary font-bold">
            <AmountSymbol symbol={symbol} />
            <input
              id="darat-amount"
              type="number"
              step="any"
              min="0"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                if (fieldErrors.amount) setFieldErrors((prev) => ({ ...prev, amount: '' }));
              }}
              placeholder={AMOUNT_PLACEHOLDER}
              className="keep-font-40 bg-transparent border-none text-[40px] leading-[1.1] text-center w-full max-w-[200px] text-on-surface focus:ring-0 p-0 placeholder:text-outline-variant font-extrabold outline-none"
            />
          </div>
          {fieldErrors.amount ? (
            <p role="alert" className="text-[12px] font-medium text-error mt-1">{fieldErrors.amount}</p>
          ) : (
            <p className="text-[12px] font-medium text-on-surface-variant mt-1">{m.darat.create.amountHint}</p>
          )}
        </div>

        {/* ── First round date ── */}
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="darat-create-start-date"
            className="text-[11px] font-extrabold tracking-wider text-on-surface-variant uppercase"
          >
            {m.darat.create.startDate}
          </label>
          <div
            className={`flex items-center gap-2 w-full h-12 ps-4 pe-2 bg-surface-container-lowest border rounded-xl transition-all duration-200 hover:border-outline hover:bg-surface-container-low focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 ${
              fieldErrors.startDate ? 'border-error focus-within:border-error focus-within:ring-error/20' : 'border-outline-variant'
            }`}
          >
            <AppIcon name="calendar_clock" className="text-[20px] text-on-surface-variant" />
            <input
              id="darat-create-start-date"
              type="date"
              value={startDate}
              min={new Date().toISOString().slice(0, 10)}
              onChange={(e) => {
                setStartDate(e.target.value);
                setFieldErrors((prev) => ({ ...prev, startDate: undefined }));
              }}
              className="flex-1 min-w-0 bg-transparent border-none p-0 font-body-md text-base md:text-body-md text-on-surface placeholder:text-on-surface-variant/50 focus:ring-0 focus:outline-none"
            />
          </div>
          {fieldErrors.startDate ? (
            <p role="alert" className="text-[12px] font-medium text-error mt-1">{fieldErrors.startDate}</p>
          ) : (
            <p className="text-[12px] font-medium text-on-surface-variant mt-1">{m.darat.create.startDateHint}</p>
          )}
        </div>

        {/* ── Rotation order ── */}
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="darat-create-rotation"
            className="text-[11px] font-extrabold tracking-wider text-on-surface-variant uppercase"
          >
            {m.darat.create.rotation}
          </label>
          <ChoiceChips
            options={[
              { value: 'random', label: m.darat.create.rotationRandom, icon: 'dices' },
              { value: 'fixed', label: m.darat.create.rotationFixed, icon: 'list_ordered' },
            ]}
            value={rotation}
            onChange={(v) => setRotation(v as DaratRotation)}
          />
          {rotation === 'fixed' && (
            <ol className="mt-1 flex flex-col gap-1.5">
              {order.map((id, idx) => (
                <li
                  key={id}
                  draggable
                  onDragStart={onOrderDragStart(id)}
                  onDragOver={onOrderDragOver(id)}
                  onDrop={onOrderDrop(id)}
                  onDragEnd={onOrderDragEnd}
                  className={`flex items-center gap-3 rounded-xl border bg-surface-container-lowest px-3 py-2 transition-all ${
                    orderDragOverKey === id
                      ? 'border-primary ring-2 ring-primary/20'
                      : 'border-outline-variant'
                  } ${orderDragKey === id ? 'opacity-50' : ''}`}
                >
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-forest text-[11px] font-semibold text-lime">
                    {idx + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-on-surface">
                    {orderLabel(id)}
                  </span>
                  <span aria-hidden="true" className="shrink-0 cursor-grab text-on-surface-variant active:cursor-grabbing">
                    <AppIcon name="drag_indicator" className="text-[20px]" />
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>

        {/* ── Owner participation ── */}
        <div className="flex flex-col gap-1 rounded-2xl border border-outline-variant bg-surface-container-lowest p-3.5">
          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={organizerParticipates}
              onChange={(e) => setOrganizerParticipates(e.target.checked)}
              className="size-4 shrink-0 accent-[var(--color-primary)]"
            />
            <span className="text-[14px] font-semibold text-on-surface">
              {m.darat.create.participate}
            </span>
          </label>
          <p className="ps-7 text-[12px] font-medium text-on-surface-variant">
            {m.darat.create.participateHint}
          </p>
        </div>

        {/* ── Members list with drag-to-reorder ── */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-extrabold tracking-wider text-on-surface-variant uppercase">
              {m.darat.create.members} ({members.length}/{MAX_INVITEES})
            </label>
            <button
              type="button"
              onClick={addMember}
              disabled={members.length >= MAX_INVITEES}
              className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 px-3 py-1 text-xs font-bold text-primary transition-colors hover:bg-primary/10 disabled:opacity-40"
            >
              <AppIcon name="add" className="text-[14px]" />
              {m.darat.create.addMember}
            </button>
          </div>

          {members.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {members.map((member, index) => {
                const isDragOver = dragOverKey === member.key && dragKey !== member.key;
                const rowError = rowErrors.get(member.key);
                const errorText = rowError
                  ? ((m.darat.create.errors as unknown) as Record<string, string>)[
                      rowError === 'nameRequired'
                        ? 'nameRequired'
                        : rowError === 'phoneFormat'
                          ? 'phoneFormat'
                          : 'duplicatePhones'
                    ] ?? m.errors.generic
                  : null;
                const borderClass = rowError
                  ? 'border-error focus-within:border-error focus-within:ring-error/20'
                  : isDragOver
                    ? 'border-primary bg-primary/5'
                    : 'border-outline-variant';
                return (
                  <li key={member.key} className="list-none">
                    <div
                      draggable
                      onDragStart={onDragStart(member.key)}
                      onDragOver={onDragOver(member.key)}
                      onDrop={onDrop(member.key)}
                      onDragEnd={onDragEnd}
                      className={`flex flex-col gap-2 rounded-xl border bg-surface-container-lowest p-3 transition-colors ${borderClass} ${dragKey === member.key ? 'opacity-60' : ''}`}
                    >
                      {/* Header row: drag handle, number, remove */}
                      <div className="flex items-center gap-2">
                        <span
                          aria-label={m.darat.create.dragHandle}
                          className="flex size-8 shrink-0 cursor-grab items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-variant active:cursor-grabbing"
                        >
                          <AppIcon name="drag_indicator" className="text-[20px]" />
                        </span>
                        <span className="w-6 shrink-0 text-center text-xs font-bold text-on-surface-variant">
                          {index + 1}
                        </span>
                        <div className="flex-1" />
                        <button
                          type="button"
                          onClick={() => removeMember(member.key)}
                          aria-label={m.common.remove}
                          className="shrink-0 inline-flex size-8 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-variant"
                        >
                          <AppIcon name="close" className="text-[16px]" />
                        </button>
                      </div>
                      {/* Inputs: full width each. Suppress drag-start so the
                          inputs still let you click and type. */}
                      <input
                        type="text"
                        value={member.displayName}
                        onChange={(e) => {
                          updateMember(member.key, { displayName: e.target.value });
                          if (fieldErrors.members) setFieldErrors((prev) => ({ ...prev, members: '' }));
                        }}
                        onDragStart={stopDrag}
                        draggable={false}
                        placeholder={m.darat.create.memberNamePlaceholder}
                        className={`w-full h-10 rounded-lg border bg-surface-container-lowest px-3 py-1.5 text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:ring-2 focus:outline-none ${
                          rowError === 'nameRequired'
                            ? 'border-error focus:border-error focus:ring-error/20'
                            : 'border-outline-variant focus:border-primary focus:ring-primary/20'
                        }`}
                        maxLength={100}
                        aria-label={`${m.darat.create.memberNamePlaceholder} ${index + 1}`}
                        aria-invalid={rowError === 'nameRequired' ? 'true' : undefined}
                      />
                      <input
                        type="tel"
                        value={member.phone}
                        onChange={(e) => {
                          updateMember(member.key, { phone: e.target.value });
                          if (fieldErrors.members) setFieldErrors((prev) => ({ ...prev, members: '' }));
                        }}
                        onDragStart={stopDrag}
                        draggable={false}
                        placeholder={m.darat.create.memberPhonePlaceholder ?? PHONE_PLACEHOLDER_FALLBACK}
                        className={`w-full h-10 rounded-lg border bg-surface-container-lowest px-3 py-1.5 text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:ring-2 focus:outline-none ${
                          rowError === 'phoneFormat' || rowError === 'duplicate'
                            ? 'border-error focus:border-error focus:ring-error/20'
                            : 'border-outline-variant focus:border-primary focus:ring-primary/20'
                        }`}
                        inputMode="tel"
                        autoComplete="tel"
                        aria-label={`${m.darat.create.memberPhoneLabel ?? 'Phone'} ${index + 1}`}
                        aria-invalid={
                          rowError === 'phoneFormat' || rowError === 'duplicate'
                            ? 'true'
                            : undefined
                        }
                      />
                      {errorText && (
                        <p role="alert" className="text-[12px] font-medium text-error">{errorText}</p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div
              className={`flex flex-col items-center gap-2 rounded-xl border border-dashed p-4 text-center ${
                fieldErrors.members ? 'border-error bg-error-container/20' : 'border-outline-variant bg-surface-container-lowest'
              }`}
            >
              <AppIcon name="person_add" className="text-2xl text-on-surface-variant" />
              <p className="text-xs text-on-surface-variant">{m.darat.create.membersEmptyHint}</p>
            </div>
          )}
          {fieldErrors.members ? (
            <p role="alert" className="text-[12px] font-medium text-error mt-1">{fieldErrors.members}</p>
          ) : members.length > 0 ? (
            <p className="text-[12px] font-medium text-on-surface-variant mt-1">{m.darat.create.membersHint}</p>
          ) : null}
        </div>

        {/* ── Invite consent ── */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-extrabold tracking-wider text-on-surface-variant uppercase">
            {m.darat.create.inviteConsentTitle ?? m.darat.create.inviteConsent}
          </label>
          <p className="text-[13px] text-on-surface-variant leading-relaxed">
            {m.darat.create.inviteConsent}
          </p>
          <ChoiceChips
            value={agreedToInvite ? 'yes' : 'no'}
            onChange={(v) => setAgreedToInvite(v === 'yes')}
            options={consentChips}
            ariaLabel={m.darat.create.inviteConsent}
          />
        </div>

        {errorKey && (
          <p role="alert" className="rounded-xl bg-error-container/30 px-3 py-2 text-[13px] font-medium text-error">
            {errorKey}
          </p>
        )}

        <div className="flex gap-3 pt-2 border-t border-surface-variant">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="flex-1 bg-surface-variant/60 text-on-surface font-bold text-[15px] py-3 rounded-xl hover:bg-surface-variant transition-all active:scale-[0.98] disabled:opacity-50"
          >
            {m.common.cancel}
          </button>
          <button
            type="submit"
            disabled={submitting || !agreedToInvite}
            className="flex-1 bg-primary text-on-primary font-bold text-[15px] py-3 rounded-full hover:bg-primary-hover transition-all active:scale-[0.98] shadow-sm hover:shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <AppIcon name="add" className="text-[18px]" />
            <span>{submitting ? m.darat.create.submitting : m.darat.create.submit}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
}
