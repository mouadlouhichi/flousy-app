import type { Metadata } from 'next';
import { KnowledgeScreen } from '@/components/dashboard/screens/knowledge-screen';

export const metadata: Metadata = {
  title: 'Ingredient knowledge',
  description: 'Scan or type a barcode and understand the label: ingredients, EU allergens, additives.',
  robots: { index: false, follow: false },
};

export default function KnowledgePage() {
  return <KnowledgeScreen />;
}
