// app/c/[companyId]/reports/qbr/story/page.tsx
// Story QBR Page - Cinematic storytelling view

import { getCompanyById } from '@/lib/airtable/companies';
import { notFound } from 'next/navigation';
import StoryQBRClient from './StoryQBRClient';

interface PageProps {
  params: Promise<{ companyId: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { companyId } = await params;
  const company = await getCompanyById(companyId);

  return {
    title: company ? `${company.name} QBR Story | Hive OS` : 'QBR Story | Hive OS',
    description: company
      ? `Story view of the quarterly business review for ${company.name}`
      : 'Story view of quarterly business review',
  };
}

export default async function StoryQBRPage({ params }: PageProps) {
  const { companyId } = await params;

  // Load company
  const company = await getCompanyById(companyId);
  if (!company) {
    notFound();
  }

  return (
    <StoryQBRClient
      companyId={companyId}
      companyName={company.name}
    />
  );
}
