'use client';

import { type ReactNode, useEffect, useRef, useState } from 'react';
import { AppIcon } from '@/components/ui/app-icon';
import { Input } from '@/components/ui/input';
import { useCourseSession } from '@/hooks/use-course-session';
import { isProFeatureUnlocked } from '@/lib/household';
import { normalizeDigitsToAscii, parseAmountInput } from '@/lib/parse-amount';
import { useHousehold } from '@/lib/household-context';
import { trackEvent } from '@/lib/analytics';
import { isMoroccanBarcode, round2, sessionUnits, summarizeQuality } from '@/lib/course-session';
import { formatCurrency } from '@/lib/currency';
import { postCourseSession } from '@/lib/db';
import { isFirebaseConfigured } from '@/lib/firebase';
import { formatShortDate, getCurrentMonthKey } from '@/lib/utils';
import { useLanguage } from '@/lib/i18n-context';
import {
  addVariableExpense,
  type AssessmentOrigin,
  type CourseSession,
  type MoneyPlace,
  type ProductDomain,
  type ProductFieldProvenance,
  type ProductRanking,
  type ProductSource,
  type SessionItemQuality,
  type VariableExpense,
} from '@/lib/store';
import { analyzeIngredientsText } from '@/lib/ingredient-analysis-client';
import type { ProductForm } from '@/lib/ingredient-safety/types';
import { isCosmeticRecord } from '@/lib/food-knowledge/domain';
import { AreaRestricted } from '../area-restricted';
import { SCREEN_AREA } from '@/lib/household-rbac';
import { CoursesBudgetLogger } from '../courses/courses-budget-logger';
import { CoursesBill } from '../courses/courses-bill';
import { CoursesScanUpsell } from '../courses/courses-scan-upsell';
import { CoursesScannerPanel } from '../courses/courses-scanner-panel';
import { CoursesLabelAccordion } from '../courses/courses-label-accordion';
import { readInciOverlayEntry } from '@/lib/ingredient-device-store';
import { RankingChip } from '@/components/ui/ranking-chip';
import { QualityScoreChip } from '@/components/ui/quality-score-chip';
import { ScanLookupCard } from '@/components/ui/scan-lookup-card';
import { useDashboard } from '../dashboard-provider';
import { parseGtin, type BarcodeCandidate } from '@/lib/gtin';

/** A resolved (or to-be-entered) product waiting for its price. */
interface PendingProduct {
  /** Present when a barcode was scanned/typed (catalogued when added). */
  barcode?: string;
  gtin14?: string;
  name: string;
  brand?: string;
  category?: string;
  imageUrl?: string;
  /** Full INCI list when the remote record had one (cosmetics). */
  ingredientsText?: string;
  /** Pack size / net content when the source exposes it (e.g. "1 L"). */
  quantity?: string;
  /** Where the metadata came from (drives the helper label). */
  source: 'catalog' | 'seed' | 'remote' | 'manual';
  /** Moroccan product (badge). */
  ma: boolean;
  /** Nutri-Score ranking, when the source provides one. */
  ranking?: ProductRanking;
  /** Source hint that this is a cosmetic/beauty record (INCI panel, vendor fallback). */
  beauty?: boolean;
  form?: ProductForm;
  domain?: ProductDomain;
  allergenTags?: string[];
  productSource?: ProductSource;
  provenance?: Record<string, ProductFieldProvenance>;
  sourceUrl?: string;
  sourceDatabase?: string;
  retrievedAt?: string;
  staleAfter?: string;
}

/**
 * A course session ends by writing its items into the month as variable
 * expenses, so the whole screen belongs to the `expenses` area — a member
 * without that grant must not be able to scan a bill into the shared budget.
 */
export function CoursesScreen() {
  const { canViewArea } = useHousehold();
  const area = SCREEN_AREA.courses!;
  if (!canViewArea(area)) return <AreaRestricted area={area} icon="scan_barcode" />;
  return <CoursesScreenInner />;
}

function parsePrice(raw: string): number | null {
  const value = parseAmountInput(raw);
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

function CoursesScreenInner() {
  const { user, profile, isPro, openProModal, month, updateAndSaveMonth, currentMonthKey } = useDashboard();
  const { t, messages: m, intlLocale, language } = useLanguage();
  const c = m.courses;
  const store = useCourseSession(user?.uid ?? null);
  const { workspace, household, canEdit } = useHousehold();

  const currency = profile?.currency ?? 'MAD';

  // Barcode scanning (camera + code lookup) is a Pro feature. Household
  // contributors get it unlocked with the workspace; everyone else keeps the
  // always-free fallback: adding items by name. (The upsell card only ever
  // renders outside a household workspace, so the upgrade CTA is always
  // allowed there.)
  const scanUnlocked = isProFeatureUnlocked(isPro, workspace, household);

  // ---- view state -------------------------------------------------------------
  const [viewingBill, setViewingBill] = useState<CourseSession | null>(null);
  const [pending, setPending] = useState<PendingProduct | null>(null);
  const [pendingQty, setPendingQty] = useState(1);
  const [pendingPrice, setPendingPrice] = useState('');
  const [resolving, setResolving] = useState(false);
  const [resolvingCode, setResolvingCode] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: 'info' | 'warn'; text: string } | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualQty, setManualQty] = useState(1);
  const [manualPrice, setManualPrice] = useState('');
  const [postingBill, setPostingBill] = useState(false);
  const [postingError, setPostingError] = useState<string | null>(null);
  const scanRequestIdRef = useRef(0);
  const scanAbortRef = useRef<AbortController | null>(null);

  const active = store.active;
  const billSession = viewingBill
    ? store.history.find((session) => session.id === viewingBill.id) ?? viewingBill
    : null;

  const clearNotice = () => setNotice(null);

  useEffect(() => () => scanAbortRef.current?.abort(), []);
  useEffect(() => {
    scanAbortRef.current?.abort();
    scanRequestIdRef.current += 1;
    setResolving(false);
    setResolvingCode(null);
  }, [active?.id]);

  // ---- scan / manual code handling ---------------------------------------------
  const openPending = (product: PendingProduct, prefilledPrice?: string) => {
    setPending(product);
    setPendingQty(1);
    // Price is normally entered fresh: it varies from market to market, so we
    // never prefill or suggest a value (the catalog's last price is recorded
    // for future price history but intentionally not shown here). The single
    // exception is an in-store variable-measure barcode, whose price is
    // printed *inside* the code and is passed in as `prefilledPrice`.
    setPendingPrice(prefilledPrice ?? '');
  };

  const handleCode = async (candidate: BarcodeCandidate) => {
    if (resolving || !active || !scanUnlocked) return;
    clearNotice();
    const parsed = parseGtin(candidate);
    if (!parsed.ok) {
      if (candidate.source === 'manual') {
        setNotice({ kind: 'warn', text: c.codeInvalidOverride });
        // Explicit override means “add an unbarcoded item”; the unverified
        // value is never looked up, attached, or used as a catalog key.
        openPending({ name: '', source: 'manual', ma: false });
      } else {
        setNotice({ kind: 'warn', text: c.codeInvalid });
      }
      return;
    }

    const canonical = parsed.value;
    const existing = active.items.find((line) => line.gtin14 === canonical.gtin14);
    if (existing) {
      store.setQty(existing.key, existing.qty + 1);
      setNotice({
        kind: 'info',
        text: t(c.scannedAdded, { name: existing.name, qty: existing.qty + 1 }),
      });
      return;
    }

    const requestId = ++scanRequestIdRef.current;
    scanAbortRef.current?.abort();
    const controller = new AbortController();
    scanAbortRef.current = controller;
    setResolving(true);
    setResolvingCode(canonical.gtin);

    try {
      const result = await store.resolveBarcode(candidate, {
        lang: language,
        signal: controller.signal,
      });
      if (requestId !== scanRequestIdRef.current || controller.signal.aborted) return;

      if (result.kind === 'invalid') {
        setNotice({ kind: 'warn', text: c.codeInvalid });
        return;
      }
      if (result.kind === 'restricted-circulation') {
        // Issuer-specific amount layouts are never interpreted as a price
        // without an explicit configured confirmation flow.
        setNotice({ kind: 'warn', text: c.codeInvalid });
        return;
      }

      const barcode = result.canonical.gtin;
      const gtin14 = result.canonical.gtin14;
      const ma = isMoroccanBarcode(barcode);
      if (result.kind === 'found') {
        const product = result.product;
        openPending({
          barcode,
          gtin14,
          name: product.name,
          brand: product.brand,
          category: product.category,
          imageUrl: product.imageUrl,
          ingredientsText: product.ingredientsText,
          quantity: product.quantity,
          ranking: product.ranking,
          source: result.source,
          ma,
          beauty: product.beauty,
          form: product.cosmeticForm,
          domain: product.domain,
          allergenTags: product.allergenTags,
          productSource: product.source,
          provenance: product.provenance,
          sourceUrl: product.sourceUrl,
          sourceDatabase: product.sourceDatabase,
          retrievedAt: product.retrievedAt,
          staleAfter: product.staleAfter,
        });

        if (result.revalidate) {
          void result.revalidate.then((fresh) => {
            if (!fresh || requestId !== scanRequestIdRef.current || controller.signal.aborted) return;
            setPending((current) => current?.gtin14 === gtin14 ? {
              ...current,
              name: fresh.name || current.name,
              brand: fresh.brand ?? current.brand,
              category: fresh.category ?? current.category,
              imageUrl: fresh.imageUrl ?? current.imageUrl,
              ingredientsText: fresh.ingredientsText ?? current.ingredientsText,
              quantity: fresh.quantity ?? current.quantity,
              ranking: fresh.ranking ?? current.ranking,
              source: 'remote',
              beauty: fresh.beauty ?? current.beauty,
              form: current.form ?? fresh.cosmeticForm,
              domain: fresh.domain,
              allergenTags: fresh.allergenTags ?? current.allergenTags,
              productSource: fresh.source,
              provenance: fresh.provenance ?? current.provenance,
              sourceUrl: fresh.sourceUrl ?? current.sourceUrl,
              sourceDatabase: fresh.sourceDatabase ?? current.sourceDatabase,
              retrievedAt: fresh.retrievedAt ?? current.retrievedAt,
              staleAfter: fresh.staleAfter ?? current.staleAfter,
            } : current);
          }).catch(() => undefined);
        }
        return;
      }

      setNotice({
        kind: 'warn',
        text: result.reason === 'lookup-failed' ? c.lookupFailed : c.notFound,
      });
      openPending({ barcode, gtin14, name: '', source: 'manual', ma });
    } finally {
      if (requestId === scanRequestIdRef.current) {
        setResolving(false);
        setResolvingCode(null);
      }
    }
  };

  // ---- pending confirmations ----------------------------------------------------
  const confirmPending = () => {
    if (!pending || !active) return;
    const price = parsePrice(pendingPrice);
    if (price == null) {
      setNotice({ kind: 'warn', text: c.priceRequired });
      return;
    }
    if (!pending.name.trim() && pending.source === 'manual') {
      setNotice({ kind: 'warn', text: c.nameRequired });
      return;
    }

    scanAbortRef.current?.abort();
    scanRequestIdRef.current += 1;
    const ingredientsText =
      (pending.barcode ? readInciOverlayEntry(pending.barcode, user?.uid ?? null)?.text : undefined) ||
      pending.ingredientsText?.trim();
    const itemKey = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const assessmentRequestId = `assessment-${itemKey}`;
    const origin: AssessmentOrigin = {
      sessionId: active.id,
      lineItemId: itemKey,
      requestId: assessmentRequestId,
      gtin14: pending.gtin14,
      requestedAt: new Date().toISOString(),
    };

    store.addScannedLine({
      key: itemKey,
      barcode: pending.barcode,
      gtin14: pending.gtin14,
      name: pending.name.trim(),
      category: pending.category,
      domain: pending.domain,
      cosmeticForm: pending.form,
      allergenTags: pending.allergenTags,
      quantity: pending.quantity,
      provenance: pending.provenance,
      sourceUrl: pending.sourceUrl,
      sourceDatabase: pending.sourceDatabase,
      retrievedAt: pending.retrievedAt,
      staleAfter: pending.staleAfter,
      unitPrice: price,
      qty: pendingQty,
      ranking: pending.ranking,
      assessmentRequestId,
      assessmentOrigin: origin,
      ...(ingredientsText ? { ingredientsText } : {}),
      ...(pending.beauty ? { beauty: true } : {}),
    });

    if (pending.barcode) {
      const now = new Date().toISOString();
      store.upsertProduct({
        barcode: pending.barcode,
        gtin14: pending.gtin14,
        name: pending.name.trim(),
        brand: pending.brand,
        category: pending.category,
        imageUrl: pending.imageUrl,
        quantity: pending.quantity,
        ingredientsText,
        domain: pending.domain,
        cosmeticForm: pending.form,
        allergenTags: pending.allergenTags,
        ranking: pending.ranking,
        beauty: pending.beauty,
        source: pending.productSource ?? (pending.source === 'manual' ? 'manual' : 'off'),
        sourceUrl: pending.sourceUrl,
        sourceDatabase: pending.sourceDatabase,
        retrievedAt: pending.retrievedAt,
        staleAfter: pending.staleAfter,
        provenance: {
          ...pending.provenance,
          ...(pending.source === 'manual' ? { name: { source: 'manual' as const, retrievedAt: now } } : {}),
          lastPrice: { source: 'manual', retrievedAt: now },
          ...(pending.form ? { cosmeticForm: { source: 'manual' as const, retrievedAt: now } } : {}),
        },
        lastPrice: price,
        priceUpdatedAt: now,
        createdAt: now,
        updatedAt: now,
      });
    }

    if (
      ingredientsText &&
      isCosmeticRecord({
        beauty: pending.beauty,
        domain: pending.domain,
        category: pending.category,
        name: pending.name,
        ingredientsText,
      })
    ) {
      void analyzeIngredientsText(ingredientsText, {
        label: pending.name,
        category: pending.category,
        ...(pending.form ? { form: pending.form } : {}),
      })
        .then((analysis) => {
          store.applyAssessment(origin, {
            quality: summarizeQuality(analysis),
            assessment: analysis,
          });
        })
        .catch(() => {
          /* Evidence is informational; the immutable line remains unscored. */
        });
    }

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

  // ---- log the finished course into the budget ---------------------------------
  // Firestore mode posts the expense, ledger entry, and session marker in one
  // transaction. The deterministic expense ID also makes lost-ack retries safe.
  const logBillToBudget = async (category: string, place: MoneyPlace) => {
    if (!billSession || billSession.loggedExpenseId || postingBill) return;
    if (workspace === 'household' && !canEdit) {
      setPostingError(c.logPermissionDenied);
      return;
    }
    if (store.pendingMutations > 0 || store.syncState === 'syncing') {
      store.retrySync();
      setPostingError(c.syncBeforePost);
      return;
    }
    const [year, monthNumber, day] = billSession.date.split('-').map(Number);
    const destinationMonth = getCurrentMonthKey(month.periodStartDay, new Date(year, monthNumber - 1, day));
    setPostingBill(true);
    setPostingError(null);
    try {
      const expenseId = `course-${billSession.id}`;
      if (isFirebaseConfigured && user) {
        const target = workspace === 'household' && household?.id
          ? { workspace: 'household' as const, householdId: household.id }
          : { workspace: 'personal' as const, uid: user.uid };
        const posted = await postCourseSession({
          uid: user.uid,
          sessionId: billSession.id,
          target,
          monthKey: destinationMonth,
          category,
          place,
          configuration: workspace === 'household' && household
            ? {
                currency: household.currency,
                monthStartDate: household.monthStartDate,
                defaultCategoryBudgets: household.defaultCategoryBudgets,
                enableRollover: household.enableRollover,
              }
            : profile,
        });
        store.acceptCommittedSession(posted.session);
      } else {
        if (destinationMonth !== currentMonthKey) throw new Error('Select the destination period before posting.');
        const expense: VariableExpense = {
          id: expenseId,
          name: `${c.title} · ${billSession.date}`,
          amount: billSession.total,
          type: category,
          date: billSession.date,
          place,
          note: `${billSession.items.length} ${c.items}`,
          person: 'Self',
          createdByUserId: user?.uid,
          sourceType: 'course',
          sourceId: billSession.id,
        };
        updateAndSaveMonth(addVariableExpense(month, expense), 'expenses');
        store.markLogged(billSession.id, expenseId);
      }
      setViewingBill({
        ...billSession,
        loggedExpenseId: expenseId,
        loggedMonthKey: destinationMonth,
        loggedWorkspace: workspace,
        loggedWorkspaceId: workspace === 'household' ? household?.id : user?.uid,
      });
      // Telemetry records feature adoption only—never prices, categories,
      // account/place names, or the user's financial period.
      trackEvent('course_logged_to_budget', { workspace });
    } catch (reason) {
      console.error('Course posting failed:', reason);
      setPostingError(c.logFailed);
    } finally {
      setPostingBill(false);
    }
  };

  /** Persist the paid-from selection on the completed bill and keep the
   *  receipt in sync with it. */
  const handleBillPlaceChange = (place: MoneyPlace) => {
    if (!billSession) return;
    store.setSessionPlace(billSession.id, place);
    setViewingBill({ ...billSession, place });
  };

  const destinationMonthKey = (() => {
    if (!billSession) return currentMonthKey;
    const [year, monthNumber, day] = billSession.date.split('-').map(Number);
    return getCurrentMonthKey(month.periodStartDay, new Date(year, monthNumber - 1, day));
  })();
  const [monthYear, monthNum] = destinationMonthKey.split('-').map(Number);
  const periodLabel = new Date(monthYear, monthNum - 1, 1).toLocaleDateString(intlLocale, {
    month: 'long',
    year: 'numeric',
  });
  const monthLabel = `${workspace === 'household' ? household?.name || m.household.title : c.personalWorkspace} · ${periodLabel}`;

  const totalLabel = active
    ? formatCurrency(active.total, active.currency, intlLocale)
    : formatCurrency(0, currency, intlLocale);

  return (
    <div className="space-y-4">
      {billSession ? (
        <>
          <CoursesBill
            session={billSession}
            onBack={() => setViewingBill(null)}
            onNewCourse={() => {
              setViewingBill(null);
              store.startSession({ currency, place: 'bank' });
            }}
          />
          <CoursesBudgetLogger
            session={billSession}
            categories={month.activeCategories || []}
            monthLabel={monthLabel}
            place={billSession.place}
            onPlaceChange={handleBillPlaceChange}
            onLog={logBillToBudget}
            posting={postingBill}
            error={postingError}
            canPost={workspace !== 'household' || canEdit}
          />
        </>
      ) : !active ? (
        <EmptyCourse
          store={store}
          currency={currency}
          startSession={store.startSession}
          onOpenBill={setViewingBill}
        />
      ) : (
        <div className="space-y-4">
          {/* Session header: date + item count */}
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <h2 className="font-headline-sm text-headline-sm text-on-surface">{c.title}</h2>
              <p className="font-body-md text-body-md text-on-surface-variant">
                {formatShortDate(active.date, intlLocale)} · {new Intl.NumberFormat(intlLocale).format(sessionUnits(active))} {c.items}
              </p>
            </div>
          </div>

          {store.syncState !== 'synced' && (
            <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-outline-variant bg-surface-container-high px-4 py-3 font-body-md text-body-md text-on-surface">
              <AppIcon
                name={store.syncState === 'conflict' || store.syncState === 'failed' ? 'sync_problem' : 'cloud_upload'}
                className="size-5 text-tertiary"
              />
              <span className="min-w-0 flex-1">
                {store.syncState === 'conflict'
                  ? c.syncConflict
                  : store.syncState === 'failed'
                    ? c.syncFailed
                    : t(c.syncPending, { count: store.pendingMutations })}
              </span>
              {(store.syncState === 'failed' || store.syncState === 'pending') && (
                <button type="button" onClick={store.retrySync} className="rounded-full border border-outline-variant px-3 py-1.5 font-label-sm text-label-sm">
                  {c.syncRetry}
                </button>
              )}
              {store.syncState === 'conflict' && (
                <button type="button" onClick={store.discardConflictingMutation} className="rounded-full border border-error/40 px-3 py-1.5 font-label-sm text-label-sm text-error">
                  {c.syncDiscardLocal}
                </button>
              )}
            </div>
          )}

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
              <button type="button" onClick={clearNotice} aria-label={m.common.close} className="tap-target p-1 hover:opacity-70">
                <AppIcon name="close" className="size-3.5" />
              </button>
            </div>
          )}

          {/* Scanner — Pro feature; free plans see the upgrade card instead */}
          {scanUnlocked ? (
            <CoursesScannerPanel
              enabled={!resolving && !pending && !notice}
              onCode={(candidate) => void handleCode(candidate)}
            />
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
              onSkip={() => {
                scanAbortRef.current?.abort();
                scanRequestIdRef.current += 1;
                setPending(null);
              }}
              onIngredientsText={(text) =>
                setPending((p) => (p && p.gtin14 === pending.gtin14 ? { ...p, ingredientsText: text } : p))
              }
              onFormChange={(form) =>
                setPending((p) => (p && p.gtin14 === pending.gtin14 ? { ...p, form } : p))
              }
            />
          ) : resolving ? (
            <ScanLookupCard
              code={resolvingCode ?? undefined}
              labels={{
                searching: c.lookupSearching,
                slowHint: c.lookupSlowHint,
                verySlowHint: c.lookupVerySlowHint,
              }}
            />
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
                      onChange={(e) => setManualPrice(normalizeDigitsToAscii(e.target.value).replace(/[^0-9.,]/g, ''))}
                      placeholder="0.00"
                      inputMode="decimal"
                      aria-label={c.price}
                      dir="ltr"
                      className="w-24 bg-surface text-right text-[15px] font-medium tabular-nums placeholder:font-normal"
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
                    <p className="flex items-center gap-2 font-body-md text-body-md font-semibold text-on-surface">
                      <span className="min-w-0 truncate">{line.name}</span>
                      <RankingChip ranking={line.ranking} />
                      {line.quality && <QualityScoreChip quality={line.quality} />}
                      {line.barcode && isMoroccanBarcode(line.barcode) && (
                        <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 font-label-sm text-label-sm text-primary">
                          {c.maBadge}
                        </span>
                      )}
                    </p>
                    <p className="font-label-sm text-label-sm text-on-surface-variant">
                      {line.category && <span>{line.category} · </span>}
                      {formatCurrency(line.unitPrice, active.currency, intlLocale)} / {c.unit}
                    </p>
                  </div>
                  <QtyControl value={line.qty} onChange={(q) => store.setQty(line.key, q)} />
                  <span className="w-20 text-right font-body-md text-body-md font-bold text-on-surface tabular-nums">
                    {formatCurrency(line.lineTotal, active.currency, intlLocale)}
                  </span>
                  <button
                    type="button"
                    onClick={() => store.removeLine(line.key)}
                    className="tap-target p-1.5 text-on-surface-variant hover:text-error"
                    aria-label={m.common.remove}
                  >
                    <AppIcon name="close" className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* Bottom action bar — sits at the bottom of the course screen. */}
          <CourseFloatingBar>
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
          </CourseFloatingBar>
        </div>
      )}
    </div>
  );
}

/**
 * Bottom action bar rendered in the normal document flow (relative) at the
 * end of the course screen, instead of floating fixed over the content.
 */
function CourseFloatingBar({ children }: { children: ReactNode }) {
  return <div className="relative">{children}</div>;
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
  const { messages: m, isRTL, intlLocale } = useLanguage();
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
            {formatShortDate(session.date, intlLocale)} · {new Intl.NumberFormat(intlLocale).format(session.items.length)} {c.items}
          </span>
          <span className="block font-label-sm text-label-sm text-on-surface-variant">
            {c.paidFrom}: {m.places[session.place as keyof typeof m.places] ?? session.place}
          </span>
        </span>
        <span className="font-body-md text-body-md font-bold text-on-surface tabular-nums">
          {formatCurrency(session.total, session.currency, intlLocale)}
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
  /** Panel adopted a missing-INCI list (external fallback / paste / OCR). */
  onIngredientsText: (text: string | undefined) => void;
  onFormChange: (form: ProductForm) => void;
}

/**
 * Runs the same ingredient analysis the label panel runs (the client's
 * in-memory cache dedupes the request) and collapses it to the chip's
 * score + tier counts, so the chip after the name matches the panel.
 */
function useCosmeticQualityPreview(
  isCosmetic: boolean,
  text: string,
  name: string,
  category: string | undefined,
  form: ProductForm | undefined,
): SessionItemQuality | null {
  const [quality, setQuality] = useState<SessionItemQuality | null>(null);
  useEffect(() => {
    if (!isCosmetic || !text) {
      setQuality(null);
      return;
    }
    let cancelled = false;
    setQuality(null);
    analyzeIngredientsText(text, { label: name || undefined, category, form })
      .then((analysis) => {
        if (!cancelled) setQuality(summarizeQuality(analysis));
      })
      .catch(() => {
        if (!cancelled) setQuality(null);
      });
    return () => {
      cancelled = true;
    };
  }, [isCosmetic, text, name, category, form]);
  return quality;
}

function PendingCard({ pending, qty, price, resolving, currency, onQty, onPrice, onName, onConfirm, onSkip, onIngredientsText, onFormChange }: PendingCardProps) {
  const { messages: m } = useLanguage();
  const { user } = useDashboard();
  const c = m.courses;
  const needsName = pending.source === 'manual';

  // Cosmetic quality preview for the chip: the record's INCI list (or the
  // per-device overlay the panel would fall back to), cosmetic records only.
  const qualityText = (
    (pending.barcode ? readInciOverlayEntry(pending.barcode, user?.uid ?? null)?.text ?? '' : '') ||
    pending.ingredientsText?.trim() ||
    ''
  ).trim();
  const cosmeticRecord = !needsName && isCosmeticRecord({
    beauty: pending.beauty,
    category: pending.category,
    name: pending.name,
    ingredientsText: qualityText || undefined,
  });
  const quality = useCosmeticQualityPreview(
    cosmeticRecord,
    qualityText,
    pending.name,
    pending.category,
    pending.form,
  );

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
            <p className="flex min-w-0 items-center gap-1.5 font-headline-sm text-headline-sm text-on-surface">
              <span className="min-w-0 truncate">{pending.name}</span>
              <RankingChip ranking={pending.ranking} />
              {quality && <QualityScoreChip quality={quality} />}
            </p>
          )}
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 font-label-sm text-label-sm text-on-surface-variant">
            {pending.brand && <span>{pending.brand}</span>}
            {pending.category && <span>{pending.category}</span>}
            {pending.quantity && <span dir="ltr">{pending.quantity}</span>}
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

      {/* Quantity + price — the point of this step, so it comes first. */}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <QtyControl value={qty} onChange={onQty} />

        <div className="flex items-center gap-2">
          <Input
            value={price}
            onChange={(e) => onPrice(normalizeDigitsToAscii(e.target.value).replace(/[^0-9.,]/g, ''))}
            onKeyDown={(e) => e.key === 'Enter' && onConfirm()}
            placeholder="0.00"
            inputMode="decimal"
            autoFocus={!needsName}
            dir="ltr"
            aria-label={c.unitPrice}
            className="w-32 bg-surface text-right text-[15px] font-medium tabular-nums placeholder:font-normal"
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

      {/* Label-knowledge accordion — domain-aware preview + expandable panel.
          Cosmetics get the INCI score ring + glance; food gets the coverage
          hook + food-knowledge panel (incl. the mineral-water view). */}
      <CoursesLabelAccordion
        barcode={pending.barcode}
        name={needsName ? undefined : pending.name}
        category={pending.category}
        ingredientsText={pending.ingredientsText}
        domain={pending.domain}
        allergenTags={pending.allergenTags}
        form={pending.form}
        onFormChange={onFormChange}
        beauty={pending.beauty}
        needsName={needsName}
        onIngredientsText={onIngredientsText}
      />
    </div>
  );
}
