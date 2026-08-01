import type { Metadata } from 'next';
import { SavingsScreen } from '@/components/dashboard/screens/savings-screen';

export const metadata: Metadata = {
  title: 'Savings Goals',
  description: 'Manage your savings goals.',
  robots: { index: false, follow: false },
};

export default function SavingsPage() {
  return <SavingsScreen />;
}
