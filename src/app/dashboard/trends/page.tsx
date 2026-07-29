import type { Metadata } from 'next';
import { TrendsScreen } from '@/components/dashboard/screens/trends-screen';

export const metadata: Metadata = {
  title: 'Trends & Analytics',
  description: 'Multi-month trends and analytics (PRO).',
  robots: { index: false, follow: false },
};

export default function TrendsPage() {
  return <TrendsScreen />;
}
