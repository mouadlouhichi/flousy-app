'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AppIcon } from '@/components/ui/app-icon';
import { useLanguage } from '@/lib/i18n-context';
import { detectLabelDomain, isCosmeticRecord } from '@/lib/food-knowledge/domain';
import { analyzeFoodIngredientList, analyzeFoodText } from '@/lib/food-knowledge/analyze';
import { additiveGrade } from '@/lib/food-knowledge/grade';
import type { FoodAnalysis } from '@/lib/food-knowledge/types';
import { analyzeIngredientsText } from '@/lib/ingredient-analysis-client';
import { readInciOverlayEntry } from '@/lib/ingredient-device-store';
import { lookupInciForBarcode } from '@/lib/ingredient-lookup-client';
import type { Band, ProductAssessment } from '@/lib/ingredient-safety/types';
import {
  BAND_LABEL_KEY,
  BAND_STYLE,
} from './courses-ingredient-glance';
import { CoursesIngredientPanel } from './courses-ingredient-panel';
import { CoursesFoodPanel } from './courses-food-panel';
import { ScoreRing } from './courses-score-ring';

/**
 * Collapsible "Label & ingredients" section of the pending-product card.
 *
 * The trigger carries a live preview so the card explains WHY it is worth
 * opening without sacrificing the price step:
 *  - cosmetics: the same band-colored score ring as the glance + band label;
 *  - food: an additive-grade ring (EU additive data — informational, never a
 *    health score), or a droplet when the product is a water (no ingredient
 *    list — mineral composition instead).
 * The matching panel (INCI glance / food-knowledge) mounts only when opened.
 * Collapsed by default and reset per scanned product.
 */

interface CoursesLabelAccordionProps {
  barcode?: string;
  name?: string;
  category?: string;
  ingredientsText?: string;
  /** Source hint that the record is cosmetic/beauty even when name/category
   *  are too generic to say so (e.g. a code-like shower-gel name). */
  beauty?: boolean;
  /** Manual-entry products have no name to classify yet. */
  needsName?: boolean;
  /** Panel adopted a new ingredient list (external fallback / paste / OCR). */
  onIngredientsText?: (text: string) => void;
}

export function CoursesLabelAccordion({
  barcode,
  name,
  category,
  ingredientsText,
  beauty,
  needsName,
  onIngredientsText,
}: CoursesLabelAccordionProps) {
  const { messages, t } = useLanguage();
  const c = messages.courses;
  const ig = messages.ingredientGlance;
  const im = messages.ingredientManual;
  const fg = messages.foodKnowledge;

  const [open, setOpen] = useState(false);
  const [seenKey, setSeenKey] = useState('');
  const [fallbackText, setFallbackText] = useState('');
  const [fallbackLookup, setFallbackLookup] = useState<'idle' | 'looking' | 'done' | 'failed'>('idle');
  const onIngredientsRef = useRef(onIngredientsText);
  onIngredientsRef.current = onIngredientsText;
  const productKey = `${barcode ?? ''}\u0001${ingredientsText ?? ''}`;
  useEffect(() => {
    if (seenKey !== productKey) {
      setSeenKey(productKey);
      setOpen(false);
      setFallbackText('');
      setFallbackLookup('idle');
    }
  }, [productKey, seenKey]);

  const labelName = needsName ? undefined : name;
  const detectedDomain = beauty
    ? 'cosmetic'
    : detectLabelDomain({
        category,
        name: labelName,
        ingredientsText,
      });

  // Some OFF records carry a code-like name and only the placeholder category
  // chain ("Incorrect product type / non-food-products / open-beauty-facts").
  // Treat those as cosmetic candidates so the INCI fallback (and, on failure,
  // the paste/OCR path) is offered instead of a misleading food panel.
  const likelyCosmetic = isCosmeticRecord({
    beauty,
    category,
    name: labelName,
    ingredientsText,
  });
  const domain = likelyCosmetic ? 'cosmetic' : detectedDomain;

  // The cosmetic engine may read a per-barcode INCI saved on this device.
  const overlayText = barcode ? readInciOverlayEntry(barcode) ?? '' : '';
  const hasInci = Boolean(ingredientsText?.trim() || overlayText.trim() || fallbackText.trim());
  const cosmeticText = (ingredientsText?.trim() || overlayText.trim() || fallbackText.trim()).trim();

  // ---- Missing-INCI risk fallback (collapsed-preview friendly) ------------
  // Run as soon as a cosmetic candidate barcode resolves with no provider
  // text, so the score ring (not just the expanded panel) benefits from the
  // external list. The same client cache/in-flight map keeps this and the
  // panel's own lookup to a single provider request.
  useEffect(() => {
    if (!likelyCosmetic || !barcode || hasInci) {
      setFallbackLookup('idle');
      return;
    }
    let cancelled = false;
    setFallbackLookup('looking');
    lookupInciForBarcode(barcode)
      .then((result) => {
        if (cancelled) return;
        if (result.kind === 'found') {
          setFallbackText(result.ingredientsText);
          setFallbackLookup('done');
          onIngredientsRef.current?.(result.ingredientsText);
        } else {
          setFallbackLookup(result.kind === 'not-found' ? 'done' : 'failed');
        }
      })
      .catch(() => {
        if (!cancelled) setFallbackLookup('failed');
      });
    return () => {
      cancelled = true;
    };
  }, [likelyCosmetic, barcode, hasInci]);

  // ---- Cosmetic score-ring preview (fetched while the card is collapsed) ----
  const [cosmetic, setCosmetic] = useState<{
    key: string;
    analysis?: ProductAssessment;
    failed?: boolean;
  }>({ key: '' });

  // Track the text currently requested separately from `cosmetic.key`.
  // Using `cosmetic.key` in the effect deps makes the first `setCosmetic`
  // (which sets key to the text) trigger the effect's own cleanup and cancel
  // the in-flight request before it resolves.
  const requestedCosmeticRef = useRef('');
  useEffect(() => {
    if (domain !== 'cosmetic' || !cosmeticText) return;
    if (requestedCosmeticRef.current === cosmeticText) return;
    requestedCosmeticRef.current = cosmeticText;
    let cancelled = false;
    setCosmetic({ key: cosmeticText });
    analyzeIngredientsText(cosmeticText, {
      ...(labelName ? { label: labelName } : {}),
      ...(category ? { category } : {}),
    })
      .then((analysis) => {
        if (!cancelled) setCosmetic({ key: cosmeticText, analysis });
      })
      .catch(() => {
        if (!cancelled) setCosmetic({ key: cosmeticText, failed: true });
      });
    return () => {
      cancelled = true;
    };
  }, [domain, cosmeticText, labelName, category]);

  const cosmeticAnalysis =
    cosmetic.key === cosmeticText ? cosmetic.analysis : undefined;

  // ---- Food hook preview (deterministic local analysis, no network) ---------
  const foodPreview = useMemo<FoodAnalysis | null>(() => {
    if (domain === 'cosmetic') return null;
    const foodText = ingredientsText?.trim() ?? '';
    const opts = {
      ...(labelName ? { label: labelName } : {}),
      ...(category ? { category } : {}),
    };
    if (foodText) return analyzeFoodText(foodText, opts);
    // A barcode water has no ingredient text; classify kind from metadata.
    if (labelName || category) return analyzeFoodIngredientList([], opts);
    return null;
  }, [domain, ingredientsText, labelName, category]);

  const showKnowledge = Boolean(barcode || ingredientsText?.trim());
  if (!showKnowledge) return null;

  // Food: additive-grade ring (deterministic, local, informational). Waters
  // keep their droplet — they have no ingredient list to grade.
  const foodGrade = domain !== 'cosmetic' ? additiveGrade(foodPreview) : null;

  // Narrowed view of the analysis: only defined when a score + band exist.
  const readyCosmetic =
    cosmeticAnalysis &&
    cosmeticAnalysis.score !== null &&
    cosmeticAnalysis.band !== null
      ? (cosmeticAnalysis as ProductAssessment & { score: number; band: Band })
      : undefined;
  const scoreUnknown =
    domain === 'cosmetic' &&
    cosmeticText &&
    cosmeticAnalysis &&
    (cosmeticAnalysis.score === null || cosmeticAnalysis.band === null);

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="pending-label-knowledge"
        className="flex min-h-12 w-full items-center justify-between gap-2.5 rounded-xl border border-outline-variant bg-surface/40 px-3.5 py-2 font-label-md text-label-md font-semibold text-on-surface transition-colors hover:bg-surface/70"
      >
        <span className="flex min-w-0 items-center gap-2.5">
          <AppIcon
            name={domain === 'cosmetic' ? 'science' : 'menu_book'}
            className="size-5 shrink-0 text-primary"
          />
          <span className="truncate">{c.labelInfo}</span>
        </span>

        <span className="flex shrink-0 items-center gap-2.5">
          {/* Cosmetic: Yuka-style score ring (arc = score/100, colour = band).
              Always rendered — while the analysis is loading/failed it stays
              as an "unknown" risk ring so the trigger never loses its badge. */}
          {domain === 'cosmetic' &&
            cosmeticText &&
            (readyCosmetic ? (
              <>
                <ScoreRing
                  score={readyCosmetic.score}
                  band={readyCosmetic.band}
                  label={`${readyCosmetic.score}/100 — ${t(ig[BAND_LABEL_KEY[readyCosmetic.band]])}`}
                  toneClass={BAND_STYLE[readyCosmetic.band].text}
                />
                <span
                  className={`hidden font-label-sm text-label-sm font-semibold sm:inline ${BAND_STYLE[readyCosmetic.band].text}`}
                >
                  {t(ig[BAND_LABEL_KEY[readyCosmetic.band]])}
                </span>
              </>
            ) : (
              <ScoreRing
                unknown
                label={cosmetic.failed ? ig.unavailable : scoreUnknown ? ig.scoreUnknown : ig.analyzing}
                toneClass="text-on-surface-variant"
              />
            ))}

          {/* Missing INCI: show that the external fallback is running / failed */}
          {domain === 'cosmetic' && barcode && !cosmeticText && fallbackLookup === 'looking' && (
            <span
              title={im.lookingUp}
              className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-container-high"
            >
              <AppIcon name="hourglass_top" className="size-4 animate-spin text-primary" />
            </span>
          )}
          {domain === 'cosmetic' && barcode && !cosmeticText && fallbackLookup === 'failed' && (
            <span
              title={im.lookupFailed}
              className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-container-high"
            >
              <AppIcon name="cloud_off" className="size-4 text-on-surface-variant" />
            </span>
          )}
          {domain === 'cosmetic' && barcode && !cosmeticText && fallbackLookup === 'done' && (
            <span
              title={im.lookupNotFound}
              className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-container-high"
            >
              <AppIcon name="search_off" className="size-4 text-on-surface-variant" />
            </span>
          )}

          {/* Food: additive-grade ring / water droplet */}
          {domain !== 'cosmetic' && foodPreview && (
            foodPreview.kind === 'water' ? (
              <span
                title={fg.waterTitle}
                className="inline-flex items-center gap-1 rounded-full bg-sky-500/10 px-2 py-0.5 font-label-sm text-label-sm text-sky-700 dark:text-sky-400"
              >
                <AppIcon name="water_drop" className="size-3.5" />
                <span className="hidden sm:inline">{fg.waterTitle}</span>
              </span>
            ) : (
              foodGrade && (
                <>
                  <ScoreRing
                    score={foodGrade.score}
                    band={foodGrade.band}
                    label={`${foodGrade.score}/100 — ${t(ig[BAND_LABEL_KEY[foodGrade.band]])}. ${fg.gradeTooltip}`}
                    toneClass={BAND_STYLE[foodGrade.band].text}
                  />
                  <span
                    className={`hidden font-label-sm text-label-sm font-semibold sm:inline ${BAND_STYLE[foodGrade.band].text}`}
                  >
                    {t(ig[BAND_LABEL_KEY[foodGrade.band]])}
                  </span>
                </>
              )
            )
          )}

          <AppIcon
            name="expand_more"
            className={
              'size-4 shrink-0 text-on-surface-variant transition-transform duration-200 ' +
              (open ? 'rotate-180' : '')
            }
          />
        </span>
      </button>

      {open && (
        <div id="pending-label-knowledge" className="mt-2">
          {domain === 'cosmetic' ? (
            <CoursesIngredientPanel
              barcode={barcode}
              initialText={ingredientsText || fallbackText}
              name={labelName}
              category={category}
              onIngredientsText={onIngredientsText}
            />
          ) : (
            <CoursesFoodPanel
              barcode={barcode}
              initialText={ingredientsText}
              name={labelName}
              category={category}
            />
          )}
        </div>
      )}
    </div>
  );
}
