'use client';

import { useCallback, useState } from 'react';
import { AppIcon } from '@/components/ui/app-icon';
import { Modal } from '@/components/ui/Modal';
import { ChoiceChips, type ChoiceChipOption } from '@/components/ui/choice-chips';
import { AmountSymbol } from '@/components/ui/amount-symbol';
import { useLanguage } from '@/lib/i18n-context';
import { useCurrency } from '@/lib/currency-context';
import { DARAT_MAX_MEMBERS } from '@/lib/darat-firestore';
import type { DaratCircle, DaratRotation, DaratFrequency } from '@/lib/darat';
import { parseAmountInput } from '@/lib/parse-amount';
import { DaratDice } from './darat-dice';

interface Props {
  circle: DaratCircle;
  /**
   * Resolves a seat id (uid or phone placeholder) to the name the roster
   * shows, so the drag list speaks the same names as the rest of the
   * circle (joined member name, else the invited name).
   */
  memberName: (seatId: string) => string;
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
export function DaratEditModal({ circle, memberName, onClose, onSubmit }: Props) {
  const { messages: m } = useLanguage();
  const { symbol, currency } = useCurrency();
  const [name, setName] = useState(circle.name);
  const [amount, setAmount] = useState(String(circle.contribution));
  const [frequency, setFrequency] = useState<DaratFrequency>(circle.frequency);
  const [rotation, setRotation] = useState<DaratRotation>(circle.rotation);
  const [startDate, setStartDate] = useState(circle.startDate);
  // The agreed order, editable by drag when rotation === 'fixed'. Seeded
  // from the stored fixedOrder, else the current memberOrder (the list
  // the circle was created with).
  const [order, setOrder] = useState<string[]>(circle.fixedOrder ?? circle.memberOrder);
  // Drag-and-drop feedback (same pattern as the create modal).
  const [dragSeat, setDragSeat] = useState<string | null>(null);
  const [dragOverSeat, setDragOverSeat] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; amount?: string; members?: string }>({});

  const numericAmount = parseAmountInput(amount) ?? 0;
  const isFixedRotation = rotation === 'fixed';

  const frequencyChips: ChoiceChipOption[] = [
    { value: 'weekly', label: m.darat.create.frequencyWeekly, icon: 'event_repeat' },
    { value: 'biweekly', label: m.darat.create.frequencyBiweekly, icon: 'event_repeat' },
    { value: 'monthly', label: m.darat.create.frequencyMonthly, icon: 'event_repeat' },
  ];
  const rotationChips: ChoiceChipOption[] = [
    { value: 'random', label: m.darat.create.rotationRandom, icon: 'dices' },
    { value: 'fixed', label: m.darat.create.rotationFixed, icon: 'list-ordered' },
    { value: 'bidding', label: m.darat.create.rotationBidding, icon: 'gavel' },
  ];

  const moveSeat = useCallback((fromSeat: string, toSeat: string) => {
    if (fromSeat === toSeat) return;
    setOrder((prev) => {
      const fromIdx = prev.indexOf(fromSeat);
      const toIdx = prev.indexOf(toSeat);
      if (fromIdx === -1 || toIdx === -1) return prev;
      const next = [...prev];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      return next;
    });
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const next: typeof fieldErrors = {};
    if (!name.trim()) next.name = (m.darat.create.errors as Record<string, string>).nameRequired ?? m.errors.generic;
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) next.amount = (m.darat.create.errors as Record<string, string>).amountInvalid ?? m.errors.generic;
    if (circle.memberOrder.length < 2) next.members = (m.darat.create.errors as Record<string, string>).membersTooFew ?? m.errors.generic;
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
          {rotation === 'random' && (
            <div className="mt-1 flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 p-3 text-primary">
              <DaratDice size={18} className="shrink-0" />
              <p className="text-[12px] font-medium leading-relaxed text-on-surface-variant">
                {m.darat.create.rotationRandomHint}
              </p>
            </div>
          )}
          {isFixedRotation && (
            <div className="mt-1 flex flex-col gap-2">
              <p className="text-[12px] font-medium leading-relaxed text-on-surface-variant">
                {m.darat.create.rotationFixedHint}
              </p>
              <ul className="flex flex-col gap-2">
                {order.map((seatId, index) => {
                  const isDragOver = dragOverSeat === seatId && dragSeat !== seatId;
                  return (
                    <li key={seatId} className="list-none">
                      <div
                        draggable
                        onDragStart={() => {
                          setDragSeat(seatId);
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = 'move';
                          if (seatId !== dragOverSeat) setDragOverSeat(seatId);
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          const fromSeat = e.dataTransfer.getData('text/plain') || dragSeat;
                          if (fromSeat) moveSeat(fromSeat, seatId);
                          setDragSeat(null);
                          setDragOverSeat(null);
                        }}
                        onDragEnd={() => {
                          setDragSeat(null);
                          setDragOverSeat(null);
                        }}
                        className={`flex items-center gap-2 rounded-xl border bg-surface-container-lowest p-3 transition-colors ${
                          isDragOver ? 'border-primary bg-primary/5' : 'border-outline-variant'
                        } ${dragSeat === seatId ? 'opacity-60' : ''}`}
                      >
                        <span
                          aria-label={m.darat.create.dragHandle}
                          className="flex size-8 shrink-0 cursor-grab items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-variant active:cursor-grabbing"
                        >
                          <AppIcon name="drag_indicator" className="text-[20px]" />
                        </span>
                        <span className="w-6 shrink-0 text-center text-xs font-bold text-on-surface-variant">
                          {index + 1}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-on-surface">
                          {memberName(seatId)}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>

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
            className="flex-1 bg-primary text-on-primary font-bold text-[15px] py-3 rounded-xl hover:bg-accent-foreground transition-all active:scale-[0.98] shadow-sm hover:shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <AppIcon name="check" className="text-[18px]" />
            <span>{submitting ? m.darat.edit.saving : m.darat.edit.save}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
}
