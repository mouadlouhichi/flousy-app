import type { Metadata } from 'next';
import { Suspense } from 'react';
import { DaratScreen } from '@/components/dashboard/darat/darat-screen';

export const metadata: Metadata = {
  title: 'Darat — Rotating Savings Circles',
  description: 'Run a Moroccan Darat (rotating savings circle) with friends and family.',
  robots: { index: false, follow: false },
};

export default function DaratPage() {
  // `DaratScreen` reads `?join=<code>` from the URL on mount via
  // `useSearchParams`, which Next.js requires to be wrapped in a
  // Suspense boundary at the page level. The fallback is just the
  // normal Pro-gated list view, so the SSR shell stays correct.
  return (
    <Suspense fallback={<DaratScreen />}>
      <DaratScreen />
    </Suspense>
  );
}
