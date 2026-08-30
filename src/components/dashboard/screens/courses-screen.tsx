'use client';

import { useEffect, useState } from 'react';
import { AppIcon } from '@/components/ui/app-icon';
import { Input } from '@/components/ui/input';
import { MONEY_PLACE_OPTIONS, SegmentedControl } from '@/components/ui/segmented-control';
import { useCourseSession } from '@/hooks/use-course-session';
import { isProFeatureUnlocked } from '@/lib/household';
import { useHousehold } from '@/lib/household-context';
import { isMoroccanBarcode, normalizeBarcode, round2, sessionUnits } from '@/lib/course-session';
import { formatCurrency } from '@/lib/currency';
import { useLanguage } from '@/lib/i18n-context';
import type { CourseSession, MoneyPlace } from '@/lib/store';
import { CoursesBill } from '../courses/courses-bill';
import { CoursesScanUpsell } from '../courses/courses-scan-upsell';
import { CoursesScannerPanel } from '../courses/courses-scanner-panel';
import { useDashboard } from '../dashboard-provider';

/** A resolved (or to-be-entered) product waiting for its price. */
interface PendingProduct {
  /** Present when a barcode was scanned/typed (catalogued when added). */
  barcode?: string;
  name: string;
  brand?: string;
  category?: string;
  imageUrl?: string;
  /** Where the metadata came from (drives the helper label). */
  source: 'catalog' | 'remote' | 'manual';
  /** Moroccan product (badge). */
  ma: boolean;
}

function parsePrice(raw: string): number | null {
  const value = Number(raw.replace(',', '.'));
  return Number.isFinite(value) && value >= 0 ? round2(value) : null;
}

/**
 * Quantity control: − / + steppers around a directly-editable number field,
 * so "6" can be typed instead of tapped six times.
 */
function QtyControl({ value, onChange }: { value: number; onChange: (qty: number) => void }) {
  const { messages: m } = useLanguage();
  const [text, setText] = useState(String(value));

  useEffect(() => {
    setText(String(value));
  }, [value]);

  const commit = (raw: string) => {
    const digits = raw.replace(/[^0-9]/g, '');
    setText(digits);
    const n = Number(digits);
    if (Number.isFinite(n) && n >= 1) onChange(Math.min(9999, Math.floor(n)));
  };

  return (
    <div className="flex shrink-0 items-center rounded-full border border-outline-variant bg-surface">
      <button
        type="button"
        onClick={() => onChange(Math.max(1, value - 1))}
        className="p-2 text-on-surface-variant hover:text-on-surface"
        aria-label="−1"
      >
        <AppIcon name="remove" className="size-3.5" />
      </button>
      <input
        value={text}
        onChange={(e) => commit(e.target.value)}
        onBlur={() => setText(String(value))}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        inputMode="numeric"
        autoComplete="off"
        aria-label={m.courses.quantity}
        className="w-8 bg-transparent text-center font-body-md text-body-md font-bold text-on-surface outline-none"
      />
      <button
        type="button"
        onClick={() => onChange(Math.min(9999, value + 1))}
        className="p-2 text-on-surface-variant hover:text-on-surface"
        aria-label="+1"
      >
        <AppIcon name="add" className="size-3.5" />
      </button>
    </div>
  );
}

export function CoursesScreen() {
  const { user, profile, isPro, openProModal } = useDashboard();
  const { t, messages: m } = useLanguage();
  const c = m.courses;
  const store = useCourseSession(user?.uid ?? null);
  const { workspace } = useHousehold();

  const currency = profile?.currency ?? 'MAD';

  // Barcode scanning (camera + code lookup) is a Pro feature. Household
  // contributors get it unlocked with the workspace; everyone else keeps the
  // always-free fallback: adding items by name. (The upsell card only ever
  // renders outside a household workspace, so the upgrade CTA is always
  // allowed there.)
  const scanUnlocked = isProFeatureUnlocked(isPro, workspace);

  // ---- view state -------------------------------------------------------------
  const [viewingBill, setViewingBill] = useState<CourseSession | null>(null);
  const [pending, setPending] = useState<PendingProduct | null>(null);
  const [pendingQty, setPendingQty] = useState(1);
  const [pendingPrice, setPendingPrice] = useState('');
  const [resolving, setResolving] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'info' | 'warn'; text: string } | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualQty, setManualQty] = useState(1);
  const [manualPrice, setManualPrice] = useState('');

  const active = store.active;
  const billSession = viewingBill;

  const clearNotice = () => setNotice(null);

  // ---- scan / manual code handling ---------------------------------------------
  const openPending = (product: PendingProduct) => {
    setPending(product);
    setPendingQty(1);
    // Price is ALWAYS entered fresh: it varies from market to market, so we
    // never prefill or suggest a value (the catalog's last price is recorded
    // for future price history but intentionally not shown here).
    setPendingPrice('');
  };

  const handleCode = async (raw: string) => {
    if (resolving || !active || !scanUnlocked) return;
    clearNotice();

    // Re-scan of a line already on the bill: POS behaviour — add one unit
    // instantly, keep the line's price, no network lookup involved.
    const { barcode: scannedBarcode } = normalizeBarcode(raw);
    if (scannedBarcode) {
      const existing = active.items.find((line) => line.barcode === scannedBarcode);
      if (existing) {
        store.setQty(existing.key, existing.qty + 1);
        setNotice({
          kind: 'info',
          text: t(c.scannedAdded, { name: existing.name, qty: existing.qty + 1 }),
        });
        return;
      }
    }

    setResolving(true);
    try {
      const result = await store.resolveBarcode(raw);
      if (!result.ok) {
        setNotice({ kind: 'warn', text: c.codeInvalid });
        openPending({ name: '', source: 'manual', ma: false });
        return;
      }
      const { barcode, resolution } = result;
      const ma = isMoroccanBarcode(barcode);
      if (resolution.kind === 'found') {
        setNotice({
          kind: 'info',
          text: resolution.source === 'catalog' ? c.fromCatalog : c.fromOff,
        });
        openPending({
          barcode,
          name: resolution.product.name,
          brand: resolution.product.brand,
          category: resolution.product.category,
          imageUrl: resolution.product.imageUrl,
          source: resolution.source,
          ma,
        });
      } else {
        setNotice({ kind: 'warn', text: c.notFound });
        openPending({ barcode, name: '', source: 'manual', ma });
      }
    } finally {
      setResolving(false);
    }
  };

  // ---- pending confirmations ----------------------------------------------------
  const confirmPending = () => {
    if (!pending) return;
    const price = parsePrice(pendingPrice);
    if (price == null) {
      setNotice({ kind: 'warn', text: c.priceRequired });
      return;
    }
    if (!pending.name.trim() && pending.source === 'manual') {
      setNotice({ kind: 'warn', text: c.nameRequired });
      return;
    }
    store.addScannedLine({
      barcode: pending.barcode,
      name: pending.name.trim(),
      category: pending.category,
      unitPrice: price,
      qty: pendingQty,
    });
    setPending(null);
    setPendingPrice('');
    setPendingQty(1);
    if (pending.barcode) setNotice({ kind: 'info', text: c.remembered });
  };

  const addManualLine = (event: React.FormEvent) => {
    event.preventDefault();
    const name = manualName.trim();
    const price = parsePrice(manualPrice);
    if (!name || price == null) {
      setNotice({ kind: 'warn', text: !name ? c.nameRequired : c.priceRequired });
      return;
    }
    store.addScannedLine({ name, unitPrice: price, qty: manualQty });
    setManualName('');
    setManualQty(1);
    setManualPrice('');
    clearNotice();
  };

  const finish = () => {
    if (!active) return;
    const completed = store.finishSession();
    if (completed) setViewingBill(completed);
  };

  const discard = () => {
    if (!active) return;
    store.discardSession(active.id);
    setConfirmDiscard(false);
    setPending(null);
  };

  const totalLabel = active ? formatCurrency(active.total, active.currency) : formatCurrency(0, currency);

  return (
    <div className="space-y-4">
      {billSession ? (
        <CoursesBill
          session={billSession}
          onBack={() => setViewingBill(null)}
          onNewCourse={() => {
            setViewingBill(null);
            store.startSession({ currency, place: 'bank' });
          }}
        />
      ) : !active ? (
        <EmptyCourse
          store={store}
          currency={currency}
          startSession={store.startSession}
          onOpenBill={setViewingBill}
        />
      ) : (
        <div className="space-y-4 pb-24 md:pb-4">
          {/* Session header: date + paid-from */}
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <h2 className="font-headline-sm text-headline-sm text-on-surface">{c.title}</h2>
              <p className="font-body-md text-body-md text-on-surface-variant">
                {active.date} · {sessionUnits(active)} {c.items}
              </p>
            </div>
            <div className="ms-auto w-full sm:w-auto">
              <SegmentedControl
                label={c.paidFrom}
                value={active.place}
                onChange={(value) => store.setPlace(value as MoneyPlace)}
                options={MONEY_PLACE_OPTIONS}
              />
            </div>
          </div>

          {/* Notice */}
          {notice && (
            <div
              className={`flex items-center justify-between gap-2 rounded-2xl px-4 py-2.5 font-body-md text-body-md ${
                notice.kind === 'warn'
                  ? 'bg-tertiary-container text-on-tertiary-container'
                  : 'bg-primary-container text-on-primary-container'
              }`}
            >
              <span className="flex items-center gap-2">
                <AppIcon name={notice.kind === 'warn' ? 'warning' : 'info'} className="size-4" />
                {notice.text}
              </span>
              <button type="button" onClick={clearNotice} aria-label={m.common.close} className="p-1 hover:opacity-70">
                <AppIcon name="close" className="size-3.5" />
              </button>
            </div>
          )}

          {/* Scanner — Pro feature; free plans see the upgrade card instead */}
          {scanUnlocked ? (
            <CoursesScannerPanel enabled onCode={handleCode} />
          ) : (
            <CoursesScanUpsell onUpgrade={openProModal} />
          )}

          {/* Pending product — the one-field price step */}
          {pending ? (
            <PendingCard
              pending={pending}
              qty={pendingQty}
              price={pendingPrice}
              resolving={resolving}
              currency={active.currency}
              onQty={(qty) => setPendingQty(Math.max(1, qty))}
              onPrice={setPendingPrice}
              onName={(name) => setPending({ ...pending, name })}
              onConfirm={confirmPending}
              onSkip={() => setPending(null)}
            />
          ) : resolving ? (
            <div className="flex items-center gap-3 rounded-3xl border border-outline-variant bg-surface-container-low p-5 font-body-md text-body-md text-on-surface-variant">
              <AppIcon name="search" className="animate-pulse size-5 text-primary" />
              {m.common.loading}
            </div>
          ) : (
            /* Name-only entry (produce, no barcode) — always free */
            <form
              onSubmit={addManualLine}
              className="rounded-3xl border border-outline-variant bg-surface-container-low p-4 md:p-5"
            >
              <div className="flex items-center gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
                  <AppIcon name="label" className="size-5 text-primary" />
                </span>
                <div className="min-w-0">
                  <h3 className="font-display font-headline-sm text-headline-sm text-on-surface">
                    {c.noBarcode}
                  </h3>
                  <p className="mt-0.5 font-body-sm text-body-sm text-on-surface-variant">
                    {c.noBarcodeHint}
                  </p>
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-2.5 md:flex-row md:items-end">
                <label className="block min-w-0 flex-1">
                  <span className="mb-1 block font-label-sm text-label-sm text-on-surface-variant">
                    {c.manualName}
                  </span>
                  <Input
                    value={manualName}
                    onChange={(e) => setManualName(e.target.value)}
                    placeholder={c.manualName}
                    maxLength={100}
                    aria-label={c.manualName}
                    className="w-full bg-surface text-[15px] font-medium"
                  />
                </label>
                <div className="flex flex-wrap items-end gap-2.5">
                  <div>
                    <span className="mb-1 block font-label-sm text-label-sm text-on-surface-variant">
                      {c.quantity}
                    </span>
                    <QtyControl value={manualQty} onChange={setManualQty} />
                  </div>
                  <label className="block">
                    <span className="mb-1 block font-label-sm text-label-sm text-on-surface-variant">
                      {c.price}
                    </span>
                    <Input
                      value={manualPrice}
                      onChange={(e) => setManualPrice(e.target.value.replace(/[^0-9.,]/g, ''))}
                      placeholder={c.price}
                      inputMode="decimal"
                      aria-label={c.price}
                      className="w-24 bg-surface text-right font-bold tabular-nums"
                    />
                  </label>
                  <button
                    type="submit"
                    className="flex h-9 items-center gap-2 whitespace-nowrap rounded-xl bg-primary px-5 font-label-md text-label-md text-on-primary hover:opacity-90 transition-opacity"
                  >
                    <AppIcon name="add" className="size-4" />
                    {c.manualAdd}
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* Item list */}
          {active.items.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-outline-variant p-8 text-center font-body-md text-body-md text-on-surface-variant">
              {c.noItems}
            </div>
          ) : (
            <ul className="divide-y divide-outline-variant overflow-hidden rounded-3xl border border-outline-variant bg-surface-container-low">
              {active.items.map((line) => (
                <li key={line.key} className="flex items-center gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 truncate font-body-md text-body-md font-semibold text-on-surface">
                      {line.name}
                      {line.barcode && isMoroccanBarcode(line.barcode) && (
                        <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 font-label-sm text-label-sm text-primary">
                          {c.maBadge}
                        </span>
                      )}
                    </p>
                    <p className="font-label-sm text-label-sm text-on-surface-variant">
                      {formatCurrency(line.unitPrice, active.currency)} / {c.unit}
                    </p>
                  </div>
                  <QtyControl value={line.qty} onChange={(q) => store.setQty(line.key, q)} />
                  <span className="w-20 text-right font-body-md text-body-md font-bold text-on-surface tabular-nums">
                    {formatCurrency(line.lineTotal, active.currency)}
                  </span>
                  <button
                    type="button"
                    onClick={() => store.removeLine(line.key)}
                    className="p-1.5 text-on-surface-variant hover:text-error"
                    aria-label={m.common.remove}
                  >
                    <AppIcon name="close" className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* Bottom action bar */}
          <div className="fixed inset-x-0 bottom-16 md:bottom-4 z-20 mx-auto max-w-3xl px-4">
            {confirmDiscard ? (
              <div className="flex items-center gap-3 rounded-2xl border border-error/40 bg-surface-container-high p-3 shadow-[0_10px_30px_rgba(0,0,0,0.18)]">
                <p className="flex-1 font-body-md text-body-md text-on-surface">{c.discardConfirm}</p>
                <button
                  type="button"
                  onClick={discard}
                  className="rounded-full bg-error px-4 py-2 font-label-md text-label-md text-on-error hover:opacity-90"
                >
                  {c.discard}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDiscard(false)}
                  className="rounded-full border border-outline-variant px-4 py-2 font-label-md text-label-md text-on-surface"
                >
                  {m.common.cancel}
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3 rounded-2xl bg-surface-container-high p-3 shadow-[0_10px_30px_rgba(0,0,0,0.18)] border border-outline-variant">
                <div className="min-w-0">
                  <p className="font-label-sm text-label-sm text-on-surface-variant">{c.total}</p>
                  <p className="font-headline-sm text-headline-sm text-primary tabular-nums">{totalLabel}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setConfirmDiscard(true)}
                  disabled={active.items.length === 0}
                  className="ms-auto font-label-md text-label-md text-on-surface-variant hover:text-error disabled:opacity-40 transition-colors"
                >
                  {c.discard}
                </button>
                <button
                  type="button"
                  onClick={finish}
                  disabled={active.items.length === 0}
                  className="rounded-full bg-primary px-5 py-2.5 font-label-md text-label-md text-on-primary hover:opacity-90 disabled:opacity-40 transition-opacity"
                >
                  {c.finish}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// --- Empty state + history ---------------------------------------------------------

interface EmptyCourseProps {
  store: ReturnType<typeof useCourseSession>;
  currency: string;
  startSession: (opts: { currency: string; place: MoneyPlace }) => void;
  onOpenBill: (session: CourseSession) => void;
}

function EmptyCourse({ store, currency, startSession, onOpenBill }: EmptyCourseProps) {
  const { messages: m } = useLanguage();
  const c = m.courses;

  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-outline-variant bg-surface-container-low p-6 md:p-8 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
          <AppIcon name="scan_barcode" className="size-8 text-primary" />
        </div>
        <h2 className="mt-4 font-headline-md text-headline-md text-on-surface">{c.emptyTitle}</h2>
        <p className="mx-auto mt-2 max-w-md font-body-md text-body-md text-on-surface-variant">{c.emptyHint}</p>
        <button
          type="button"
          onClick={() => startSession({ currency, place: 'bank' })}
          className="mt-5 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 font-label-md text-label-md text-on-primary hover:opacity-90 transition-opacity"
        >
          <AppIcon name="play_circle" className="size-[18px]" />
          {c.start}
        </button>
      </div>

      <div>
        <h3 className="mb-2 px-1 font-headline-sm text-headline-sm text-on-surface">{c.recentTitle}</h3>
        {store.history.length === 0 ? (
          <p className="rounded-3xl border border-dashed border-outline-variant p-6 text-center font-body-md text-body-md text-on-surface-variant">
            {c.noRecent}
          </p>
        ) : (
          <ul className="divide-y divide-outline-variant overflow-hidden rounded-3xl border border-outline-variant bg-surface-container-low">
            {store.history.slice(0, 10).map((session) => (
              <HistoryRow key={session.id} session={session} onOpen={onOpenBill} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function HistoryRow({ session, onOpen }: { session: CourseSession; onOpen: (s: CourseSession) => void }) {
  const { messages: m, isRTL } = useLanguage();
  const c = m.courses;
  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(session)}
        className="flex w-full items-center gap-3 p-4 text-start hover:bg-surface-container-high transition-colors"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <AppIcon name="receipt_long" className="size-[18px] text-primary" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-body-md text-body-md font-semibold text-on-surface">
            {session.date} · {session.items.length} {c.items}
          </span>
          <span className="block font-label-sm text-label-sm text-on-surface-variant">
            {c.paidFrom}: {m.places[session.place]}
          </span>
        </span>
        <span className="font-body-md text-body-md font-bold text-on-surface tabular-nums">
          {formatCurrency(session.total, session.currency)}
        </span>
        <AppIcon
          name="chevron_right"
          className={`size-[18px] text-on-surface-variant ${isRTL ? 'rotate-180' : ''}`}
        />
      </button>
    </li>
  );
}

// --- Pending product card (the price step) ------------------------------------------

interface PendingCardProps {
  pending: PendingProduct;
  qty: number;
  price: string;
  resolving: boolean;
  currency: string;
  onQty: (qty: number) => void;
  onPrice: (price: string) => void;
  onName: (name: string) => void;
  onConfirm: () => void;
  onSkip: () => void;
}

function PendingCard({ pending, qty, price, resolving, currency, onQty, onPrice, onName, onConfirm, onSkip }: PendingCardProps) {
  const { messages: m } = useLanguage();
  const c = m.courses;
  const needsName = pending.source === 'manual';

  return (
    <div className="rounded-3xl border border-primary/40 bg-primary-container/40 p-4 md:p-5">
      <div className="flex items-start gap-3">
        {pending.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={pending.imageUrl}
            alt=""
            className="h-14 w-14 shrink-0 rounded-xl object-cover bg-surface"
          />
        ) : (
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-surface">
            <AppIcon name="inventory_2" className="size-6 text-primary" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          {needsName ? (
            <Input
              value={pending.name}
              onChange={(e) => onName(e.target.value)}
              placeholder={c.manualName}
              maxLength={100}
              autoFocus
              className="bg-surface font-semibold"
            />
          ) : (
            <p className="truncate font-headline-sm text-headline-sm text-on-surface">{pending.name}</p>
          )}
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 font-label-sm text-label-sm text-on-surface-variant">
            {pending.brand && <span>{pending.brand}</span>}
            {pending.barcode && <span dir="ltr">{pending.barcode}</span>}
            {pending.ma && (
              <span className="rounded-full bg-primary/15 px-2 py-0.5 text-primary">{c.maBadge}</span>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={onSkip}
          disabled={resolving}
          className="shrink-0 font-label-md text-label-md text-on-surface-variant hover:text-on-surface transition-colors"
        >
          {c.skip}
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <QtyControl value={qty} onChange={onQty} />

        <div className="flex items-center gap-2">
          <Input
            value={price}
            onChange={(e) => onPrice(e.target.value.replace(/[^0-9.,]/g, ''))}
            onKeyDown={(e) => e.key === 'Enter' && onConfirm()}
            placeholder={c.unitPrice}
            inputMode="decimal"
            autoFocus={!needsName}
            className="w-32 bg-surface text-right font-bold"
          />
          <button
            type="button"
            onClick={onConfirm}
            disabled={resolving}
            className="flex h-9 items-center gap-2 whitespace-nowrap rounded-xl bg-primary px-5 font-label-md text-label-md text-on-primary hover:opacity-90 disabled:opacity-40 transition-opacity"
          >
            <AppIcon name="add" className="size-4" />
            {c.add}
          </button>
        </div>
      </div>
    </div>
  );
}
