// app/c/[companyId]/qbr/story/page.tsx
// QBR Story View - Server Page Component

import { QbrStoryClient } from './QbrStoryClient';
import { getCurrentQuarter } from '@/lib/qbr/qbrTypes';

interface PageProps {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ quarter?: string }>;
}

export default async function QbrStoryPage({ params, searchParams }: PageProps) {
  const { companyId } = await params;
  const { quarter } = await searchParams;

  // Default to current quarter if not specified
  const selectedQuarter = quarter || getCurrentQuarter();

  return <QbrStoryClient companyId={companyId} quarter={selectedQuarter} />;
}

export const metadata = {
  title: 'QBR Story',
  description: 'AI-generated quarterly business review narrative',
};
