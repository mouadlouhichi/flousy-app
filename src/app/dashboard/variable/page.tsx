import type { Metadata } from 'next';
import { Suspense } from 'react';
import { VariableScreen } from '@/components/dashboard/screens/variable-screen';

export const metadata: Metadata = {
  title: 'Variable Expenses',
  description: 'Track your variable day-to-day expenses.',
  robots: { index: false, follow: false },
};

export default function VariableExpensesPage() {
  return (
    <Suspense fallback={null}>
      <VariableScreen />
    </Suspense>
  );
}
