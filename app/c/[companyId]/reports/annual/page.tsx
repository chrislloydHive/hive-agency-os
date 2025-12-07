// app/c/[companyId]/reports/annual/page.tsx
// Annual Plan Page - View and generate annual marketing plan

import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getCompanyById } from '@/lib/airtable/companies';
import { getReport } from '@/lib/reports/store';
import { getCurrentYear } from '@/lib/reports/types';
import { AnnualPlanClient } from './AnnualPlanClient';

export const metadata: Metadata = {
  title: 'Annual Plan',
};

interface PageProps {
  params: Promise<{ companyId: string }>;
}

export default async function AnnualPlanPage({ params }: PageProps) {
  const { companyId } = await params;

  const company = await getCompanyById(companyId);
  if (!company) {
    notFound();
  }

  // Try to load existing annual plan for current year
  const currentYear = getCurrentYear();
  const existingReport = await getReport(companyId, 'annual', currentYear);

  return (
    <AnnualPlanClient
      companyId={companyId}
      companyName={company.name}
      period={currentYear}
      existingReport={existingReport}
    />
  );
}
