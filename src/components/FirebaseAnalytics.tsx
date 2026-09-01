'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { trackEvent } from '@/lib/analytics';

export default function FirebaseAnalytics() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!pathname) return;
    // `page_location: window.location.href` shipped the whole query string into
    // analytics, and `/dashboard/profile?invite=<uuid>` carries a live household
    // invitation token — a value that grants access would end up stored in a
    // third-party analytics backend (and in users' browser history). Only the
    // path is reported; the presence of a query is enough for page-level stats.
    const hasQuery = searchParams.toString().length > 0;
    trackEvent('page_view', {
      page_path: pathname,
      page_location: `${window.location.origin}${pathname}`,
      page_title: document.title,
      has_query: hasQuery,
    });
  }, [pathname, searchParams]);

  return null;
}
