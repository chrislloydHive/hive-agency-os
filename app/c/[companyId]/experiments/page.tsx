// app/c/[companyId]/experiments/page.tsx
// Company experiments tab - shows experiments for a specific company

import { getCompanyById } from '@/lib/airtable/companies';
import { notFound } from 'next/navigation';
import { ExperimentsClient } from '@/components/experiments/ExperimentsClient';

interface PageProps {
  params: Promise<{ companyId: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { companyId } = await params;
  const company = await getCompanyById(companyId);

  if (!company) {
    return { title: 'Company Not Found | Hive OS' };
  }

  return {
    title: `Experiments | ${company.name} | Hive OS`,
    description: `Track experiments and A/B tests for ${company.name}`,
  };
}

export default async function CompanyExperimentsPage({ params }: PageProps) {
  const { companyId } = await params;
  const company = await getCompanyById(companyId);

  if (!company) {
    notFound();
  }

  return (
    <ExperimentsClient
      companyId={companyId}
      companyName={company.name}
      showCompanyColumn={false}
      title="Experiments"
      description={`Track A/B tests and growth experiments for ${company.name}`}
    />
  );
}
