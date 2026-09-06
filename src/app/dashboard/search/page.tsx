import type { Metadata } from 'next';
import { SearchScreen } from '@/components/dashboard/screens/search-screen';

export const metadata: Metadata = {
  title: 'Search',
  description: 'Search transactions across months.',
  robots: { index: false, follow: false },
};

export default function SearchPage() {
  return <SearchScreen />;
}
