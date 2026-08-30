'use client';

import { AppIcon } from '@/components/ui/app-icon';
import { useLanguage } from '@/lib/i18n-context';

/** Widths of the decorative bars in the faux barcode (index = position). */
const BAR_WIDTHS = [
  'w-[3px]',
  'w-1',
  'w-[3px]',
  'w-[7px]',
  'w-[3px]',
  'w-1',
  'w-[7px]',
  'w-[3px]',
  'w-1',
  'w-[3px]',
  'w-[7px]',
  'w-1',
  'w-[3px]',
  'w-[7px]',
  'w-1',
  'w-[3px]',
];

interface CoursesScanUpsellProps {
  /** Opens the global Pro upgrade modal. */
  onUpgrade: () => void;
}

/**
 * Shown in place of the scanner panel on free plans. Keeps the same card
 * footprint (title row + viewport block) so the session layout does not
 * shift between plans, and states exactly what Pro scanning unlocks plus
 * the always-free fallback: adding items by name below.
 */
export function CoursesScanUpsell({ onUpgrade }: CoursesScanUpsellProps) {
  const { messages } = useLanguage();
  const c = messages.courses;
  const perks = [c.scanProPerk1, c.scanProPerk2, c.scanProPerk3];

  return (
    <section className="rounded-3xl border border-outline-variant bg-surface-container-low p-4 md:p-5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-headline-sm text-headline-sm text-on-surface">
          <AppIcon name="scan_barcode" className="size-5 text-primary" />
          {c.scanTitle}
        </h3>
        <span className="flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 font-label-sm text-label-sm text-primary">
          <AppIcon name="workspace_premium" className="size-3.5" />
          Pro
        </span>
      </div>

      {/* Locked scanner preview: faux barcode behind a blurred glass lock. */}
      <div className="relative mt-3 aspect-[4/3] overflow-hidden rounded-2xl bg-surface-variant md:aspect-video">
        <div
          aria-hidden
          className="absolute inset-0 flex items-center justify-center gap-[6px] opacity-30 select-none"
        >
          {BAR_WIDTHS.map((width, i) => (
            <span key={i} className={`h-10 rounded-full bg-on-surface-variant ${width}`} />
          ))}
        </div>
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 bg-surface/55 px-4 text-center backdrop-blur-[3px]">
          <span className="flex size-11 items-center justify-center rounded-full border border-outline-variant bg-surface shadow-sm">
            <AppIcon name="lock" className="size-[18px] text-primary" />
          </span>
          <p className="font-label-md text-label-md text-on-surface-variant">{c.scanProTitle}</p>
        </div>
      </div>

      <p className="mt-3 font-body-md text-body-md text-on-surface-variant">{c.scanProHint}</p>

      <ul className="mt-3 space-y-1.5">
        {perks.map((perk) => (
          <li key={perk} className="flex items-center gap-2 font-body-md text-body-md text-on-surface">
            <AppIcon name="check_circle" className="size-4 shrink-0 text-primary" />
            {perk}
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={onUpgrade}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 font-label-lg text-label-lg text-on-primary transition-opacity hover:opacity-90"
      >
        <AppIcon name="workspace_premium" className="size-[18px]" />
        {c.scanProCta}
      </button>
      <p className="mt-2.5 text-center font-body-sm text-body-sm text-on-surface-variant">
        {c.scanFreeNote}
      </p>
    </section>
  );
}
