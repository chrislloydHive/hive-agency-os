// app/c/[companyId]/reports/page.tsx
// Reports Hub - Dashboard for Annual Plan and QBR reports
//
// Shows available report types with:
// - Last generated date
// - Generate / View Latest CTAs
// - Report history

import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getCompanyById } from '@/lib/airtable/companies';
import { ReportsHubClient } from './ReportsHubClient';
import { getLatestReportByType } from '@/lib/reports/store';

export const metadata: Metadata = {
  title: 'Reports',
};

interface PageProps {
  params: Promise<{ companyId: string }>;
}

export default async function ReportsPage({ params }: PageProps) {
  const { companyId } = await params;

  const company = await getCompanyById(companyId);
  if (!company) {
    notFound();
  }

  // Fetch latest reports for each type
  const [latestAnnual, latestQbr] = await Promise.all([
    getLatestReportByType(companyId, 'annual'),
    getLatestReportByType(companyId, 'qbr'),
  ]);

  return (
    <ReportsHubClient
      companyId={companyId}
      companyName={company.name}
      latestAnnual={latestAnnual}
      latestQbr={latestQbr}
    />
  );
}
