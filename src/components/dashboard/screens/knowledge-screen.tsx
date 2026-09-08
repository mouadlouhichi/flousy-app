'use client';

import { useState } from 'react';
import { AppIcon } from '@/components/ui/app-icon';
import { useDashboard } from '../dashboard-provider';
import { useHousehold } from '@/lib/household-context';
import { useLanguage } from '@/lib/i18n-context';
import { isProFeatureUnlocked } from '@/lib/household';
import { normalizeBarcode, resolveProduct } from '@/lib/course-session';
import { lookupMaSeed } from '@/lib/ma-product-seed';
import { lookupOffProduct } from '@/lib/product-lookup';
import { detectLabelDomain } from '@/lib/food-knowledge/domain';
import { CoursesScannerPanel } from '../courses/courses-scanner-panel';
import { CoursesScanUpsell } from '../courses/courses-scan-upsell';
import { CoursesIngredientPanel } from '../courses/courses-ingredient-panel';
import { CoursesFoodPanel } from '../courses/courses-food-panel';
import { saveProduct } from '@/lib/db';
import { isFirebaseConfigured } from '@/lib/firebase';
import type { Product } from '@/lib/store';

/**
 * "Ingredient knowledge" standalone screen — scan (or type) any barcode and
 * get the domain-aware label-knowledge panel (cosmetic INCI score for beauty
 * products, food ingredient knowledge otherwise), outside of a shopping
 * course. The label paste box below always works (no Pro needed) so a label
 * photo/typing session never requires a scan.
 */
export function KnowledgeScreen() {
  const { user, isPro, openProModal } = useDashboard();
  const { messages: m, intlLocale } = useLanguage();
  const g = m.labelKnowledge;
  const { workspace, household } = useHousehold();
  const scanUnlocked = isProFeatureUnlocked(isPro, workspace, household);

  const [code, setCode] = useState('');
  const [invalid, setInvalid] = useState(false);
  const [lookup, setLookup] = useState<
    | { status: 'idle' }
    | { status: 'loading' }
    | { status: 'found'; product: RemoteLike }
    | { status: 'not-found'; barcode: string }
    | { status: 'failed'; barcode: string }
  >({ status: 'idle' });
  const [saved, setSaved] = useState(false);

  const run = async (raw: string) => {
    const { barcode } = normalizeBarcode(raw);
    if (!barcode) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    setCode(barcode);
    setSaved(false);
    setLookup({ status: 'loading' });
    const resolution = await resolveProduct({
      barcode,
      catalog: [],
      lookupSeed: lookupMaSeed,
      lookupRemote: (code, lang) => lookupOffProduct(code, lang ? { lang } : undefined),
    });
    if (resolution.kind === 'found') {
      setLookup({ status: 'found', product: { ...resolution.product, barcode } });
    } else if (resolution.reason === 'lookup-failed') {
      setLookup({ status: 'failed', barcode });
    } else {
      setLookup({ status: 'not-found', barcode });
    }
  };

  const remember = async (product: RemoteLike) => {
    if (!user?.uid || !product.barcode || saved) return;
    const nowIso = new Date().toISOString();
    const entry: Product = {
      barcode: product.barcode,
      name: product.name,
      ...(product.brand ? { brand: product.brand } : {}),
      ...(product.category ? { category: product.category } : {}),
      ...(product.imageUrl ? { imageUrl: product.imageUrl } : {}),
      ...(product.ingredientsText ? { ingredientsText: product.ingredientsText } : {}),
      ...(product.beauty ? { beauty: true } : {}),
      source: 'off',
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    await saveProduct(user.uid, entry);
    setSaved(true);
  };

  const product = lookup.status === 'found' ? lookup.product : undefined;
  const domain = product
    ? product.beauty
      ? 'cosmetic'
      : detectLabelDomain({
          category: product.category,
          name: product.name,
          ingredientsText: product.ingredientsText,
        })
    : 'food';

  return (
    <div className="space-y-4 p-4 md:p-6">
      <header>
        <h1 className="font-headline-lg text-headline-lg text-on-surface">
          {m.navigation.knowledgeTitle}
        </h1>
        <p className="mt-1 max-w-xl font-body-md text-body-md text-on-surface-variant">
          {g.noBarcodeHint}
        </p>
      </header>

      {scanUnlocked ? (
        <div className="rounded-3xl border border-outline-variant bg-surface-container-low p-4 md:p-5">
          <CoursesScannerPanel enabled onCode={run} />
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run(code);
            }}
            className="mt-4"
          >
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                value={code}
                onChange={(e) => {
                  setCode(e.target.value);
                  if (invalid) setInvalid(false);
                }}
                inputMode="numeric"
                autoComplete="off"
                dir="ltr"
                placeholder={g.codePlaceholder}
                aria-label={g.codePlaceholder}
                className="min-w-0 flex-1 rounded-2xl border border-outline-variant bg-surface px-4 py-3 font-body-md text-body-md text-on-surface outline-none focus:border-primary"
              />
              <button
                type="submit"
                disabled={lookup.status === 'loading'}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 font-label-md text-label-md text-on-primary hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                <AppIcon name="search" className="size-4" />
                {g.lookupCta}
              </button>
            </div>
            {invalid && (
              <p className="mt-2 font-label-sm text-label-sm text-rose-600 dark:text-rose-400">
                {m.courses.codeInvalid}
              </p>
            )}
          </form>
        </div>
      ) : (
        <CoursesScanUpsell onUpgrade={openProModal} />
      )}

      {lookup.status === 'loading' && (
        <p className="flex items-center gap-2 rounded-3xl border border-outline-variant bg-surface-container-low p-5 font-body-md text-body-md text-on-surface-variant">
          <AppIcon name="search" className="animate-pulse size-5 text-primary" />
          {m.common.loading}
        </p>
      )}

      {product && (
        <div className="overflow-hidden rounded-3xl border border-outline-variant bg-surface-container-low">
          <div className="flex items-start gap-4 p-4 md:p-5">
            {product.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={product.imageUrl}
                alt=""
                className="h-20 w-20 shrink-0 rounded-2xl border border-outline-variant bg-surface object-cover"
              />
            ) : (
              <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
                <AppIcon name="package_2" className="size-8 text-primary" />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate font-headline-sm text-headline-sm text-on-surface">{product.name}</p>
                <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 font-label-sm text-label-sm text-primary">
                  {domain === 'cosmetic' ? g.kindCosmetic : g.kindFood}
                </span>
              </div>
              {product.brand && (
                <p className="mt-0.5 truncate font-body-sm text-body-sm text-on-surface-variant">{product.brand}</p>
              )}
              {product.category && (
                <p className="truncate font-label-sm text-label-sm text-on-surface-variant">{product.category}</p>
              )}
              {product.barcode && (
                <p className="mt-0.5 font-label-sm text-label-sm text-on-surface-variant" dir="ltr">
                  {product.barcode}
                </p>
              )}
              {user?.uid && (
                <button
                  type="button"
                  onClick={() => void remember(product)}
                  disabled={saved || !isFirebaseConfigured}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-outline-variant px-3 py-1.5 font-label-sm text-label-sm text-primary hover:bg-surface-container-high disabled:opacity-50 transition-colors"
                >
                  <AppIcon name={saved ? 'check_circle' : 'bookmark_add'} className="size-4" />
                  {saved ? g.saved : g.saveProduct}
                </button>
              )}
            </div>
          </div>

          {domain === 'cosmetic' ? (
            <div className="px-4 pb-4 md:px-5 md:pb-5">
              <CoursesIngredientPanel
                barcode={product.barcode}
                initialText={product.ingredientsText}
                name={product.name}
                category={product.category}
                onIngredientsText={(text) =>
                  setLookup((prev) =>
                    prev.status === 'found'
                      ? { status: 'found', product: { ...prev.product, ingredientsText: text } }
                      : prev,
                  )
                }
              />
            </div>
          ) : (
            <div className="px-4 pb-4 md:px-5 md:pb-5">
              <CoursesFoodPanel
                barcode={product.barcode}
                initialText={product.ingredientsText}
                name={product.name}
                category={product.category}
              />
            </div>
          )}
        </div>
      )}

      {(lookup.status === 'not-found' || lookup.status === 'failed') && (
        <div className="rounded-3xl border border-outline-variant bg-surface-container-low p-4 md:p-5">
          <div className="flex items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
              <AppIcon name="search_off" className="size-5 text-primary" />
            </span>
            <div>
              <h3 className="font-headline-sm text-headline-sm text-on-surface">{g.notFoundTitle}</h3>
              <p className="mt-0.5 font-body-sm text-body-sm text-on-surface-variant">
                {g.notFoundHint}
              </p>
            </div>
          </div>
          <div className="mt-4 rounded-2xl border border-dashed border-outline-variant p-3">
            <p className="px-1 font-label-sm text-label-sm text-on-surface-variant">{g.pasteNote}</p>
            <CoursesFoodPanel
              barcode={lookup.status === 'not-found' ? lookup.barcode : undefined}
              name={undefined}
              category={undefined}
            />
          </div>
        </div>
      )}

      {lookup.status === 'idle' && !scanUnlocked && (
        <div className="rounded-3xl border border-dashed border-outline-variant bg-surface-container-low p-4 md:p-5">
          <p className="px-1 font-label-sm text-label-sm text-on-surface-variant">{g.pasteNote}</p>
          <CoursesFoodPanel name={undefined} category={undefined} />
        </div>
      )}
    </div>
  );
}

type RemoteLike = {
  name: string;
  brand?: string;
  category?: string;
  imageUrl?: string;
  barcode?: string;
  ingredientsText?: string;
  beauty?: boolean;
};
