import type { Metadata } from 'next';
import { FixedScreen } from '@/components/dashboard/screens/fixed-screen';

export const metadata: Metadata = {
  title: 'Fixed Bills',
  description: 'Manage your recurring fixed bills.',
  robots: { index: false, follow: false },
};

export default function FixedBillsPage() {
  return <FixedScreen />;
}
