'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useLightLanguage } from '@/lib/i18n-light';
import { resolveHydratedTitle } from '@/lib/document-title';

/**
 * Route metadata is statically generated for a fast, cacheable app shell.
 * Reflect the active client locale in the browser tab after hydration so an
 * Arabic or French session does not retain an English page title.
 *
 * The rules live in `resolveHydratedTitle` (pure, unit-tested): English
 * sessions keep the prerendered keyword-bearing `<title>` on every public
 * page — Google renders JavaScript, so a hydration overwrite would hand the
 * index a weaker title — while dashboard screens always get per-route tab
 * titles and other locales get translations where mapped.
 */
export function LocalizedDocumentTitle() {
  const pathname = usePathname();
  const { messages: m, language } = useLightLanguage();

  useEffect(() => {
    const next = resolveHydratedTitle(pathname, language, m, m.common.appName);
    if (next !== null) document.title = next;
  }, [m, language, pathname]);

  return null;
}
