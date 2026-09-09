'use client';

import { useEffect, useRef, useState } from 'react';
import { AppIcon } from '@/components/ui/app-icon';
import { useLanguage } from '@/lib/i18n-context';
import { splitInciList } from '@/lib/ingredient-safety/normalize';
import {
  readInciOverlayEntry,
  removeInciOverlayEntry,
  subscribeInciOverlay,
  writeInciOverlayEntry,
} from '@/lib/ingredient-device-store';
import { lookupInciForBarcode } from '@/lib/ingredient-lookup-client';
import { CoursesIngredientGlance } from './courses-ingredient-glance';
import { inferProductForm } from '@/lib/ingredient-safety/form';
import { MAX_INGREDIENT_TEXT_LENGTH, type ParserSummary, type ProductForm } from '@/lib/ingredient-safety/types';
import { LabelOcrButton } from './label-ocr-button';
import { useDashboard } from '../dashboard-provider';

/**
 * Ingredient panel for a pending scanned product.
 *
 * Source ladder, highest precedence first:
 *   1. an account-scoped device overlay the user explicitly reviewed;
 *   2. `initialText` from the resolved/catalog record (Open Beauty Facts,
 *      vendor-enriched through the same-origin API, or a prior account save);
 *   3. a manual paste or on-device OCR draft that requires explicit review.
 *
 * The reviewed overlay is the immediate device copy. When a course line is
 * confirmed, the same text and field provenance enter the account catalog at
 * users/{uid}/products/{gtin14}; analysis itself uses the same-origin API and
 * may include attributed provider evidence as documented in the methodology.
 */

interface CoursesIngredientPanelProps {
  /** Present when the product was identified by a barcode. */
  barcode?: string;
  /** INCI list supplied by the resolution cascade/catalog, if any. */
  initialText?: string;
  initialSource?: ParserSummary['source'];
  initialReviewed?: boolean;
  /** Product name used as a form hint for the analysis. */
  name?: string;
  /** OBF-style category used as a leave-on/rinse-off hint. */
  category?: string;
  form?: ProductForm;
  onFormChange?: (form: ProductForm) => void;
  /**
   * Called whenever the panel adopts an ingredient text (vendor fallback,
   * manual paste or OCR). Lets the parent update the pending product/catalog
   * copy so a vendor-supplied list is persisted when the line is confirmed.
   */
  onIngredientsText?: (
    text: string | undefined,
    metadata?: { source: 'manual' | 'ocr' | 'remote'; reviewed: boolean },
  ) => void;
}

export function CoursesIngredientPanel({
  barcode,
  initialText,
  initialSource,
  initialReviewed,
  name,
  category,
  form,
  onFormChange,
  onIngredientsText,
}: CoursesIngredientPanelProps) {
  const { messages } = useLanguage();
  const { user } = useDashboard();
  const accountId = user?.uid ?? null;
  const [, setOverlayRevision] = useState(0);
  useEffect(
    () => subscribeInciOverlay(accountId, () => setOverlayRevision((revision) => revision + 1)),
    [accountId],
  );
  const g = messages.ingredientGlance;
  const im = messages.ingredientManual;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [invalid, setInvalid] = useState(false);
  const [saved, setSaved] = useState(false);
  const [lookupStatus, setLookupStatus] = useState<'idle' | 'looking' | 'not-found' | 'failed'>('idle');
  const [lookupNonce, setLookupNonce] = useState(0);
  const onIngredientsRef = useRef(onIngredientsText);
  onIngredientsRef.current = onIngredientsText;
  const [localForm, setLocalForm] = useState<ProductForm>(form ?? inferProductForm(category, name));
  const effectiveForm = form ?? localForm;

  const fromRecord = initialText?.trim() || '';
  const overlayEntry = barcode ? readInciOverlayEntry(barcode, accountId) : undefined;
  const overlay = (overlayEntry?.text ?? '').trim();
  const overlaySource = overlayEntry?.source;
  const overlayReviewed = overlayEntry?.reviewed;
  const overlayAnalysisSource: ParserSummary['source'] = overlaySource === 'ocr'
    ? 'ocr'
    : overlaySource === 'manual'
      ? 'paste'
      : 'unknown';
  // null = no ingredient text available yet (the manual paste prompt shows).
  const [active, setActive] = useState<string | null>(overlay || fromRecord || null);
  const [analysisSource, setAnalysisSource] = useState<ParserSummary['source']>(
    overlay ? overlayAnalysisSource : (fromRecord ? initialSource ?? 'provider' : 'unknown'),
  );
  const [analysisReviewed, setAnalysisReviewed] = useState(
    overlayEntry?.reviewed ?? (fromRecord ? initialReviewed ?? true : false),
  );

  useEffect(() => {
    if (overlay && overlay !== fromRecord && overlaySource) {
      onIngredientsRef.current?.(overlay, {
        source: overlaySource,
        reviewed: overlayReviewed === true,
      });
    }
  }, [overlay, overlaySource, overlayReviewed, fromRecord]);

  // Keep state coherent when the parent swaps products, a remote fallback
  // resolves, or another tab changes this account's overlay map.
  const seenKeyRef = useRef(barcode ?? '');
  useEffect(() => {
    const key = barcode ?? '';
    if (key !== seenKeyRef.current) {
      seenKeyRef.current = key;
      setEditing(false);
      setDraft('');
      setInvalid(false);
      setActive(overlay || fromRecord || null);
      setAnalysisSource(overlay ? overlayAnalysisSource : (fromRecord ? initialSource ?? 'provider' : 'unknown'));
      setAnalysisReviewed(overlayReviewed ?? (fromRecord ? initialReviewed ?? true : false));
      setSaved(false);
      setLookupStatus('idle');
      setLocalForm(form ?? inferProductForm(category, name));
      return;
    }
    if (overlay) {
      setActive((current) => current === overlay ? current : overlay);
      setAnalysisSource(overlayAnalysisSource);
      setAnalysisReviewed(overlayReviewed === true);
      setLookupStatus('idle');
      return;
    }
    // Same barcode but the record just gained an INCI list (e.g. the
    // accordion's vendor fallback resolved while the panel was already open).
    if (fromRecord) {
      setActive((current) => current === fromRecord ? current : fromRecord);
      setAnalysisSource(initialSource ?? 'provider');
      setAnalysisReviewed(initialReviewed ?? true);
      setLookupStatus('idle');
    }
  }, [
    barcode,
    category,
    form,
    fromRecord,
    initialReviewed,
    initialSource,
    name,
    overlay,
    overlayAnalysisSource,
    overlayReviewed,
  ]);

  /** Activate an ingredient text (manual, OCR or vendor fallback) and
   *  remember it per barcode. Also tells the parent so the account-scoped
   *  catalog copy can be written on confirm. */
  const adopt = (text: string, source: 'manual' | 'ocr' | 'remote' = 'manual') => {
    const normalizedText = text.trim();
    if (!normalizedText || normalizedText.length > MAX_INGREDIENT_TEXT_LENGTH) {
      setInvalid(true);
      return;
    }
    setActive(normalizedText);
    setAnalysisSource(source === 'manual' ? 'paste' : source === 'remote' ? 'provider' : 'ocr');
    setAnalysisReviewed(true);
    setEditing(false);
    if (barcode && source !== 'remote') {
      setSaved(writeInciOverlayEntry(barcode, normalizedText, accountId, { source, reviewed: true }));
    } else {
      setSaved(false);
    }
    onIngredientsRef.current?.(normalizedText, { source, reviewed: true });
  };

  // ---- Missing-INCI external fallback --------------------------------------
  // When the record has no ingredient text, ask the app's own key-gated route
  // for the provider's barcode→INCI answer. Fail-open and non-blocking: the
  // paste + OCR fallbacks stay visible underneath, so a slow/no/absent key
  // never wedges the scan step.
  useEffect(() => {
    if (!barcode || active) {
      setLookupStatus('idle');
      return;
    }
    let cancelled = false;
    const controller = new AbortController();
    setLookupStatus('looking');
    lookupInciForBarcode(barcode, { signal: controller.signal })
      .then((result) => {
        if (cancelled) return;
        if (result.kind === 'found') {
          adopt(result.ingredientsText, 'remote');
          setLookupStatus('idle');
        } else {
          setLookupStatus(result.kind === 'not-found' ? 'not-found' : 'failed');
        }
      })
      .catch(() => {
        if (!cancelled) setLookupStatus('failed');
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [accountId, barcode, active, lookupNonce]); // eslint-disable-line react-hooks/exhaustive-deps

  const openEditor = () => {
    setDraft(active ?? '');
    setInvalid(false);
    setEditing(true);
  };

  const submit = () => {
    const text = draft.trim();
    if (text.length < 2 || text.length > MAX_INGREDIENT_TEXT_LENGTH || splitInciList(text).length === 0) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    adopt(text);
  };

  const clearSaved = () => {
    if (!barcode) return;
    removeInciOverlayEntry(barcode, accountId);
    setSaved(false);
    setActive(null);
    setAnalysisSource('unknown');
    setAnalysisReviewed(false);
    setEditing(false);
    setDraft('');
    onIngredientsRef.current?.(undefined);
  };

  // The active text came from this device's per-barcode memory — either on
  // mount (repeat scan) or because the user just pasted and it was saved.
  const fromOverlay =
    active !== null && (saved || (!fromRecord && overlay === active));

  return (
    <div className="mt-3 rounded-2xl border border-outline-variant bg-surface/70 p-3 md:p-3.5">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 font-label-md text-label-md font-semibold text-on-surface">
          <AppIcon name="science" className="size-4 text-primary" />
          {g.title}
        </p>
        {active && !editing && (
          <button
            type="button"
            onClick={openEditor}
            className="flex items-center gap-1 font-label-sm text-label-sm text-on-surface-variant hover:text-on-surface transition-colors"
          >
            <AppIcon name="edit" className="size-3.5" />
            {im.editIngredients}
          </button>
        )}
      </div>

      <label className="mt-2 flex flex-wrap items-center gap-2 font-label-sm text-label-sm text-on-surface-variant">
        <span>{g.formLabel}</span>
        <select
          value={effectiveForm}
          onChange={(event) => {
            const next = event.target.value as ProductForm;
            setLocalForm(next);
            onFormChange?.(next);
          }}
          className="rounded-lg border border-outline-variant bg-surface px-2 py-1 text-on-surface"
        >
          <option value="unknown">{g.formUnknown}</option>
          <option value="leave-on">{g.formLeaveOn}</option>
          <option value="rinse-off">{g.formRinseOff}</option>
        </select>
      </label>

      {active && !editing ? (
        <>
          <div className="mt-2">
            <CoursesIngredientGlance
              ingredientsText={active}
              label={name}
              category={category}
              form={effectiveForm}
              source={analysisSource}
              reviewed={analysisReviewed}
              embedded
            />
          </div>
          {fromOverlay && (
            <p className="mt-1.5 flex items-center gap-1.5 font-label-sm text-label-sm text-on-surface-variant">
              <AppIcon name="save" className="size-3.5" />
              {im.savedNote}
              <button
                type="button"
                onClick={clearSaved}
                className="ms-auto font-label-sm text-label-sm text-on-surface-variant underline hover:text-on-surface"
              >
                {messages.common.remove}
              </button>
            </p>
          )}
        </>
      ) : active === null && !editing ? (
        <div className="mt-2">
          {lookupStatus === 'looking' && (
            <p className="flex items-center gap-1.5 font-body-sm text-body-sm text-tertiary">
              <AppIcon name="hourglass_top" className="size-3.5 animate-spin" />
              {im.lookingUp}
            </p>
          )}
          {lookupStatus === 'not-found' && (
            <p className="flex items-start gap-1.5 font-body-sm text-body-sm text-on-surface-variant">
              <AppIcon name="search_off" className="mt-0.5 size-3.5 shrink-0" />
              {im.lookupNotFound}
            </p>
          )}
          {lookupStatus === 'failed' && (
            <p className="flex items-center gap-1.5 font-body-sm text-body-sm text-on-surface-variant">
              <AppIcon name="cloud_off" className="size-3.5 shrink-0" />
              {im.lookupFailed}
              <button
                type="button"
                onClick={() => setLookupNonce((v) => v + 1)}
                className="ms-auto inline-flex items-center gap-1 rounded-full border border-outline-variant px-2.5 py-1 font-label-sm text-label-sm text-primary hover:bg-surface-container-high transition-colors"
              >
                <AppIcon name="refresh" className="size-3.5" />
                {im.retryLookup}
              </button>
            </p>
          )}
          <p className="flex items-start gap-1.5 font-body-sm text-body-sm text-on-surface-variant">
            <AppIcon name="info" className="mt-0.5 size-3.5 shrink-0" />
            {im.missingHint}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={openEditor}
              className="inline-flex items-center gap-1.5 rounded-full border border-outline-variant bg-surface px-3 py-1.5 font-label-md text-label-md text-primary hover:bg-surface-container-high transition-colors"
            >
              <AppIcon name="edit" className="size-4" />
              {im.pasteCta}
            </button>
            {/* No INCI on the scanned product? Photograph the label — the OCR
                runs on-device and the recognised list is analysed directly. */}
            <LabelOcrButton
              productKey={`${barcode ?? 'manual'}\u0001${name ?? ''}`}
              mode="inci"
              onText={(text) => adopt(text, 'ocr')}
            />
          </div>
        </div>
      ) : (
        <div className="mt-2">
          <textarea
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              if (invalid) setInvalid(false);
            }}
            placeholder={im.pastePlaceholder}
            rows={4}
            maxLength={MAX_INGREDIENT_TEXT_LENGTH}
            autoFocus
            className="w-full resize-y rounded-xl border border-outline-variant bg-surface px-3 py-2 font-body-sm text-body-sm text-on-surface outline-none focus:border-primary"
            aria-label={im.pastePlaceholder}
          />
          <p className="mt-1 font-label-sm text-label-sm text-on-surface-variant">{im.pasteHelp}</p>
          {invalid && (
            <p className="mt-1 font-label-sm text-label-sm text-error">{im.pasteInvalid}</p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={submit}
              className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 font-label-md text-label-md text-on-primary hover:opacity-90 transition-opacity"
            >
              <AppIcon name="check" className="size-4" />
              {im.checkCta}
            </button>
            {active && (
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="rounded-full px-3 py-1.5 font-label-md text-label-md text-on-surface-variant hover:text-on-surface"
              >
                {messages.common.cancel}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
