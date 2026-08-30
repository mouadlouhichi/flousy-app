import type { Metadata } from 'next';
import { CoursesScreen } from '@/components/dashboard/screens/courses-screen';

export const metadata: Metadata = {
  title: 'Courses',
  description: 'Capture a shopping trip: scan barcodes, add prices, finish with a bill.',
  robots: { index: false, follow: false },
};

export default function CoursesPage() {
  return <CoursesScreen />;
}
