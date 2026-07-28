import type { Metadata } from 'next';
import { AppProviders } from '@/components/app-providers';

export const metadata: Metadata = {
  title: 'Dashboard',
  description: 'Your private Flousy budgeting dashboard.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
