'use client';

import { useState } from 'react';
import { AppIcon } from '@/components/ui/app-icon';
import { useLanguage } from '@/lib/i18n-context';
import { createCourseBillImageFile } from '@/lib/course-bill-image';
import { renderBillCsv, renderBillText } from '@/lib/course-session';
import { formatCurrency } from '@/lib/currency';
import { formatShortDate } from '@/lib/utils';
import type { CourseSession } from '@/lib/store';

interface CoursesBillProps {
  session: CourseSession;
  onBack: () => void;
  onNewCourse: () => void;
}

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function downloadText(filename: string, content: string, mime: string) {
  downloadBlob(filename, new Blob([content], { type: `${mime};charset=utf-8` }));
}

/**
 * The completed session rendered as a bill: a receipt-style card (the same
 * data the text export uses) plus share / copy / download actions.
 */
export function CoursesBill({ session, onBack, onNewCourse }: CoursesBillProps) {
  const { messages, isRTL, intlLocale } = useLanguage();
  const c = messages.courses;
  const [copied, setCopied] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [shareError, setShareError] = useState(false);

  const place = messages.places[session.place as keyof typeof messages.places] || session.place;
  const billText = renderBillText(session, {
    appName: 'SMARTJIB',
    labels: {
      course: c.billTextCourse,
      line: c.billTextLine,
      lines: c.billTextLines,
      item: c.billTextItem,
      items: c.billTextItems,
      total: c.billTextTotal,
      paidFrom: c.paidFrom,
      place,
      locale: intlLocale,
      date: formatShortDate(session.date, intlLocale),
    },
  });
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
    if (isSharing || typeof navigator === 'undefined') return;

    setIsSharing(true);
    setShareError(false);
    try {
      const image = await createCourseBillImageFile(session, {
        title: c.billTitle,
        items: c.items,
        total: c.total,
        paidFrom: c.paidFrom,
        place,
        date: formatShortDate(session.date, intlLocale),
        unnamedItem: c.unnamedItem,
        locale: intlLocale,
        direction: isRTL ? 'rtl' : 'ltr',
      });
      // No `text` payload here: native share receives the visual PNG only.
      const shareData: ShareData = { files: [image] };

      let canShareImage = Boolean(navigator.share);
      if (canShareImage && typeof navigator.canShare === 'function') {
        try {
          canShareImage = navigator.canShare(shareData);
        } catch {
          // A few browsers throw while inspecting File payloads. Their
          // reliable image fallback is the download below.
          canShareImage = false;
        }
      }

      if (canShareImage) {
        try {
          await navigator.share(shareData);
          return;
        } catch (error) {
          // Closing the native sheet is not an error and must not trigger a
          // download. Other share failures still preserve the image path.
          if (
            typeof error === 'object' &&
            error !== null &&
            'name' in error &&
            error.name === 'AbortError'
          ) {
            return;
          }
        }
      }

      // Desktop browsers and older mobile browsers may not accept shared
      // files. Download the same PNG instead — never fall back to text.
      downloadBlob(image.name, image);
    } catch {
      // Image generation (canvas/PNG) failed — tell the user instead of
      // silently doing nothing.
      setShareError(true);
    } finally {
      setIsSharing(false);
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
          dir={isRTL ? 'rtl' : 'ltr'}
          className="font-mono text-[12px] md:text-[13px] leading-relaxed text-on-surface whitespace-pre text-start"
        >
          {billText}
        </pre>
      </div>

      {/* Summary + actions */}
      <div className="rounded-3xl border border-outline-variant bg-surface-container-low p-4 md:p-5">
        {shareError && (
          <p className="mb-3 flex items-center gap-2 rounded-2xl bg-tertiary-container px-4 py-2.5 font-body-md text-body-md text-on-tertiary-container">
            <AppIcon name="warning" className="size-4 shrink-0" />
            {c.shareFailed}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0">
          <p className="font-label-sm text-label-sm text-on-surface-variant">
            {formatShortDate(session.date, intlLocale)} · {new Intl.NumberFormat(intlLocale).format(session.items.length)} {c.items} · {formatCurrency(session.total, session.currency, intlLocale)}
          </p>
          <p className="font-headline-sm text-headline-sm text-primary">
            {formatCurrency(session.total, session.currency, intlLocale)}
          </p>
        </div>
        <div className="ms-auto flex flex-wrap gap-2">
          <button
            type="button"
            onClick={shareBill}
            disabled={isSharing}
            aria-busy={isSharing}
            className="flex items-center gap-1.5 rounded-full border border-outline-variant bg-surface px-3.5 py-2 font-label-md text-label-md text-on-surface transition-colors hover:bg-surface-container-high disabled:cursor-wait disabled:opacity-60"
          >
            <AppIcon name={isSharing ? 'sync' : 'share'} className={`size-4 ${isSharing ? 'animate-spin' : ''}`} />
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
    </div>
  );
}
