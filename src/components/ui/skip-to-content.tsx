'use client';

import React from 'react';
import { useLightLanguage } from '@/lib/i18n-light';

/**
 * First focusable element on every page (WCAG 2.4.1 — Bypass Blocks).
 * Visually hidden until it receives keyboard focus, then appears as a
 * floating pill so keyboard and screen-reader users can jump straight past
 * the header/sidebar to the page's <main id="main-content">.
 */
export function SkipToContentLink() {
  const { messages: m } = useLightLanguage();
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-primary focus:px-5 focus:py-3 focus:text-sm focus:font-semibold focus:text-primary-foreground focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
      onClick={(event) => {
        // <main> is not focusable by default; move focus manually so the
        // next Tab press continues inside the content, not back at the top.
        const target = document.getElementById('main-content');
        if (!target) return;
        event.preventDefault();
        target.setAttribute('tabindex', '-1');
        target.focus({ preventScroll: false });
        target.scrollIntoView();
      }}
    >
      {m.common.skipToContent}
    </a>
  );
}
