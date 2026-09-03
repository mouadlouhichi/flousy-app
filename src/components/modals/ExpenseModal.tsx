import { AppIcon } from '@/components/ui/app-icon';
import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Modal } from '../ui/Modal';
import { DatePicker } from '../ui/date-picker';
import { CustomTextarea } from '../ui/CustomTextarea';
import { ChoiceChips } from '../ui/choice-chips';
import { CategoryIconPicker } from '../ui/category-icon-picker';
import { SegmentedControl } from '../ui/segmented-control';
import { useMoneyPlaces } from '../../lib/use-money-places';
import { MemberBadges } from '../ui/member-badges';
import { VariableExpense, MoneyPlace, availableForCharge, bucketOf } from '../../lib/store';
import { customCategorySchema, expenseSchema } from '../../lib/validation';
import { AmountSymbol } from '../ui/amount-symbol';
import { useCurrency } from '../../lib/currency-context';
import { isProUser } from '../../lib/pro-features';
import { isProFeatureUnlocked } from '../../lib/household';
import { useHousehold } from '../../lib/household-context';
import { useAuth } from '../../lib/auth-context';
import { useLanguage } from '../../lib/i18n-context';
import { localizeCategoryName } from '../../lib/localized-labels';
import { createReceiptDataUrl, receiptErrorMessage } from '../../lib/receipt-image';

interface ExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (expense: VariableExpense) => void;
  onDelete?: (expense: VariableExpense) => void;
  initialExpense?: VariableExpense | null;
  categories: string[];
  categoryColors?: Record<string, string>;
  categoryIcons?: Record<string, string>;
  /** Adds a variable-expense category to the current month from this form. */
  onAddCategory?: (name: string, color: string, icon: string, envelope?: 'needs' | 'wants') => void;
  /** Live balance per money place, so an expense cannot overdraft its source. */
  placeBalances?: Record<MoneyPlace, number>;
  periodStartDate?: string;
  periodEndDate?: string;
  /** Hide balance-derived hints when the role cannot read household balances. */
  canSeeBalances?: boolean;
}

const ADD_CATEGORY_VALUE = '__add_variable_category__';
const VARIABLE_CATEGORY_COLORS = [
  '#00685f', '#b05e3d', '#3b82f6', '#8b5cf6',
  '#ec4899', '#f97316', '#10b981', '#eab308',
  '#ef4444', '#06b6d4', '#6366f1', '#84cc16',
  '#f43f5e', '#a855f7', '#14b8a6', '#d946ef',
];

function todayLocalIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function pickUnusedCategoryColor(existingColors: Record<string, string>): string {
  const used = new Set(Object.values(existingColors));
  const available = VARIABLE_CATEGORY_COLORS.filter((color) => !used.has(color));
  const pool = available.length > 0 ? available : VARIABLE_CATEGORY_COLORS;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function ExpenseModal({
  isOpen,
  onClose,
  onSave,
  onDelete,
  initialExpense,
  categories,
  categoryColors = {},
  categoryIcons = {},
  onAddCategory,
  placeBalances,
  periodStartDate,
  periodEndDate,
  canSeeBalances = true,
}: ExpenseModalProps) {
  const { symbol, currency, format } = useCurrency();
  const { profile } = useAuth();
  const { workspace, household } = useHousehold();
  const { intlLocale, messages: m, t } = useLanguage();
  const e = m.modals.expense;
  const { options: moneyPlaceOptions, label: placeLabel, defaultPlace } = useMoneyPlaces();
  const isPro = isProFeatureUnlocked(isProUser(profile), workspace, household);
  const today = todayLocalIso();
  const defaultDate = periodStartDate && today < periodStartDate
    ? periodStartDate
    : periodEndDate && today > periodEndDate
      ? periodEndDate
      : today;
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState(categories[0] || 'Groceries');
  const [place, setPlace] = useState<MoneyPlace>('bank');
  const [date, setDate] = useState(defaultDate);
  const [note, setNote] = useState('');
  const [person, setPerson] = useState('Self');
  const [payerMemberId, setPayerMemberId] = useState('self');
  const [receiptUrl, setReceiptUrl] = useState<string | undefined>(undefined);
  const [receiptBusy, setReceiptBusy] = useState<boolean>(false);
  const [receiptError, setReceiptError] = useState<string>('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [customCategoryName, setCustomCategoryName] = useState('');
  const [customCategoryIcon, setCustomCategoryIcon] = useState('shopping_bag');
  // null = seed from the localized keyword guess; the user's pick wins.
  const [customCategoryEnvelope, setCustomCategoryEnvelope] = useState<'needs' | 'wants' | null>(null);
  const [categoryError, setCategoryError] = useState('');

  useEffect(() => {
    if (initialExpense) {
      setName(initialExpense.name);
      setAmount(String(initialExpense.amount));
      setType(initialExpense.type);
      setPlace(initialExpense.place || defaultPlace);
      setDate(initialExpense.date || defaultDate);
      setNote(initialExpense.note || '');
      setPerson(initialExpense.person || 'Self');
      setPayerMemberId(initialExpense.payerMemberId || initialExpense.person || 'self');
      setReceiptUrl(initialExpense.receiptUrl);
      setReceiptError('');
    } else {
      setName('');
      setAmount('');
      setType(categories[0] || 'Groceries');
      setPlace(defaultPlace);
      setDate(defaultDate);
      setNote('');
      setPerson('Self');
      setPayerMemberId('self');
      setReceiptUrl(undefined);
      setReceiptError('');
    }
    setErrors({});
    setShowCategoryForm(false);
    setCustomCategoryName('');
    setCustomCategoryIcon('shopping_bag');
    setCategoryError('');
    // `categories` and `defaultPlace` deliberately are not dependencies: creating
    // a category (or re-deriving the default place) updates those props, but must
    // not wipe the expense currently being typed. This effect exists to seed the
    // form when the modal opens, not to track its inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialExpense, isOpen]);

  /**
   * A phone photo is stored as a downscaled JPEG rather than the raw data URL:
   * the previous `readAsDataURL` put the whole multi-megabyte image on the
   * expense document, which Firestore refuses, and because the rejection arrived
   * through the save path it surfaced as a silent failure to save the expense.
   */
  const handleReceiptUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Let the same file be picked again after a rejected attempt.
    event.target.value = '';
    if (!file) return;
    setReceiptBusy(true);
    setReceiptError('');
    try {
      setReceiptUrl(await createReceiptDataUrl(file));
    } catch (error) {
      setReceiptError(error instanceof Error ? error.message : 'receipt_image_too_large');
    } finally {
      setReceiptBusy(false);
    }
  };

  const resetCategoryForm = () => {
    setShowCategoryForm(false);
    setCustomCategoryName('');
    setCustomCategoryIcon('shopping_bag');
    setCustomCategoryEnvelope(null);
    setCategoryError('');
  };

  const handleCategoryChipChange = (value: string) => {
    if (value === ADD_CATEGORY_VALUE) {
      setShowCategoryForm(true);
      setCategoryError('');
      return;
    }
    setType(value);
    if (showCategoryForm) resetCategoryForm();
  };

  const handleAddCategory = () => {
    if (!onAddCategory) return;

    const trimmed = customCategoryName.trim();
    const color = pickUnusedCategoryColor(categoryColors);
    const validation = customCategorySchema.safeParse({
      name: trimmed,
      color,
      icon: customCategoryIcon,
    });
    if (!validation.success) {
      setCategoryError(e.invalidCategoryData);
      return;
    }

    if (categories.some((category) => category.toLowerCase() === trimmed.toLowerCase())) {
      setCategoryError(e.duplicateCategory);
      return;
    }

    const guessed = bucketOf(trimmed, 'variable');
    const envelope = customCategoryEnvelope ?? (guessed === 'wants' ? 'wants' : 'needs');
    onAddCategory(trimmed, color, customCategoryIcon, envelope);
    setType(trimmed);
    resetCategoryForm();
  };

  // Cash the selected source actually has for this charge: editing an expense
  // that stays in the same place refunds its old amount first.
  const availableInPlace = availableForCharge(placeBalances, place, initialExpense);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const parsedAmount = parseFloat(amount);

    const validationResult = expenseSchema.safeParse({
      name: name || type,
      amount: parsedAmount,
      type,
      date,
      place,
      note,
    });

    if (!validationResult.success) {
      const fieldErrors: Record<string, string> = {};
      const issues = validationResult.error.issues || (validationResult.error as any).errors || [];
      issues.forEach((err: any) => {
        const field = String(err.path[0] || '');
        if (field === 'name') fieldErrors.name = m.errors.validationNameRequired;
        else if (field === 'amount') fieldErrors.amount = m.errors.validationAmountInvalid;
        else if (field === 'type') fieldErrors.type = m.errors.validationNameRequired;
        else if (field === 'date') fieldErrors.date = m.common.date;
      });
      setErrors(fieldErrors);
      return;
    }

    if ((periodStartDate && date < periodStartDate) || (periodEndDate && date > periodEndDate)) {
      setErrors({
        date: t(e.dateOutsidePeriod, {
          start: periodStartDate || '—',
          end: periodEndDate || '—',
        }),
      });
      return;
    }

    // The source place must actually hold the money being spent. Half-a-cent
    // tolerance absorbs float noise from prior refund/debit arithmetic.
    // Skipped when balances are hidden: the message quotes the exact figure.
    if (canSeeBalances && parsedAmount - availableInPlace > 0.005) {
      setErrors({
        amount: t(e.insufficientFunds, {
          amount: format(availableInPlace),
          place: placeLabel(place),
        }),
      });
      return;
    }

    const newExpense: VariableExpense = {
      id: initialExpense ? initialExpense.id : `expense-${crypto.randomUUID()}`,
      name: name.trim() || type,
      amount: parsedAmount,
      type,
      date,
      place,
      note: note.trim() || undefined,
      person: person.trim() || 'Self',
      payerMemberId: payerMemberId.trim() || 'self',
      receiptUrl,
    };

    onSave(newExpense);
    onClose();
  };

  const activeCategoryColor = categoryColors[type] || 'var(--primary)';
  const activeCategoryIcon = categoryIcons[type] || 'category';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialExpense ? e.editTitle : e.addTitle}
    >
      <form onSubmit={handleSubmit} className="flex min-w-0 flex-col gap-5">
        {/* ── Description / Merchant (with live category icon) ── */}
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="expense-name"
            className="text-[11px] font-extrabold tracking-wider text-on-surface-variant uppercase"
          >
            {e.description}
          </label>
          <div
            className={`flex items-center gap-2 w-full h-12 ps-4 pe-2 bg-surface-container-lowest border rounded-xl transition-all duration-200 hover:border-outline hover:bg-surface-container-low focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 ${
              errors.name ? 'border-error focus-within:border-error focus-within:ring-error/20' : 'border-outline-variant'
            }`}
          >
            <input
              id="expense-name"
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setErrors((prev) => ({ ...prev, name: '' }));
              }}
              placeholder={t(e.descriptionPlaceholder, { category: localizeCategoryName(type, m) })}
              className="flex-1 min-w-0 bg-transparent border-none p-0 font-body-md text-base md:text-body-md text-on-surface placeholder:text-on-surface-variant/50 focus:ring-0 focus:outline-none"
            />
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors duration-200"
              style={{ backgroundColor: `color-mix(in srgb, ${activeCategoryColor} 12%, transparent)` }}
              aria-hidden="true"
            >
              <AppIcon name={activeCategoryIcon} className="text-[20px]" style={{ color: activeCategoryColor }} />
            </span>
          </div>
          {errors.name && (
            <p role="alert" className="text-[12px] font-medium text-error mt-1">{errors.name}</p>
          )}
        </div>

        {/* ── Amount Input ── */}
        <div className="flex flex-col items-center justify-center py-2">
          <div className="flex items-center gap-2 mb-1">
            <label className="text-[11px] font-extrabold tracking-wider text-on-surface-variant uppercase">
              {e.amount}
            </label>
            <span className="rounded-md bg-surface-container-high px-1.5 py-0.5 text-[10px] font-extrabold tracking-widest text-on-surface-variant uppercase">
              {currency}
            </span>
          </div>
          <div className="flex items-center text-primary font-bold">
            <AmountSymbol symbol={symbol} />
            <input
              type="number"
              step="any"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setErrors((prev) => ({ ...prev, amount: '' }));
              }}
              placeholder="0.00"
              className="bg-transparent border-none text-[40px] leading-[1.1] text-center w-full max-w-[200px] text-on-surface focus:ring-0 p-0 placeholder:text-outline-variant font-extrabold outline-none"
            />
          </div>
          {errors.amount && (
            <p role="alert" className="text-[12px] font-medium text-error mt-1">{errors.amount}</p>
          )}
        </div>

        {/* ── Category — add a new one inline, like fixed charges ── */}
        <div className="flex flex-col gap-2">
          <ChoiceChips
            label={e.category}
            value={type}
            onChange={handleCategoryChipChange}
            options={[
              ...categories.map((cat) => ({
                value: cat,
                label: localizeCategoryName(cat, m),
                icon: categoryIcons[cat] || 'category',
                color: categoryColors[cat],
              })),
              ...(onAddCategory
                ? [{ value: ADD_CATEGORY_VALUE, label: e.new, icon: 'add' }]
                : []),
            ]}
          />

          <AnimatePresence initial={false}>
            {showCategoryForm && (
              <motion.div
                key="variable-category-form"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
                className="overflow-hidden"
              >
                <div className="flex flex-col gap-3 rounded-2xl border border-dashed border-outline-variant bg-surface-container p-3">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-primary">
                    {e.newExpenseCategory}
                  </span>
                  <div className="flex flex-col gap-sm">
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <input
                        type="text"
                        value={customCategoryName}
                        onChange={(event) => {
                          setCustomCategoryName(event.target.value);
                          if (categoryError) setCategoryError('');
                        }}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault();
                            handleAddCategory();
                          }
                          if (event.key === 'Escape') resetCategoryForm();
                        }}
                        placeholder={e.customCategoryPlaceholder}
                        aria-label={m.modals.categories.categoryName}
                        autoFocus
                        className="min-w-0 flex-1 rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2 text-[14px] font-bold text-on-surface outline-none focus:border-primary"
                      />
                      <div className="flex gap-2 sm:shrink-0">
                        <button
                          type="button"
                          onClick={handleAddCategory}
                          className="flex-1 rounded-xl bg-primary px-4 py-2 text-[13px] font-bold text-on-primary hover:opacity-90 sm:flex-none"
                        >
                          {m.common.add}
                        </button>
                        <button
                          type="button"
                          onClick={resetCategoryForm}
                          className="flex-1 rounded-xl bg-surface-variant/60 px-3 py-2 text-[13px] font-bold text-on-surface-variant hover:bg-surface-variant sm:flex-none"
                        >
                          {m.common.cancel}
                        </button>
                      </div>
                    </div>
                  </div>

                  {categoryError && (
                    <p role="alert" className="text-[12px] font-medium text-error">
                      {categoryError}
                    </p>
                  )}

                  {/* Envelope classification: seeded from the keyword guess,
                      the explicit choice is persisted with the category. */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[12px] font-bold text-on-surface-variant">
                      {m.modals.categories.envelopeLabel}
                    </span>
                    <div className="flex items-center gap-1" role="group" aria-label={m.modals.categories.envelopeLabel}>
                      {(['needs', 'wants'] as const).map((env) => {
                        const effective = customCategoryEnvelope ?? bucketOf(customCategoryName.trim() || 'x', 'variable');
                        return (
                          <button
                            key={env}
                            type="button"
                            onClick={() => setCustomCategoryEnvelope(env)}
                            aria-pressed={effective === env}
                            className={`px-3 py-1 rounded-full text-[12px] font-bold transition-all ${
                              effective === env
                                ? env === 'needs'
                                  ? 'bg-primary text-on-primary'
                                  : 'bg-tertiary text-on-tertiary'
                                : 'bg-surface-container-highest text-on-surface-variant hover:text-on-surface'
                            }`}
                          >
                            {env === 'needs' ? m.modals.categories.envelopeNeeds : m.modals.categories.envelopeWants}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <CategoryIconPicker value={customCategoryIcon} onChange={setCustomCategoryIcon} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Paid From — segmented group with sliding active background ── */}
        <SegmentedControl
          label={e.paidFrom}
          value={place}
          onChange={(v) => {
            setPlace(v as MoneyPlace);
            setErrors((prev) => ({ ...prev, amount: '' }));
          }}
          options={moneyPlaceOptions}
        />
        {canSeeBalances && (
          <p className="-mt-3 text-[11px] font-semibold text-on-surface-variant">
            {t(e.availableIn, { place: placeLabel(place), amount: format(availableInPlace) })}
          </p>
        )}

        {/* ── Household Member — badges ── */}
        {isPro ? (
          <MemberBadges value={payerMemberId} onChange={(id, label) => { setPayerMemberId(id); setPerson(label); }} />
        ) : (
          <div className="p-3 rounded-xl border border-dashed border-outline-variant bg-surface-container">
            <p className="font-body-sm text-body-sm text-on-surface-variant">{e.householdPro}</p>
          </div>
        )}

        {/* ── Date — responsive calendar popover (no native input overflow) ── */}
        <DatePicker
          label={e.date}
          value={date}
          onChange={(nextDate) => {
            setDate(nextDate);
            setErrors((previous) => ({ ...previous, date: '' }));
          }}
          locale={intlLocale}
          error={errors.date}
        />

        {/* ── Note ── */}
        <CustomTextarea
          label={e.noteOptional}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={e.notePlaceholder}
          rows={2}
        />

        {/* ── Receipt Attachment ── */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-extrabold tracking-wider text-on-surface-variant uppercase">
            {e.receiptOptional}
          </label>
          {isPro ? (
            <>
              {receiptUrl ? (
                <div className="p-2 bg-surface-container rounded-xl border border-outline-variant flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {/*
                      A `next/image` optimizer cannot serve this: the source is an
                      inline data URL produced on this device, which is also what
                      makes the attachment readable offline.
                    */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={receiptUrl} alt={e.receiptPreview} className="w-12 h-12 object-cover rounded-lg" />
                    <span className="font-body-sm text-body-sm text-on-surface font-bold">{e.receiptAttached}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setReceiptUrl(undefined)}
                    className="tap-target p-1.5 text-error hover:bg-error-container/20 rounded-lg"
                    aria-label={e.removeReceipt}
                  >
                    <AppIcon name="close" className=" text-[18px]" />
                  </button>
                </div>
              ) : (
                <label className="p-3 bg-surface border border-dashed border-outline-variant rounded-xl flex items-center justify-center gap-2 cursor-pointer hover:bg-surface-variant/30 transition-colors">
                  <AppIcon name="add_a_photo" className=" text-primary text-[20px]" />
                  <span className="font-label-md text-label-md text-on-surface-variant font-medium">
                    {receiptBusy ? m.receipt.processing : e.uploadReceipt}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleReceiptUpload}
                    disabled={receiptBusy}
                    className="hidden"
                  />
                </label>
              )}
              {receiptError && (
                <p role="alert" className="text-xs font-bold text-error">
                  {receiptErrorMessage(receiptError, m.receipt.tooLarge)}
                </p>
              )}
            </>
          ) : (
            <div className="p-3 rounded-xl border border-dashed border-outline-variant bg-surface-container text-center">
              <p className="font-body-sm text-body-sm text-on-surface-variant">{e.receiptPro}</p>
            </div>
          )}
        </div>

        {/* ── Actions ── */}
        <div className="flex gap-3 pt-2 border-t border-surface-variant">
          {initialExpense && onDelete && (
            <button
              type="button"
              onClick={() => {
                onDelete(initialExpense);
                onClose();
              }}
              className="px-4 py-3 rounded-xl border border-error text-error hover:bg-error-container/20 font-bold text-[14px] transition-colors"
            >
              {m.common.delete}
            </button>
          )}
          <button
            type="submit"
            className="flex-1 bg-primary text-on-primary font-bold text-[15px] py-3 rounded-xl hover:bg-accent-foreground transition-all active:scale-[0.98] shadow-sm hover:shadow-md flex items-center justify-center gap-2"
          >
            <AppIcon name={initialExpense ? 'check' : 'add'} className=" text-[18px]" />
            <span>{initialExpense ? e.saveChanges : e.addTitle}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
}
