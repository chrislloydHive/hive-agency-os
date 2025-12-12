// app/c/[companyId]/reports/monthly/page.tsx
// Monthly Report View

import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getCompanyById } from '@/lib/airtable/companies';
import { MonthlyReportClient } from './MonthlyReportClient';

export const metadata: Metadata = {
  title: 'Monthly Report',
};

interface PageProps {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ month?: string; year?: string }>;
}

export default async function MonthlyReportPage({ params, searchParams }: PageProps) {
  const { companyId } = await params;
  const { month, year } = await searchParams;

  const company = await getCompanyById(companyId);
  if (!company) {
    notFound();
  }

  // Parse month/year from query params or use current
  const now = new Date();
  const reportMonth = month ? parseInt(month, 10) : now.getMonth() + 1;
  const reportYear = year ? parseInt(year, 10) : now.getFullYear();

  return (
    <MonthlyReportClient
      companyId={companyId}
      companyName={company.name}
      month={reportMonth}
      year={reportYear}
    />
  );
}
