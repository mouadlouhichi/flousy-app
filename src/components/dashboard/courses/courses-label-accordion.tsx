'use client';

import { useEffect, useMemo, useState } from 'react';
import { AppIcon } from '@/components/ui/app-icon';
import { useLanguage } from '@/lib/i18n-context';
import { detectLabelDomain } from '@/lib/food-knowledge/domain';
import { analyzeFoodIngredientList, analyzeFoodText } from '@/lib/food-knowledge/analyze';
import type { FoodAnalysis } from '@/lib/food-knowledge/types';
import { analyzeIngredientsText } from '@/lib/ingredient-analysis-client';
import { readInciOverlayEntry } from '@/lib/ingredient-device-store';
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
 *  - food: a colored coverage pill (x/y recognized), or a droplet when the
 *    product is a water (no ingredient list — mineral composition instead).
 * The matching panel (INCI glance / food-knowledge) mounts only when opened.
 * Collapsed by default and reset per scanned product.
 */

interface CoursesLabelAccordionProps {
  barcode?: string;
  name?: string;
  category?: string;
  ingredientsText?: string;
  /** Manual-entry products have no name to classify yet. */
  needsName?: boolean;
}

export function CoursesLabelAccordion({
  barcode,
  name,
  category,
  ingredientsText,
  needsName,
}: CoursesLabelAccordionProps) {
  const { messages, t } = useLanguage();
  const c = messages.courses;
  const ig = messages.ingredientGlance;
  const fg = messages.foodKnowledge;

  const [open, setOpen] = useState(false);
  const [seenKey, setSeenKey] = useState('');
  const productKey = `${barcode ?? ''}\u0001${ingredientsText ?? ''}`;
  useEffect(() => {
    if (seenKey !== productKey) {
      setSeenKey(productKey);
      setOpen(false);
    }
  }, [productKey, seenKey]);

  const labelName = needsName ? undefined : name;
  const domain = detectLabelDomain({
    category,
    name: labelName,
    ingredientsText,
  });

  // The cosmetic engine may read a per-barcode INCI saved on this device.
  const overlayText = barcode ? readInciOverlayEntry(barcode) ?? '' : '';
  const cosmeticText = (ingredientsText?.trim() || overlayText.trim()).trim();

  // ---- Cosmetic score-ring preview (fetched while the card is collapsed) ----
  const [cosmetic, setCosmetic] = useState<{
    key: string;
    analysis?: ProductAssessment;
    failed?: boolean;
  }>({ key: '' });

  useEffect(() => {
    if (domain !== 'cosmetic' || open || !cosmeticText) return;
    if (cosmetic.key === cosmeticText) return;
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
  }, [domain, open, cosmeticText, labelName, category, cosmetic.key]);

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

  const foodTone =
    foodPreview && foodPreview.total > 0
      ? foodPreview.coverage >= 1
        ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
        : foodPreview.recognized === 0
          ? 'bg-surface-container-high text-on-surface-variant'
          : 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
      : '';

  const coverageAria =
    foodPreview && foodPreview.total > 0
      ? foodPreview.coverage >= 1
        ? fg.coverageAll
        : t(fg.coverage, {
            recognized: foodPreview.recognized,
            total: foodPreview.total,
          })
      : undefined;

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
          {/* Cosmetic: Yuka-style score ring (arc = score/100, colour = band) */}
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
            ) : scoreUnknown ? (
              <ScoreRing
                unknown
                label={ig.scoreUnknown}
                toneClass="text-on-surface-variant"
              />
            ) : (
              !cosmetic.failed &&
              !open && (
                <span
                  aria-hidden="true"
                  className="flex size-10 shrink-0 animate-pulse items-center justify-center rounded-full bg-surface-container-high font-label-sm text-label-sm text-on-surface-variant"
                >
                  …
                </span>
              )
            ))}

          {/* Food: coverage pill / water droplet */}
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
              foodPreview.total > 0 && (
                <span
                  title={coverageAria ?? undefined}
                  aria-label={coverageAria ?? undefined}
                  dir="ltr"
                  className={`inline-flex items-center rounded-full px-2 py-0.5 font-label-sm text-label-sm font-semibold tabular-nums ${foodTone}`}
                >
                  {foodPreview.recognized}/{foodPreview.total}
                </span>
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
              initialText={ingredientsText}
              name={labelName}
              category={category}
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
