'use client';

import { AppIcon } from '@/components/ui/app-icon';
import { MoneyFigure } from '@/components/ui/money-figure';
import { cn } from '@/lib/utils';

export interface BalanceHeroPlace {
  id: string;
  name: string;
  icon: string;
  balance: number;
  /** Screen-reader action note appended to the visible contents when the tab
   *  is interactive (e.g. "View Bank history") — kept out of aria-label so the
   *  accessible name still contains the visible label (WCAG 2.5.3). */
  actionNote?: string;
}

interface BalanceHeroCardProps {
  /** Big figure in the middle of the card. */
  total: number;
  totalLabel: string;
  /** Cash locations rendered as the lime "card strip" tabs at the top. */
  places: BalanceHeroPlace[];
  /** Header eyebrow (e.g. the account holder / workspace name). */
  eyebrow?: string;
  /** Header trailing label (e.g. the budget period). */
  trailing?: string;
  redacted?: boolean;
  onSelectPlace?: (placeId: string) => void;
  /** Primary + secondary pill actions under the figure ("Deposit" / "Send"). */
  primaryAction?: { label: string; icon: string; onClick: () => void };
  secondaryAction?: { label: string; icon: string; onClick: () => void };
  className?: string;
}

/**
 * The signature wallet card from the reference design: a white outer frame
 * holding a lime "bank card" strip, a deep forest panel with the notched top
 * edge and the big total balance in the middle, then two pill actions.
 */
export function BalanceHeroCard({
  total,
  totalLabel,
  places,
  eyebrow,
  trailing,
  redacted = false,
  onSelectPlace,
  primaryAction,
  secondaryAction,
  className,
}: BalanceHeroCardProps) {
  return (
    <section
      className={cn(
        'relative overflow-hidden rounded-[2rem] border border-outline-variant bg-surface-container-lowest p-2.5 shadow-ambient',
        className,
      )}
    >
      {(eyebrow || trailing) && (
        <div className="flex items-center justify-between gap-3 px-3 pb-2.5 pt-2">
          <span className="truncate text-[13px] font-semibold text-on-surface">{eyebrow}</span>
          {trailing && (
            <span className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.08em] text-on-surface-variant">
              {trailing}
            </span>
          )}
        </div>
      )}

      {/* Lime strip: money places as "cards". Up to three sit side by side;
          more wrap onto a second row so nothing is ever clipped. */}
      <div className="surface-lime relative rounded-[1.5rem] rounded-b-none px-2 pb-8 pt-2">
        <div
          className="grid gap-1.5"
          style={{ gridTemplateColumns: `repeat(${Math.min(3, Math.max(1, places.length))}, minmax(0, 1fr))` }}
        >
          {places.map((place) => {
            const interactive = Boolean(onSelectPlace) && !redacted;
            const Tag = interactive ? 'button' : 'div';
            return (
              <Tag
                key={place.id}
                type={interactive ? 'button' : undefined}
                title={interactive ? place.actionNote : undefined}
                onClick={interactive ? () => onSelectPlace?.(place.id) : undefined}
                className={cn(
                  'flex min-w-0 flex-col gap-1.5 rounded-[1.125rem] bg-white/45 px-2 py-2.5 text-start text-forest-deep backdrop-blur-sm transition-colors sm:px-3',
                  interactive && 'hover:bg-white/65 focus:outline-none focus-visible:ring-2 focus-visible:ring-forest/60',
                )}
              >
                <span className="flex min-w-0 items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-forest-deep/70">
                  <AppIcon name={place.icon} strokeWidth={2} className="shrink-0 text-[13px]" />
                  <span className="truncate">{place.name}</span>
                </span>
                <MoneyFigure value={place.balance} size="sm" redacted={redacted} tone="inherit" className="max-w-full flex-wrap text-forest-deep" />
                {interactive && place.actionNote && <span className="sr-only"> {place.actionNote}</span>}
              </Tag>
            );
          })}
        </div>
      </div>

      {/* Forest panel with the notched top edge overlapping the lime strip. */}
      <div className="relative -mt-5">
        <NotchedForestPanel>
          <div className="flex flex-col items-center gap-1 px-5 pb-6 pt-8 text-center">
            <span className="flex size-8 items-center justify-center rounded-full bg-lime text-forest-deep shadow-[0_6px_16px_-6px_rgba(0,0,0,0.5)]">
              <AppIcon name="dollar" strokeWidth={2.4} className="text-[15px]" />
            </span>
            <MoneyFigure
              value={total}
              size="hero"
              redacted={redacted}
              tone="accent"
              className="mt-2 text-white"
            />
            <span className="text-[12px] font-medium text-white/55">{totalLabel}</span>
          </div>
        </NotchedForestPanel>
      </div>

      {(primaryAction || secondaryAction) && (
        <div className="mt-2.5 grid grid-cols-2 gap-2">
          {primaryAction && (
            <button
              type="button"
              onClick={primaryAction.onClick}
              className="flex h-12 items-center justify-center gap-2 rounded-full bg-primary text-[14px] font-semibold text-on-primary shadow-[0_8px_20px_-8px_rgba(15,59,54,0.5)] transition-all hover:bg-primary-hover active:scale-[0.98]"
            >
              <AppIcon name={primaryAction.icon} strokeWidth={2} className="text-[18px]" />
              {primaryAction.label}
            </button>
          )}
          {secondaryAction && (
            <button
              type="button"
              onClick={secondaryAction.onClick}
              className="flex h-12 items-center justify-center gap-2 rounded-full border border-outline-variant bg-surface-container-lowest text-[14px] font-semibold text-on-surface transition-all hover:bg-surface-container-high active:scale-[0.98]"
            >
              <AppIcon name={secondaryAction.icon} strokeWidth={2} className="text-[18px]" />
              {secondaryAction.label}
            </button>
          )}
        </div>
      )}
    </section>
  );
}

/**
 * Forest panel whose top edge dips into a soft notch in the centre (the
 * "ticket" silhouette in the reference). Drawn with an SVG mask so it stays
 * crisp at any width; the panel content sits over a subtle dotted texture.
 */
export function NotchedForestPanel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn('surface-forest relative overflow-hidden rounded-[1.5rem]', className)}
      style={{
        WebkitMaskImage: NOTCH_MASK,
        maskImage: NOTCH_MASK,
        WebkitMaskSize: '100% 100%',
        maskSize: '100% 100%',
        WebkitMaskRepeat: 'no-repeat',
        maskRepeat: 'no-repeat',
      }}
    >
      <div aria-hidden className="dot-matrix-forest pointer-events-none absolute inset-x-6 bottom-3 top-1/2 opacity-40 [mask-image:linear-gradient(to_top,black,transparent)]" />
      <div className="relative">{children}</div>
    </div>
  );
}

// A 1000×400 box (preserveAspectRatio none) with a shallow scoop taken out of
// the top-centre — roughly 22% of the width, 5% of the height.
const NOTCH_MASK =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1000 400' preserveAspectRatio='none'%3E%3Cpath fill='black' d='M0 0H370C385 0 395 4 405 12L420 22C428 28 436 30 448 30H552C564 30 572 28 580 22L595 12C605 4 615 0 630 0H1000V400H0Z'/%3E%3C/svg%3E\")";
