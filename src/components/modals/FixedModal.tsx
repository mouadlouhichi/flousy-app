import { AppIcon } from '@/components/ui/app-icon';
import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Modal } from '../ui/Modal';
import { CustomInput } from '../ui/CustomInput';
import { ChoiceChips } from '../ui/choice-chips';
import { SegmentedControl } from '../ui/segmented-control';
import { useMoneyPlaces } from '../../lib/use-money-places';
import { MemberBadges } from '../ui/member-badges';
import { DueDayPicker } from '../ui/day-picker';
import { CategoryIconPicker } from '../ui/category-icon-picker';
import {
  FixedExpense,
  MoneyPlace,
  DEFAULT_FIXED_CATEGORIES,
  FixedCategoryItem,
  availableForCharge,
  fixedPaidAmount,
  type LifecycleStatus,
  FIXED_TYPE_COLORS,
  fixedCategoryVisual,
} from '../../lib/store';
import { fixedBillSchema, customCategorySchema } from '../../lib/validation';
import { AmountSymbol } from '../ui/amount-symbol';
import { useCurrency } from '../../lib/currency-context';
import { isProUser } from '../../lib/pro-features';
import { useAuth } from '../../lib/auth-context';
import { useLanguage } from '../../lib/i18n-context';
import { useHousehold } from '../../lib/household-context';
import { isProFeatureUnlocked } from '../../lib/household';
import { localizeBillCategory } from '../../lib/localized-labels';

interface FixedModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (bill: FixedExpense) => void;
  onDelete?: (bill: FixedExpense) => void;
  initialBill?: FixedExpense | null;
  categories: string[];
  categoryColors?: Record<string, string>;
  categoryIcons?: Record<string, string>;
  /** Live balance per money place, so a bill cannot overdraft its source. */
  placeBalances?: Record<MoneyPlace, number>;
  /**
   * False when the member may edit bills but not see household balances.
   * Hides the "available in {place}" hint and skips the insufficient-funds
   * check, whose message would disclose the exact balance.
   */
  canSeeBalances?: boolean;
  /** Called when a custom fixed category is renamed, to retype existing bills. */
  onRenameCategory?: (oldName: string, newName: string) => void;
}

const FIXED_TYPES = DEFAULT_FIXED_CATEGORIES;

const ADD_CATEGORY_VALUE = '__add_fixed_category__';

/** Palette assigned to newly created custom categories. */
const CUSTOM_CATEGORY_COLORS = [
  '#00685f', '#b05e3d', '#3b82f6', '#8b5cf6',
  '#ec4899', '#f97316', '#10b981', '#eab308',
  '#ef4444', '#06b6d4', '#6366f1', '#84cc16',
  '#f43f5e', '#a855f7', '#14b8a6', '#d946ef',
];

function pickUnusedColor(takenColors: string[]): string {
  const used = new Set(takenColors);
  const available = CUSTOM_CATEGORY_COLORS.filter((c) => !used.has(c));
  const pool = available.length > 0 ? available : CUSTOM_CATEGORY_COLORS;
  return pool[Math.floor(Math.random() * pool.length)];
}

/** Fallback icons/colors used when the month data has none for a bill type. */
export function FixedModal({
  isOpen,
  onClose,
  onSave,
  onDelete,
  initialBill,
  categories,
  categoryColors = {},
  categoryIcons = {},
  placeBalances,
  canSeeBalances = true,
  onRenameCategory,
}: FixedModalProps) {
  const { symbol, currency, format } = useCurrency();
  const { profile, updateProfileData } = useAuth();
  const { workspace, household, isOwner, updateConfiguration } = useHousehold();
  const { messages: m, t } = useLanguage();
  const f = m.modals.fixed;
  const { options: moneyPlaceOptions, label: placeLabel, defaultPlace } = useMoneyPlaces();
  const isPro = isProFeatureUnlocked(isProUser(profile), workspace);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState('Rent');
  const [place, setPlace] = useState<MoneyPlace>('bank');
  const [date, setDate] = useState('1st');
  const [person, setPerson] = useState('Self');
  const [payerMemberId, setPayerMemberId] = useState('self');
  const [recurring, setRecurring] = useState(true);
  const [status, setStatus] = useState<LifecycleStatus>('planned');
  const [paidAmount, setPaidAmount] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Household category configuration belongs to the household document. Never
  // mix a member's personal category list into a shared workspace.
  const customCategories = workspace === 'household'
    ? (household?.fixedCategories ?? [])
    : (profile?.fixedCategories ?? []);
  const canManageCategories = workspace === 'personal' || isOwner;
  const customByName = new Map<string, FixedCategoryItem>(customCategories.map((c) => [c.name, c]));
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [customName, setCustomName] = useState('');
  const [customIcon, setCustomIcon] = useState('label');
  const [categoryError, setCategoryError] = useState('');

  const categoryVisual = (catName: string) =>
    fixedCategoryVisual(catName, {
      icons: categoryIcons,
      colors: categoryColors,
      custom: customCategories,
    });

  const resetCategoryForm = () => {
    setShowCategoryForm(false);
    setEditingCategory(null);
    setCustomName('');
    setCustomIcon('label');
    setCategoryError('');
  };

  const openAddCategoryForm = () => {
    if (!canManageCategories) return;
    resetCategoryForm();
    setShowCategoryForm(true);
  };

  const openEditCategoryForm = () => {
    if (!canManageCategories) return;
    const item = customByName.get(type);
    if (!item) return;
    setEditingCategory(item.name);
    setCustomName(item.name);
    setCustomIcon(item.icon);
    setCategoryError('');
    setShowCategoryForm(true);
  };

  const handleChipChange = (value: string) => {
    if (value === ADD_CATEGORY_VALUE) {
      openAddCategoryForm();
      return;
    }
    setType(value);
    // Collapse the form when switching away from the category being edited
    if (editingCategory && value !== editingCategory) resetCategoryForm();
  };

  const handleSaveCategory = () => {
    if (!canManageCategories || (workspace === 'personal' && !profile)) return;

    const trimmed = customName.trim();
    const existing = editingCategory ? customByName.get(editingCategory) : undefined;
    const color =
      existing?.color ||
      pickUnusedColor([
        ...Object.values(categoryColors),
        ...Object.values(FIXED_TYPE_COLORS),
        ...customCategories.map((c) => c.color),
      ]);

    const valRes = customCategorySchema.safeParse({ name: trimmed, color, icon: customIcon });
    if (!valRes.success) {
      setCategoryError(f.invalidCategoryData);
      return;
    }

    const nameTaken = (candidate: string) =>
      FIXED_TYPES.some((d) => d.toLowerCase() === candidate.toLowerCase()) ||
      customCategories.some((c) => c.name.toLowerCase() === candidate.toLowerCase());
    if (trimmed.toLowerCase() !== (editingCategory || '').toLowerCase() && nameTaken(trimmed)) {
      setCategoryError(f.duplicateCategory);
      return;
    }

    const item: FixedCategoryItem = { name: trimmed, color, icon: customIcon };
    const nextCategories = editingCategory
      ? customCategories.map((category) => category.name === editingCategory ? item : category)
      : [...customCategories, item];
    const saveConfiguration = workspace === 'household'
      ? updateConfiguration({ fixedCategories: nextCategories })
      : updateProfileData({ fixedCategories: nextCategories });
    void saveConfiguration.catch((error) => {
      console.error('Could not save fixed category:', error);
      setCategoryError(f.invalidCategoryData);
    });

    // Renaming must retype existing fixed bills so they don't lose the link
    if (editingCategory && editingCategory !== trimmed) {
      onRenameCategory?.(editingCategory, trimmed);
      if (type === editingCategory) setType(trimmed);
    } else if (!editingCategory) {
      setType(trimmed);
    }

    resetCategoryForm();
  };

  useEffect(() => {
    if (initialBill) {
      setName(initialBill.name);
      setAmount(String(initialBill.amount));
      setType(initialBill.type || 'Rent');
      setPlace(initialBill.place || defaultPlace);
      setDate(initialBill.date || '1st');
      setPerson(initialBill.person || 'Self');
      setPayerMemberId(initialBill.payerMemberId || initialBill.person || 'self');
      setRecurring(initialBill.recurring ?? true);
      setStatus(initialBill.status || 'paid');
      setPaidAmount(String(fixedPaidAmount(initialBill)));
    } else {
      setName('');
      setAmount('');
      setType('Rent');
      setPlace(defaultPlace);
      setDate('1st');
      setPerson('Self');
      setPayerMemberId('self');
      setRecurring(true);
      setStatus('planned');
      setPaidAmount('');
    }
    setErrors({});
    resetCategoryForm();
    // Read when the modal opens to seed the form; depending on it would wipe a
    // half-typed entry whenever the place list is re-derived.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialBill, isOpen]);

  // Cash the selected source actually has for this charge: editing a bill that
  // stays in the same place refunds its old amount first.
  const availableInPlace = availableForCharge(placeBalances, place, initialBill);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);

    const validationResult = fixedBillSchema.safeParse({
      name,
      amount: parsedAmount,
      type,
      date,
      place,
    });

    if (!validationResult.success) {
      const fieldErrors: Record<string, string> = {};
      const issues = validationResult.error.issues || (validationResult.error as any).errors || [];
      issues.forEach((err: any) => {
        const field = String(err.path[0] || '');
        if (field === 'name') fieldErrors.name = m.errors.validationNameRequired;
        else if (field === 'amount') fieldErrors.amount = m.errors.validationAmountInvalid;
        else if (field === 'type') fieldErrors.type = m.errors.validationNameRequired;
      });
      setErrors(fieldErrors);
      return;
    }

    const parsedPaidAmount = status === 'paid'
      ? parsedAmount
      : status === 'partial'
        ? Number(paidAmount)
        : 0;
    if (
      status === 'partial'
      && (!Number.isFinite(parsedPaidAmount) || parsedPaidAmount <= 0 || parsedPaidAmount >= parsedAmount)
    ) {
      setErrors({ paidAmount: f.partialAmountError });
      return;
    }

    // Only cash actually paid is checked/debited. Planned and skipped
    // occurrences remain commitments without changing a balance.
    if (canSeeBalances && parsedPaidAmount - availableInPlace > 0.005) {
      setErrors({
        amount: t(f.insufficientFunds, {
          amount: format(availableInPlace),
          place: placeLabel(place),
        }),
      });
      return;
    }

    const id = initialBill?.id || `fixed-${crypto.randomUUID()}`;
    const newBill: FixedExpense = {
      ...(initialBill || {}),
      id,
      templateId: initialBill?.templateId || id,
      name: name.trim(),
      amount: parsedAmount,
      type,
      date,
      place,
      person: person.trim() || 'Self',
      payerMemberId: payerMemberId.trim() || 'self',
      recurring,
      status,
      paidAmount: parsedPaidAmount,
      paidAt: parsedPaidAmount > 0 ? initialBill?.paidAt || new Date().toISOString() : undefined,
    };

    onSave(newBill);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialBill ? f.editTitle : f.addTitle}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {/* ── Amount ── */}
        <div className="flex flex-col items-center justify-center py-2">
          <div className="flex items-center gap-2 mb-1">
            <label className="text-[11px] font-extrabold tracking-wider text-on-surface-variant uppercase">
              {f.monthlyCharge}
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
              autoFocus
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

        {/* ── Bill Name ── */}
        <CustomInput
          label={f.billSubscriptionName}
          type="text"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setErrors((prev) => ({ ...prev, name: '' }));
          }}
          placeholder={f.billSubscriptionPlaceholder}
          error={errors.name}
        />

        {/* ── Category — pill chips with add/update for custom categories ── */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-extrabold tracking-wider text-on-surface-variant uppercase">
              {f.category}
            </label>
            {canManageCategories && customByName.has(type) && !showCategoryForm && (
              <button
                type="button"
                onClick={openEditCategoryForm}
                className="flex items-center gap-1 text-[11px] font-extrabold uppercase tracking-wider text-primary hover:underline"
              >
                <AppIcon name="edit" className="text-[14px]" />
                <span>{f.editCategory}</span>
              </button>
            )}
          </div>

          <ChoiceChips
            value={type}
            onChange={handleChipChange}
            ariaLabel={f.category}
            options={[
              ...FIXED_TYPES.map((c) => ({
                value: c,
                label: localizeBillCategory(c, m),
                ...categoryVisual(c),
              })),
              ...customCategories.map((c) => ({
                value: c.name,
                label: c.name,
                ...categoryVisual(c.name),
              })),
              ...(canManageCategories
                ? [{ value: ADD_CATEGORY_VALUE, label: f.new, icon: 'add' as const }]
                : []),
            ]}
          />

          {/* Inline add/update form for custom categories (div, not a form —
              the bill editor above is already a <form> and nesting is invalid).
              Expands/collapses with a height animation instead of popping in. */}
          <AnimatePresence initial={false}>
            {showCategoryForm && (
              <motion.div
                key="fixed-category-form"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
                className="overflow-hidden"
              >
                <div className="flex flex-col gap-2.5 p-3 bg-surface-container rounded-2xl border border-dashed border-outline-variant">
                  <span className="text-[11px] font-extrabold tracking-wider text-primary uppercase">
                    {editingCategory ? t(f.updateCategory, { name: editingCategory }) : f.newFixedCategory}
                  </span>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={customName}
                  onChange={(e) => {
                    setCustomName(e.target.value);
                    if (categoryError) setCategoryError('');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSaveCategory();
                    }
                    if (e.key === 'Escape') resetCategoryForm();
                  }}
                  placeholder={f.customCategoryPlaceholder}
                  aria-label={m.modals.categories.categoryName}
                  autoFocus
                  className="flex-1 min-w-0 px-3 py-2 text-[14px] font-bold text-on-surface bg-surface-container-lowest border border-outline-variant rounded-xl outline-none focus:border-primary"
                />
                <button
                  type="button"
                  onClick={handleSaveCategory}
                  className="px-4 py-2 bg-primary text-on-primary font-bold rounded-xl text-[13px] hover:opacity-90 shrink-0"
                >
                  {editingCategory ? m.common.save : m.common.add}
                </button>
                <button
                  type="button"
                  onClick={resetCategoryForm}
                  className="px-3 py-2 bg-surface-variant/60 text-on-surface-variant font-bold rounded-xl text-[13px] hover:bg-surface-variant shrink-0"
                >
                  {m.common.cancel}
                </button>
              </div>

              {categoryError && (
                <p role="alert" className="text-[12px] font-medium text-error">
                  {categoryError}
                </p>
              )}

              <CategoryIconPicker value={customIcon} onChange={setCustomIcon} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Due Day — day-picker card (solid bg). Only meaningful for a bill
            that repeats every month; a one-off bill has no "repeat-on day", so
            the picker is hidden unless the recurring toggle is on. ── */}
        {recurring && <DueDayPicker value={date} onChange={setDate} />}

        {/* ── Household Member — badges ── */}
        {isPro ? (
          <MemberBadges value={payerMemberId} onChange={(id, label) => { setPayerMemberId(id); setPerson(label); }} />
        ) : (
          <div className="p-3 rounded-xl border border-dashed border-outline-variant bg-surface-container">
            <p className="font-body-sm text-body-sm text-on-surface-variant">{f.householdPro}</p>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <SegmentedControl
            label={f.lifecycleStatus}
            value={status}
            onChange={(value) => {
              setStatus(value as LifecycleStatus);
              setErrors((previous) => ({ ...previous, paidAmount: '', amount: '' }));
            }}
            options={[
              { value: 'planned', label: f.statusPlanned, icon: 'schedule' },
              { value: 'partial', label: f.statusPartial, icon: 'pending' },
              { value: 'paid', label: f.statusPaid, icon: 'check_circle' },
              { value: 'skipped', label: f.statusSkipped, icon: 'block' },
            ]}
          />
          {status === 'partial' && (
            <label className="flex flex-col gap-1 text-xs font-bold text-on-surface-variant">
              {f.paidAmount}
              <input
                type="number"
                min="0"
                max={amount || undefined}
                step="0.01"
                value={paidAmount}
                onChange={(event) => {
                  setPaidAmount(event.target.value);
                  setErrors((previous) => ({ ...previous, paidAmount: '' }));
                }}
                className="h-12 rounded-xl border border-outline-variant bg-surface px-3 font-mono text-on-surface outline-none focus:border-primary"
              />
              {errors.paidAmount && <span role="alert" className="text-error">{errors.paidAmount}</span>}
            </label>
          )}
        </div>

        {/* ── Paid From — segmented group with sliding active background ── */}
        <SegmentedControl
          label={f.paidFrom}
          value={place}
          onChange={(v) => {
            setPlace(v as MoneyPlace);
            setErrors((prev) => ({ ...prev, amount: '' }));
          }}
          options={moneyPlaceOptions}
        />
        {canSeeBalances && (
          <p className="-mt-3 text-[11px] font-semibold text-on-surface-variant">
            {t(f.availableIn, { place: placeLabel(place), amount: format(availableInPlace) })}
          </p>
        )}

        {/* ── Recurring Toggle ── */}
        <div className="flex items-center justify-between p-3.5 bg-surface-container rounded-xl border border-outline-variant">
          <div className="flex items-center gap-2.5">
            <AppIcon name="event_repeat" className=" text-primary text-[20px]" />
            <div>
              <span className="font-label-md text-label-md font-bold text-on-surface block">
                {f.repeatEveryMonth}
              </span>
              <span className="font-body-sm text-body-sm text-on-surface-variant">
                {f.autoCarries}
              </span>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={recurring}
              onChange={(e) => setRecurring(e.target.checked)}
              aria-label={f.repeatEveryMonth}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-surface-variant rounded-full peer peer-checked:bg-primary peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full after:content-[''] after:absolute after:top-0.5 after:start-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all" />
          </label>
        </div>

        {/* ── Actions ── */}
        <div className="flex gap-3 pt-2 border-t border-surface-variant">
          {initialBill && onDelete && (
            <button
              type="button"
              onClick={() => {
                onDelete(initialBill);
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
            <AppIcon name={initialBill ? 'check' : 'add'} className=" text-[18px]" />
            <span>{initialBill ? f.saveChanges : f.addTitle}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
}
