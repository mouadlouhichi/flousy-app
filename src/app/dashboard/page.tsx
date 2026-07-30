import type { Metadata } from 'next';
import { OverviewScreen } from '@/components/dashboard/screens/overview-screen';

export const metadata: Metadata = {
  title: 'Dashboard Overview',
  description: 'Your private SmartJib budgeting dashboard.',
  robots: { index: false, follow: false },
};

export default function DashboardOverviewPage() {
  return <OverviewScreen />;
}
