'use client';

import { useState } from 'react';
import { AppIcon } from '@/components/ui/app-icon';
import { Modal } from '@/components/ui/Modal';
import { ChoiceChips, type ChoiceChipOption } from '@/components/ui/choice-chips';
import { AmountSymbol } from '@/components/ui/amount-symbol';
import { useLanguage } from '@/lib/i18n-context';
import { useCurrency } from '@/lib/currency-context';
import { DARAT_MAX_MEMBERS } from '@/lib/darat-firestore';
import type { DaratCircle, DaratRotation, DaratFrequency } from '@/lib/darat';
import { parseAmountInput } from '@/lib/parse-amount';

interface Props {
  circle: DaratCircle;
  /**
   * Display label per memberOrder id (uid or phone placeholder), resolved
   * by the parent from the live roster — the modal itself never fetches.
   */
  memberLabels: Record<string, string>;
  onClose: () => void;
  /**
   * Apply edits. Returns the new state the parent should adopt, or an
   * error key from m.errors. The parent (detail screen) shows the toast
   * and reloads the live circle.
   */
  onSubmit: (input: {
    name: string;
    contribution: number;
    frequency: DaratFrequency;
    rotation: DaratRotation;
    startDate: string;
    fixedOrder?: string[] | null;
    /** Owner joins (true) / leaves (false) the rotation. Omitted = unchanged. */
    organizerParticipates?: boolean;
  }) => Promise<{ ok: boolean; error?: string }>;
}

const AMOUNT_PLACEHOLDER = '0';

function todayPlusDays(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Edit-circle modal — opened from the detail screen.
 *
 * Lets the organizer change the circle settings that the create flow
 * skipped: frequency, rotation, start date. The name and amount can
 * also be edited. The member roster cannot be changed from this
 * surface — adding members mid-cycle would change rotation outcomes
 * (round order / pot distribution), so members can only be added at
 * creation. Each member picks their own money place on the detail
 * screen when they mark a payment.
 *
 * Visual style matches the rest of SmartJib's modals: tall input row,
 * big centered amount, uppercase tracking-wider labels, choice chips
 * for single-select frequency/rotation groups, primary submit that
 * fills the action bar.
 */
export function DaratEditModal({ circle, memberLabels, onClose, onSubmit }: Props) {
  const { messages: m } = useLanguage();
  const { symbol, currency } = useCurrency();
  const [name, setName] = useState(circle.name);
  const [amount, setAmount] = useState(String(circle.contribution));
  const [frequency, setFrequency] = useState<DaratFrequency>(circle.frequency);
  const [rotation, setRotation] = useState<DaratRotation>(circle.rotation);
  const [startDate, setStartDate] = useState(circle.startDate);
  // Owner participation, derived from the roster (the owner has a seat iff
  // their uid is in memberOrder) and editable in place.
  const [organizerParticipates, setOrganizerParticipates] = useState(
    circle.memberOrder.includes(circle.organizerId),
  );
  // Agreed-order editing: the payout order the user can drag into place
  // when the rotation is "fixed". Initialized from the stored order.
  const [order, setOrder] = useState<string[]>(circle.memberOrder);
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; amount?: string; members?: string }>({});

  const numericAmount = parseAmountInput(amount) ?? 0;
  const isFixedRotation = rotation === 'fixed';

  // Drag-to-reorder the agreed payout order (same mechanics as the create
  // modal's member list: the key travels through dataTransfer so closures
  // never see a stale value).
  const moveEntry = (fromId: string, toId: string) => {
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
  const onDragStart = (id: string) => (e: React.DragEvent<HTMLElement>) => {
    setDragKey(id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
  };
  const onDragOver = (id: string) => (e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (id !== dragOverKey) setDragOverKey(id);
  };
  const onDrop = (id: string) => (e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
    const fromId = e.dataTransfer.getData('text/plain') || dragKey;
    if (fromId) moveEntry(fromId, id);
    setDragKey(null);
    setDragOverKey(null);
  };
  const onDragEnd = () => {
    setDragKey(null);
    setDragOverKey(null);
  };

  const frequencyChips: ChoiceChipOption[] = [
    { value: 'weekly', label: m.darat.create.frequencyWeekly, icon: 'event_repeat' },
    { value: 'biweekly', label: m.darat.create.frequencyBiweekly, icon: 'event_repeat' },
    { value: 'monthly', label: m.darat.create.frequencyMonthly, icon: 'event_repeat' },
  ];
  const rotationChips: ChoiceChipOption[] = [
    { value: 'random', label: m.darat.create.rotationRandom, icon: 'dices' },
    { value: 'fixed', label: m.darat.create.rotationFixed, icon: 'list_ordered' },
    { value: 'bidding', label: m.darat.create.rotationBidding, icon: 'gavel' },
  ];

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const next: typeof fieldErrors = {};
    if (!name.trim()) next.name = (m.darat.create.errors as Record<string, string>).nameRequired ?? m.errors.generic;
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) next.amount = (m.darat.create.errors as Record<string, string>).amountInvalid ?? m.errors.generic;
    const orderIfSaved = organizerParticipates
      ? circle.memberOrder.length
      : circle.memberOrder.length - (circle.memberOrder.includes(circle.organizerId) ? 1 : 0);
    if (orderIfSaved < 2) {
      next.members = !organizerParticipates && circle.memberOrder.includes(circle.organizerId)
        ? (m.darat.create.errors as Record<string, string>).minInviteesNoOrganizer ?? m.errors.generic
        : (m.darat.create.errors as Record<string, string>).membersTooFew ?? m.errors.generic;
    }
    if (circle.memberOrder.length > DARAT_MAX_MEMBERS) next.members = (m.darat.create.errors as Record<string, string>).membersTooMany ?? m.errors.generic;
    if (Object.keys(next).length > 0) {
      setFieldErrors(next);
      return;
    }
    setSubmitting(true);
    try {
      const res = await onSubmit({
        name: name.trim(),
        contribution: numericAmount,
        frequency,
        rotation,
        startDate,
        fixedOrder: isFixedRotation ? order : null,
        organizerParticipates,
      });
      if (!res.ok) setError(res.error ?? 'genericError');
    } catch (err) {
      console.error('[darat] edit failed', err);
      setError('genericError');
    } finally {
      setSubmitting(false);
    }
  };

  const errorKey = error
    ? ((m.darat.create.errors as unknown) as Record<string, string>)[error] ?? m.errors.generic
    : null;

  return (
    <Modal isOpen onClose={onClose} title={m.darat.edit.title}>
      <form onSubmit={submit} className="flex min-w-0 flex-col gap-5">
        {/* ── Name ── */}
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="darat-edit-name"
            className="text-[11px] font-extrabold tracking-wider text-on-surface-variant uppercase"
          >
            {m.darat.create.name}
          </label>
          <div
            className={`flex items-center gap-2 w-full h-12 ps-4 pe-2 bg-surface-container-lowest border rounded-xl transition-all duration-200 hover:border-outline hover:bg-surface-container-low focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 ${
              fieldErrors.name ? 'border-error focus-within:border-error focus-within:ring-error/20' : 'border-outline-variant'
            }`}
          >
            <AppIcon name="edit" className="text-[20px] text-on-surface-variant" />
            <input
              id="darat-edit-name"
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
            <label htmlFor="darat-edit-amount" className="text-[11px] font-extrabold tracking-wider text-on-surface-variant uppercase">
              {m.darat.create.amount}
            </label>
            <span className="rounded-md bg-surface-container-high px-1.5 py-0.5 text-[10px] font-extrabold tracking-widest text-on-surface-variant uppercase">
              {currency}
            </span>
          </div>
          <div className="flex items-center text-primary font-bold">
            <AmountSymbol symbol={symbol} />
            <input
              id="darat-edit-amount"
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

        {/* ── Frequency (chips) ── */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-extrabold tracking-wider text-on-surface-variant uppercase">
            {m.darat.create.frequency}
          </label>
          <ChoiceChips
            value={frequency}
            onChange={(v) => setFrequency(v as DaratFrequency)}
            options={frequencyChips}
            ariaLabel={m.darat.create.frequency}
            wrap
          />
        </div>

        {/* ── Rotation (chips) ── */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-extrabold tracking-wider text-on-surface-variant uppercase">
            {m.darat.create.rotation}
          </label>
          <ChoiceChips
            value={rotation}
            onChange={(v) => setRotation(v as DaratRotation)}
            options={rotationChips}
            ariaLabel={m.darat.create.rotation}
            wrap
          />
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

        {/* ── Agreed payment order (fixed rotation only) ── */}
        {isFixedRotation && (
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-extrabold tracking-wider text-on-surface-variant uppercase">
              {m.darat.edit.paymentOrder}
            </label>
            <ol className="flex flex-col gap-1.5">
              {order.map((id, idx) => (
                <li
                  key={id}
                  draggable
                  onDragStart={onDragStart(id)}
                  onDragOver={onDragOver(id)}
                  onDrop={onDrop(id)}
                  onDragEnd={onDragEnd}
                  className={`flex items-center gap-3 rounded-xl border bg-surface-container-lowest px-3 py-2 transition-all ${
                    dragOverKey === id
                      ? 'border-primary ring-2 ring-primary/20'
                      : 'border-outline-variant'
                  } ${dragKey === id ? 'opacity-50' : ''}`}
                >
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-forest text-[11px] font-semibold text-lime">
                    {idx + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-on-surface">
                    {memberLabels[id] ?? id}
                  </span>
                  <span aria-hidden="true" className="shrink-0 cursor-grab text-on-surface-variant active:cursor-grabbing">
                    <AppIcon name="drag_indicator" className="text-[20px]" />
                  </span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* ── Start date ── */}
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="darat-edit-start-date"
            className="text-[11px] font-extrabold tracking-wider text-on-surface-variant uppercase"
          >
            {m.darat.create.startDate}
          </label>
          <div className="flex items-center gap-2 w-full h-12 ps-4 pe-2 bg-surface-container-lowest border border-outline-variant rounded-xl transition-all duration-200 hover:border-outline hover:bg-surface-container-low focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
            <AppIcon name="calendar_clock" className="text-[20px] text-on-surface-variant" />
            <input
              id="darat-edit-start-date"
              type="date"
              value={startDate}
              min={todayPlusDays(0)}
              onChange={(e) => setStartDate(e.target.value)}
              className="flex-1 min-w-0 bg-transparent border-none p-0 font-body-md text-base md:text-body-md text-on-surface placeholder:text-on-surface-variant/50 focus:ring-0 focus:outline-none"
            />
          </div>
          <p className="text-[12px] font-medium text-on-surface-variant mt-1">{m.darat.create.startDateHint}</p>
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
            disabled={submitting}
            className="flex-1 bg-primary text-on-primary font-bold text-[15px] py-3 rounded-full hover:bg-primary-hover transition-all active:scale-[0.98] shadow-sm hover:shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <AppIcon name="check" className="text-[18px]" />
            <span>{submitting ? m.darat.edit.saving : m.darat.edit.save}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
}
