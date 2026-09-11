'use client';

import { useEffect, useRef, useState } from 'react';
import { AppIcon } from '@/components/ui/app-icon';
import { useDashboard } from '../dashboard-provider';
import { useHousehold } from '@/lib/household-context';
import { useLanguage } from '@/lib/i18n-context';
import { isProFeatureUnlocked } from '@/lib/household';
import { lookupMaSeed } from '@/lib/ma-product-seed';
import { lookupOffProduct } from '@/lib/product-lookup';
import { resolveScan, type ResolvedProduct } from '@/lib/scan-resolution';
import type { BarcodeCandidate } from '@/lib/gtin';
import type { Product, ProductSource } from '@/lib/store';
import { CoursesScannerPanel } from '../courses/courses-scanner-panel';
import { CoursesScanUpsell } from '../courses/courses-scan-upsell';
import { CoursesIngredientPanel } from '../courses/courses-ingredient-panel';
import { CoursesFoodPanel } from '../courses/courses-food-panel';
import { useCourseSession } from '@/hooks/use-course-session';
import { saveProduct } from '@/lib/db';
import { isFirebaseConfigured } from '@/lib/firebase';

type LookupState =
  | { status: 'idle' }
  | { status: 'loading'; code: string }
  | { status: 'found'; product: ResolvedProduct; stale: boolean }
  | { status: 'not-found'; barcode: string }
  | { status: 'failed'; barcode: string };

export function KnowledgeScreen() {
  const { user, isPro, openProModal } = useDashboard();
  const { messages: m, language } = useLanguage();
  const g = m.labelKnowledge;
  const { workspace, household } = useHousehold();
  const scanUnlocked = isProFeatureUnlocked(isPro, workspace, household);
  const courseStore = useCourseSession(user?.uid ?? null);

  const [lookup, setLookup] = useState<LookupState>({ status: 'idle' });
  const [invalid, setInvalid] = useState(false);
  const [saved, setSaved] = useState(false);
  const requestIdRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const run = async (candidate: BarcodeCandidate) => {
    const requestId = ++requestIdRef.current;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setInvalid(false);
    setSaved(false);
    setLookup({ status: 'loading', code: candidate.rawValue });

    const resolution = await resolveScan({
      candidate,
      catalog: courseStore.catalog,
      lang: language,
      lookupSeed: lookupMaSeed,
      lookupRemote: (barcode, options) => lookupOffProduct(barcode, options),
      signal: controller.signal,
    });
    if (requestId !== requestIdRef.current || controller.signal.aborted) return;
    if (resolution.kind === 'invalid') {
      setInvalid(true);
      setLookup({ status: 'idle' });
      return;
    }
    if (resolution.kind === 'found') {
      setLookup({ status: 'found', product: resolution.product, stale: resolution.stale });
      if (resolution.revalidate) {
        const refreshed = await resolution.revalidate.catch(() => null);
        if (refreshed && requestId === requestIdRef.current && !controller.signal.aborted) {
          setLookup({ status: 'found', product: refreshed, stale: false });
        }
      }
      return;
    }
    if (resolution.kind === 'restricted-circulation') {
      setLookup({ status: 'not-found', barcode: resolution.canonical.gtin });
      return;
    }
    setLookup(resolution.reason === 'not-found'
      ? { status: 'not-found', barcode: resolution.canonical.gtin }
      : { status: 'failed', barcode: resolution.canonical.gtin });
  };

  const remember = async (product: ResolvedProduct) => {
    if (!user?.uid || saved) return;
    const now = new Date().toISOString();
    const entry: Product = {
      barcode: product.barcode,
      gtin14: product.gtin14,
      name: product.name,
      ...(product.brand ? { brand: product.brand } : {}),
      ...(product.category ? { category: product.category } : {}),
      ...(product.imageUrl ? { imageUrl: product.imageUrl } : {}),
      ...(product.quantity ? { quantity: product.quantity } : {}),
      ...(product.ingredientsText ? { ingredientsText: product.ingredientsText } : {}),
      ...(product.ranking ? { ranking: product.ranking } : {}),
      ...(product.allergenTags ? { allergenTags: product.allergenTags } : {}),
      ...(product.cosmeticForm ? { cosmeticForm: product.cosmeticForm } : {}),
      ...(product.domain === 'cosmetic' ? { beauty: true } : {}),
      domain: product.domain,
      domainSource: product.domainSource,
      source: product.source,
      sourceUrl: product.sourceUrl,
      sourceDatabase: product.sourceDatabase,
      provenance: { ...product.provenance },
      retrievedAt: product.retrievedAt,
      staleAfter: product.staleAfter,
      createdAt: now,
      updatedAt: now,
    };
    await saveProduct(user.uid, entry);
    courseStore.upsertProduct(entry);
    setSaved(true);
  };

  const product = lookup.status === 'found' ? lookup.product : null;
  // Scanned products route from source/inferred resolution metadata. A manual
  // paste (idle or unresolved barcode) keeps the previous food-label default;
  // an explicitly unresolved scanned domain stays unresolved rather than
  // being guessed from a database name.
  const selectedDomain = product?.domain ?? 'food';
  const unresolvedBarcode = lookup.status === 'not-found' || lookup.status === 'failed'
    ? lookup.barcode
    : undefined;

  return (
    <div className="space-y-4 p-4 md:p-6">
      <header>
        <h1 className="font-headline-lg text-headline-lg text-on-surface">{m.navigation.knowledgeTitle}</h1>
        <p className="mt-1 max-w-xl font-body-md text-body-md text-on-surface-variant">{g.noBarcodeHint}</p>
      </header>

      {scanUnlocked ? (
        <CoursesScannerPanel
          enabled={lookup.status === 'idle'}
          onCode={(candidate) => void run(candidate)}
        />
      ) : (
        <CoursesScanUpsell onUpgrade={openProModal} />
      )}

      {invalid && (
        <p className="rounded-2xl border border-tertiary/30 bg-tertiary-container/30 p-3 font-label-sm text-label-sm text-tertiary">
          {m.courses.codeInvalid}
        </p>
      )}

      {lookup.status === 'loading' && (
        <p className="flex items-center gap-2 rounded-3xl border border-outline-variant bg-surface-container-low p-5 font-body-md text-body-md text-on-surface-variant">
          <AppIcon name="search" className="size-5 animate-pulse text-primary" />
          {m.common.loading} <span dir="ltr" className="font-code">{lookup.code}</span>
        </p>
      )}

      {(product || unresolvedBarcode || lookup.status === 'idle') && (
        <section className="space-y-4 rounded-3xl border border-outline-variant bg-surface-container-low p-4 md:p-5">
          {product && (
            <div className="flex items-start gap-4">
              {product.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={product.imageUrl} alt="" className="h-20 w-20 shrink-0 rounded-2xl border border-outline-variant bg-surface object-cover" />
              ) : (
                <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
                  <AppIcon name="package_2" className="size-8 text-primary" />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-headline-sm text-headline-sm text-on-surface">{product.name}</p>
                {product.brand && <p className="truncate font-body-sm text-body-sm text-on-surface-variant">{product.brand}</p>}
                {product.category && <p className="truncate font-label-sm text-label-sm text-on-surface-variant">{product.category}</p>}
                <p dir="ltr" className="font-label-sm text-label-sm text-on-surface-variant">{product.barcode}</p>
                <p className="font-label-sm text-label-sm text-on-surface-variant">
                  {product.source}{lookup.status === 'found' && lookup.stale ? ' · cached, refreshing' : ''}
                </p>
              </div>
            </div>
          )}

          {!product && unresolvedBarcode && (
            <div className="flex items-center gap-3">
              <AppIcon name={lookup.status === 'failed' ? 'cloud_off' : 'search_off'} className="size-6 text-tertiary" />
              <div>
                <h2 className="font-headline-sm text-headline-sm text-on-surface">{g.notFoundTitle}</h2>
                <p className="font-body-sm text-body-sm text-on-surface-variant">{g.notFoundHint}</p>
                <p dir="ltr" className="font-code text-sm text-on-surface-variant">{unresolvedBarcode}</p>
              </div>
            </div>
          )}

          <p className="font-label-md text-label-md text-on-surface-variant">{g.pasteNote}</p>

          {selectedDomain === 'cosmetic' ? (
            <CoursesIngredientPanel
              barcode={product?.barcode ?? unresolvedBarcode}
              initialText={product?.ingredientsText}
              initialSource={product?.provenance?.ingredientsText?.source === 'ocr'
                ? 'ocr'
                : product?.provenance?.ingredientsText?.source === 'manual'
                  ? 'paste'
                  : 'provider'}
              initialReviewed={Boolean(product?.ingredientsText)}
              name={product?.name}
              category={product?.category}
              form={product?.cosmeticForm}
              onFormChange={(form) => {
                setSaved(false);
                setLookup((previous) => previous.status === 'found'
                  ? {
                      ...previous,
                      product: {
                        ...previous.product,
                        cosmeticForm: form,
                        provenance: {
                          ...previous.product.provenance,
                          cosmeticForm: { source: 'manual', retrievedAt: new Date().toISOString() },
                        },
                      },
                    }
                  : previous);
              }}
              onIngredientsText={(text, metadata) => {
                setSaved(false);
                setLookup((previous) => {
                  if (previous.status !== 'found') return previous;
                  const provenance = { ...previous.product.provenance };
                  if (text) {
                    const source: ProductSource = metadata?.source === 'ocr'
                      ? 'ocr'
                      : metadata?.source === 'remote'
                        ? 'vendor'
                        : 'manual';
                    provenance.ingredientsText = { source, retrievedAt: new Date().toISOString() };
                  } else {
                    delete provenance.ingredientsText;
                  }
                  return {
                    ...previous,
                    product: { ...previous.product, ingredientsText: text, provenance },
                  };
                });
              }}
            />
          ) : selectedDomain === 'food' ? (
            <CoursesFoodPanel
              barcode={product?.barcode ?? unresolvedBarcode}
              initialText={product?.ingredientsText}
              name={product?.name}
              category={product?.category}
              offAllergenTags={product?.allergenTags}
            />
          ) : selectedDomain === 'household' || selectedDomain === 'pet' ? (
            <div className="rounded-2xl border border-dashed border-outline-variant p-4 font-body-md text-body-md text-on-surface-variant">
              {g.unsupportedDomain}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-outline-variant p-4 font-body-md text-body-md text-on-surface-variant">
              {g.unknownDomainHint}
            </div>
          )}

          <div className="flex flex-wrap justify-end gap-2">
            {lookup.status !== 'idle' && (
              <button
                type="button"
                onClick={() => {
                  abortRef.current?.abort();
                  requestIdRef.current += 1;
                  setLookup({ status: 'idle' });
                }}
                className="rounded-full border border-outline-variant px-4 py-2 font-label-md text-label-md text-on-surface-variant"
              >
                {m.barcode.scanAnother}
              </button>
            )}
            {product && user?.uid && (
              <button
                type="button"
                onClick={() => void remember(product)}
                disabled={saved || !isFirebaseConfigured}
                className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 font-label-md text-label-md text-on-primary disabled:opacity-50"
              >
                <AppIcon name={saved ? 'check_circle' : 'bookmark_add'} className="size-4" />
                {saved ? g.saved : g.saveProduct}
              </button>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
