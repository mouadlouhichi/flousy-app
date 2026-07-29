import type { Metadata } from 'next';
import { DebtsScreen } from '@/components/dashboard/screens/debts-screen';

export const metadata: Metadata = {
  title: 'Debts & Credits',
  description: 'Track debts and credits.',
  robots: { index: false, follow: false },
};

export default function DebtsPage() {
  return <DebtsScreen />;
}
