'use client';

import React from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useLanguage } from '@/lib/i18n-context';
import type { ProductRanking } from '@/lib/store';
import { cn } from '@/lib/utils';

/** Official Nutri-Score palette (A = least unhealthy … E = most). */
const RANKING_STYLES: Record<string, { bg: string; fg: string }> = {
  a: { bg: '#009958', fg: '#ffffff' },
  b: { bg: '#02c15e', fg: '#ffffff' },
  c: { bg: '#fecb02', fg: '#5f4700' },
  d: { bg: '#f98e01', fg: '#663300' },
  e: { bg: '#ec1c24', fg: '#ffffff' },
};

interface RankingChipProps {
  /** Hidden entirely when the source provides no grade. */
  ranking?: ProductRanking | null;
  className?: string;
}

/**
 * The product's quality ranking (Nutri-Score) shown as a small coloured
 * letter right after the product name. Tapping/clicking the chip opens a
 * tooltip with the official grade and, when supplied, raw calculation points
 * explicitly labeled as points (never as a positive /100 score).
 */
export function RankingChip({ ranking, className }: RankingChipProps) {
  const { messages: m, intlLocale } = useLanguage();
  const c = m.courses;

  const grade = ranking?.grade?.toLowerCase();
  if (!ranking || !grade || !RANKING_STYLES[grade]) return null;
  const style = RANKING_STYLES[grade];
  const label = grade.toUpperCase();
  const calculationPoints = ranking.calculationPoints ?? ranking.score;
  const pointsPart = calculationPoints != null
    ? ` · ${new Intl.NumberFormat(intlLocale).format(Math.round(calculationPoints))} ${c.rankingPoints}`
    : '';
  const heading = `${c.rankingLabel} ${label}${pointsPart}`;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={`${heading} — ${c.rankingMeaning}`}
          className={cn(
            'tap-target inline-flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-[5px] px-0.5 text-[11px] font-extrabold leading-none',
            className,
          )}
          style={{ backgroundColor: style.bg, color: style.fg }}
        >
          {label}
        </button>
      </TooltipTrigger>
      <TooltipContent sideOffset={6} className="max-w-[240px] rounded-lg p-2.5 text-left">
        <span className="block text-[12px] font-bold">{heading}</span>
        <span className="mt-1 block text-[11px] font-normal leading-snug opacity-80">
          {c.rankingMeaning}
        </span>
      </TooltipContent>
    </Tooltip>
  );
}
