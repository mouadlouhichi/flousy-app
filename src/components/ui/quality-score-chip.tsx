/**
 * Compact cosmetic-quality score chip for course lines. Shows the score
 * after the product name; tapping opens a popover with the tier breakdown.
 */
'use client';

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useLanguage } from '@/lib/i18n-context';
import { INCI_SCORE_MAX, type QualitySummary } from '@/lib/inci-quality';

const BANDS = [
  {
    min: 0.8,
    key: 'excellent' as const,
    chip: 'bg-[#00897b]/10 text-[#00685f] dark:text-[#6bd8cb]',
  },
  {
    min: 0.6,
    key: 'good' as const,
    chip: 'bg-[#43a047]/10 text-[#2e7d32] dark:text-[#81c784]',
  },
  {
    min: 0.4,
    key: 'fair' as const,
    chip: 'bg-[#e6950b]/10 text-[#b45309] dark:text-[#ffca28]',
  },
  {
    min: 0,
    key: 'poor' as const,
    chip: 'bg-error/10 text-error',
  },
] as const;

function scoreBand(score: number): (typeof BANDS)[number] {
  const ratio = score / INCI_SCORE_MAX;
  return BANDS.find((band) => ratio >= band.min) ?? BANDS[BANDS.length - 1];
}

export function QualityScoreChip({ summary }: { summary: QualitySummary }) {
  const { messages: m, intlLocale } = useLanguage();
  const q = m.barcode.quality;
  const band = scoreBand(summary.score);
  const numberFormat = new Intl.NumberFormat(intlLocale, { maximumFractionDigits: 1 });
  const score = numberFormat.format(summary.score);

  const rows: Array<{ dot: string; label: string; count: number }> = [
    { dot: 'bg-primary', label: q.tiers.good, count: summary.good },
    { dot: 'bg-amber-500', label: q.tiers.caution, count: summary.caution },
    { dot: 'bg-error', label: q.tiers.concern, count: summary.concern },
  ];

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`${q.ratings[band.key]} — ${score} / ${INCI_SCORE_MAX}`}
          title={q.title}
          className={`shrink-0 rounded-full px-1.5 py-0.5 text-[11px] font-extrabold tabular-nums transition-opacity hover:opacity-75 ${band.chip}`}
        >
          {score}
          <span className="opacity-60">/{INCI_SCORE_MAX}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-60" align="end">
        <p className="text-[11px] font-extrabold uppercase tracking-wider text-on-surface-variant">
          {q.title}
        </p>
        <p className="mt-1 flex items-baseline gap-1.5">
          <span className="text-2xl font-black leading-none text-on-surface tabular-nums">{score}</span>
          <span className="text-sm font-bold text-on-surface-variant">/{INCI_SCORE_MAX}</span>
          <span className="ms-auto text-sm font-extrabold text-on-surface">{q.ratings[band.key]}</span>
        </p>
        <ul className="mt-2 flex flex-col gap-1">
          {rows.map((row) => (
            <li key={row.label} className="flex items-center gap-2 text-xs font-semibold text-on-surface">
              <span className={`size-2 rounded-full ${row.dot}`} />
              {row.label}
              <span className="ms-auto tabular-nums text-on-surface-variant">{numberFormat.format(row.count)}</span>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
