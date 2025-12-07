// app/c/[companyId]/reports/qbr/page.tsx
// QBR Report Page - View and generate quarterly business reviews

import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getCompanyById } from '@/lib/airtable/companies';
import { getReport } from '@/lib/reports/store';
import { getCurrentQuarter } from '@/lib/reports/types';
import { QBRReportClient } from './QBRReportClient';

export const metadata: Metadata = {
  title: 'Quarterly Business Review',
};

interface PageProps {
  params: Promise<{ companyId: string }>;
}

export default async function QBRReportPage({ params }: PageProps) {
  const { companyId } = await params;

  const company = await getCompanyById(companyId);
  if (!company) {
    notFound();
  }

  // Try to load existing QBR for current quarter
  const currentQuarter = getCurrentQuarter();
  const existingReport = await getReport(companyId, 'qbr', currentQuarter);

  return (
    <QBRReportClient
      companyId={companyId}
      companyName={company.name}
      period={currentQuarter}
      existingReport={existingReport}
    />
  );
}
