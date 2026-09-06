'use client';

import { AppIcon } from '@/components/ui/app-icon';
import { useLanguage } from '@/lib/i18n-context';

interface ProLockedCardProps {
  icon: string;
  title: string;
  body: string;
  onUpgrade: () => void;
}

/** Compact, consistent "this is Pro" card used wherever a feature is gated inline. */
export function ProLockedCard({ icon, title, body, onUpgrade }: ProLockedCardProps) {
  const { messages: m } = useLanguage();
  return (
    <section className="rounded-3xl border border-dashed border-outline-variant bg-surface-container-low p-5">
      <div className="flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <AppIcon name={icon} className="text-[22px]" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 font-bold text-on-surface">
            {title}
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
              <AppIcon name="workspace_premium" className="text-[12px]" />
              Pro
            </span>
          </p>
          <p className="mt-1 text-sm text-on-surface-variant">{body}</p>
          <button
            type="button"
            onClick={onUpgrade}
            className="mt-3 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-bold text-on-primary transition-opacity hover:opacity-90"
          >
            <AppIcon name="lock_open" className="text-[14px]" />
            {m.insights.unlock}
          </button>
        </div>
      </div>
    </section>
  );
}
