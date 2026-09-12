'use client';

/**
 * Presentational building blocks for the Darat screens, styled after the
 * Forest & Lime design system: a forest hero panel with the dotted matrix,
 * white ambient circle cards with a progress ring, an avatar stack for the
 * member roster and a vertical round timeline.
 */

import type { ReactNode } from 'react';
import { AppIcon } from '@/components/ui/app-icon';
import { useLanguage } from '@/lib/i18n-context';
import { formatCurrency } from '@/lib/currency';
import { formatMessage } from '@/lib/i18n-core';
import { cn } from '@/lib/utils';
import type { DaratCircle } from '@/lib/darat';

/* ------------------------------------------------------------------------ */
/* Helpers                                                                   */
/* ------------------------------------------------------------------------ */

export function todayYmd(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Locale-aware "12 Sep 2026" from a YYYY-MM-DD string (falls back to raw). */
export function formatYmd(ymd: string, intlLocale: string, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }): string {
  const [y, mo, d] = ymd.split('-').map(Number);
  if (!y || !mo || !d) return ymd;
  return new Date(y, mo - 1, d).toLocaleDateString(intlLocale, opts);
}

/** Two-letter monogram for an avatar ("Jon Snow" → "JS", "…a1b2c3" → "A1"). */
export function monogram(name: string): string {
  const clean = name.replace(/^…/, '').trim();
  if (!clean) return '?';
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return clean.slice(0, 2).toUpperCase();
}

/** Circle progress: rounds whose date has passed / total rounds. */
export function circleProgress(circle: DaratCircle, today = todayYmd()): { done: number; total: number; pct: number; next: DaratCircle['rounds'][number] | null } {
  const total = circle.rounds.length;
  const done = circle.status === 'closed' ? total : circle.rounds.filter((r) => r.date < today).length;
  const next = circle.status === 'closed' ? null : circle.rounds.find((r) => r.date >= today) ?? null;
  return { done, total, pct: total > 0 ? Math.round((done / total) * 100) : 0, next };
}

const AVATAR_TONES = [
  'bg-forest text-lime',
  'bg-lime text-forest-deep',
  'bg-sage text-forest-deep',
  'bg-mint text-forest dark:text-lime',
  'bg-secondary text-white',
  'bg-tertiary text-white',
];

export function avatarTone(index: number): string {
  return AVATAR_TONES[index % AVATAR_TONES.length];
}

/* ------------------------------------------------------------------------ */
/* Hero                                                                      */
/* ------------------------------------------------------------------------ */

export function DaratHero({
  eyebrow,
  title,
  intro,
  stats,
  actions,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  intlLocale: string;
  stats: { active: string; organizer: string; member: string } | null;
  actions?: ReactNode;
}) {
  return (
    <section className="surface-forest relative overflow-hidden rounded-[1.75rem] p-5 shadow-forest sm:p-6">
      <div aria-hidden className="dot-matrix-forest pointer-events-none absolute inset-y-0 end-0 w-2/5 opacity-40 [mask-image:linear-gradient(to_left,black,transparent)]" />
      <div className="relative flex flex-col gap-5">
        <div className="flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-lime text-forest-deep">
            <AppIcon name="user_group" strokeWidth={2.2} className="text-[20px]" />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-lime">{eyebrow}</p>
            <h1 className="mt-1 text-[22px] font-semibold leading-tight tracking-[-0.01em] text-white sm:text-[26px]">{title}</h1>
            <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-white/65">{intro}</p>
          </div>
        </div>

        {stats && (
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-lime px-3 py-1 text-[12px] font-semibold text-forest-deep">{stats.active}</span>
            <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[12px] font-semibold text-white/85">{stats.organizer}</span>
            <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[12px] font-semibold text-white/85">{stats.member}</span>
          </div>
        )}

        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------------ */
/* Circle card (list)                                                        */
/* ------------------------------------------------------------------------ */

const RING = 56;
const RING_STROKE = 5;
const RING_R = (RING - RING_STROKE) / 2;
const RING_C = 2 * Math.PI * RING_R;

export function ProgressRing({ pct, label, className }: { pct: number; label: string; className?: string }) {
  const clamped = Math.min(100, Math.max(0, pct));
  return (
    <div className={cn('relative size-14 shrink-0', className)} aria-hidden="true">
      <svg viewBox={`0 0 ${RING} ${RING}`} className="size-full -rotate-90">
        <circle cx={RING / 2} cy={RING / 2} r={RING_R} fill="none" stroke="var(--surface-variant)" strokeWidth={RING_STROKE} />
        <circle
          cx={RING / 2}
          cy={RING / 2}
          r={RING_R}
          fill="none"
          stroke="var(--forest)"
          strokeWidth={RING_STROKE}
          strokeLinecap="round"
          strokeDasharray={`${(clamped / 100) * RING_C} ${RING_C}`}
          className="transition-[stroke-dasharray] duration-700 ease-out dark:[stroke:var(--lime)]"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[11px] font-semibold tabular text-on-surface">{label}</span>
    </div>
  );
}

export function DaratCircleCard({
  circle,
  isOrganizer,
  currentUid,
  onOpen,
}: {
  circle: DaratCircle;
  isOrganizer: boolean;
  currentUid?: string;
  onOpen: () => void;
}) {
  const { messages: m, intlLocale } = useLanguage();
  const progress = circleProgress(circle);
  const closed = circle.status === 'closed';
  const rotationLabel =
    circle.rotation === 'random' ? m.darat.create.rotationRandom : m.darat.create.rotationFixed;
  const pot = circle.contribution * circle.memberOrder.length;
  const nextIsMe = progress.next?.recipientId != null && progress.next.recipientId === currentUid;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex w-full flex-col gap-4 rounded-[1.75rem] border border-outline-variant bg-surface-container-lowest p-5 text-start shadow-ambient transition-all hover:-translate-y-0.5 hover:shadow-floating focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 active:translate-y-0"
    >
      <div className="flex w-full items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className={cn('flex size-11 shrink-0 items-center justify-center rounded-full', closed ? 'bg-surface-container-high text-on-surface-variant' : 'bg-forest text-lime')}>
            <AppIcon name="user_group" strokeWidth={2} className="text-[20px]" />
          </span>
          <div className="min-w-0">
            <h3 className="truncate text-[16px] font-semibold text-on-surface">{circle.name}</h3>
            <p className="truncate text-[12px] font-medium text-on-surface-variant">
              {formatMessage(m.darat.list.membersCount, { count: circle.memberOrder.length }, intlLocale)} · {rotationLabel}
            </p>
          </div>
        </div>
        <span
          className={cn(
            'shrink-0 rounded-full px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-[0.06em]',
            closed ? 'bg-surface-container-high text-on-surface-variant' : isOrganizer ? 'bg-lime text-forest-deep' : 'bg-mint text-forest dark:text-lime',
          )}
        >
          {closed ? m.darat.detail.status.closed : isOrganizer ? m.darat.list.asOrganizer : m.darat.list.asMember}
        </span>
      </div>

      <div className="flex w-full items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-on-surface-variant">{m.darat.detail.payout}</p>
          <p className="mt-0.5 truncate text-[22px] font-semibold tabular tracking-[-0.01em] text-on-surface">
            {formatCurrency(pot, circle.currency, intlLocale)}
          </p>
          <p className="truncate text-[12px] font-medium text-on-surface-variant">
            {m.darat.list.pot.replace('{amount}', formatCurrency(circle.contribution, circle.currency, intlLocale))}
          </p>
        </div>
        <ProgressRing pct={progress.pct} label={`${progress.done}/${progress.total}`} />
      </div>

      <div className="flex w-full items-center justify-between gap-2 border-t border-outline-variant/60 pt-3">
        <span className={cn('flex min-w-0 items-center gap-1.5 text-[12px] font-semibold', nextIsMe ? 'text-forest dark:text-lime' : 'text-on-surface-variant')}>
          <AppIcon name={nextIsMe ? 'celebration' : 'calendar_clock'} className="shrink-0 text-[15px]" />
          <span className="truncate">
            {progress.next
              ? nextIsMe
                ? m.darat.list.yourTurn
                : m.darat.list.nextRound.replace('{date}', formatYmd(progress.next.date, intlLocale, { day: 'numeric', month: 'short' }))
              : m.darat.detail.status.closed}
          </span>
        </span>
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-container-high text-on-surface transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:bg-lime group-hover:text-forest-deep">
          <AppIcon name="arrow_outward" strokeWidth={2} className="text-[16px] rtl:-scale-x-100" />
        </span>
      </div>
      <span className="sr-only"> {m.darat.list.openCircle}</span>
    </button>
  );
}

/* ------------------------------------------------------------------------ */
/* Avatar stack                                                              */
/* ------------------------------------------------------------------------ */

export function AvatarStack({ names, max = 5, className }: { names: string[]; max?: number; className?: string }) {
  const shown = names.slice(0, max);
  const rest = names.length - shown.length;
  return (
    <div className={cn('flex items-center', className)} aria-hidden="true">
      {shown.map((name, idx) => (
        <span
          key={`${name}-${idx}`}
          className={cn(
            'flex size-8 items-center justify-center rounded-full text-[11px] font-semibold ring-2 ring-surface-container-lowest',
            idx > 0 && '-ms-2',
            avatarTone(idx),
          )}
        >
          {monogram(name)}
        </span>
      ))}
      {rest > 0 && (
        <span className="-ms-2 flex size-8 items-center justify-center rounded-full bg-surface-container-high text-[11px] font-semibold text-on-surface-variant ring-2 ring-surface-container-lowest">
          +{rest}
        </span>
      )}
    </div>
  );
}
