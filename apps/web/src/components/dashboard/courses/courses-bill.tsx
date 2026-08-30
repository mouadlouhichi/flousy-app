'use client';

import { useState } from 'react';
import { AppIcon } from '@/components/ui/app-icon';
import { useLanguage } from '@/lib/i18n-context';
import { renderBillCsv, renderBillText } from '@/lib/course-session';
import { formatCurrency } from '@/lib/currency';
import type { CourseSession } from '@/lib/store';

interface CoursesBillProps {
  session: CourseSession;
  onBack: () => void;
  onNewCourse: () => void;
}

function downloadText(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * The completed session rendered as a bill: a receipt-style card (the same
 * data the text export uses) plus share / copy / download actions.
 */
export function CoursesBill({ session, onBack, onNewCourse }: CoursesBillProps) {
  const { messages, isRTL } = useLanguage();
  const c = messages.courses;
  const [copied, setCopied] = useState(false);

  const billText = renderBillText(session);
  const billFileName = `course-${session.date}.txt`;

  const copyBill = async () => {
    try {
      await navigator.clipboard.writeText(billText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — the bill stays visible on screen */
    }
  };

  const shareBill = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: c.billTitle, text: billText });
      } catch {
        /* user dismissed the share sheet */
      }
    } else {
      copyBill();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 font-label-md text-label-md text-on-surface-variant hover:text-on-surface transition-colors"
        >
          <AppIcon name="arrow_back" className={`size-[18px] ${isRTL ? 'rotate-180' : ''}`} />
          {c.back}
        </button>
        <h2 className="font-headline-sm text-headline-sm text-on-surface">{c.billTitle}</h2>
        <button
          type="button"
          onClick={onNewCourse}
          className="flex items-center gap-2 rounded-full bg-primary px-3.5 py-1.5 font-label-md text-label-md text-on-primary hover:opacity-90 transition-opacity"
        >
          <AppIcon name="add" className="size-4" />
          {c.newCourse}
        </button>
      </div>

      {/* Receipt */}
      <div className="rounded-3xl border border-outline-variant bg-surface-container-low p-5 md:p-6">
        <pre
          dir="ltr"
          className={`font-mono text-[12px] md:text-[13px] leading-relaxed text-on-surface whitespace-pre ${isRTL ? 'ml-auto' : ''}`}
        >
          {billText}
        </pre>
      </div>

      {/* Summary + actions */}
      <div className="rounded-3xl border border-outline-variant bg-surface-container-low p-4 md:p-5 flex flex-wrap items-center gap-3">
        <div className="min-w-0">
          <p className="font-label-sm text-label-sm text-on-surface-variant">
            {session.date} · {session.items.length} {c.items} · {formatCurrency(session.total, session.currency)}
          </p>
          <p className="font-headline-sm text-headline-sm text-primary">
            {formatCurrency(session.total, session.currency)}
          </p>
        </div>
        <div className="ms-auto flex flex-wrap gap-2">
          <button
            type="button"
            onClick={shareBill}
            className="flex items-center gap-1.5 rounded-full border border-outline-variant bg-surface px-3.5 py-2 font-label-md text-label-md text-on-surface hover:bg-surface-container-high transition-colors"
          >
            <AppIcon name="share" className="size-4" />
            {c.billShare}
          </button>
          <button
            type="button"
            onClick={copyBill}
            className="flex items-center gap-1.5 rounded-full border border-outline-variant bg-surface px-3.5 py-2 font-label-md text-label-md text-on-surface hover:bg-surface-container-high transition-colors"
          >
            <AppIcon name={copied ? 'check' : 'copy'} className="size-4 text-primary" />
            {copied ? c.billCopied : c.billCopy}
          </button>
          <button
            type="button"
            onClick={() => downloadText(billFileName, billText, 'text/plain')}
            className="flex items-center gap-1.5 rounded-full border border-outline-variant bg-surface px-3.5 py-2 font-label-md text-label-md text-on-surface hover:bg-surface-container-high transition-colors"
          >
            <AppIcon name="download" className="size-4" />
            {c.billDownload}
          </button>
          <button
            type="button"
            onClick={() => downloadText(`course-${session.date}.csv`, renderBillCsv(session), 'text/csv')}
            className="flex items-center gap-1.5 rounded-full border border-outline-variant bg-surface px-3.5 py-2 font-label-md text-label-md text-on-surface hover:bg-surface-container-high transition-colors"
          >
            <AppIcon name="table_rows" className="size-4" />
            {c.billCsv}
          </button>
        </div>
      </div>
    </div>
  );
}
