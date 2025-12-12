// app/c/[companyId]/reports/qbr-lite/page.tsx
// QBR Lite Report View

import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getCompanyById } from '@/lib/airtable/companies';
import { QbrLiteClient } from './QbrLiteClient';

export const metadata: Metadata = {
  title: 'QBR Lite',
};

interface PageProps {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ quarter?: string; year?: string }>;
}

export default async function QbrLitePage({ params, searchParams }: PageProps) {
  const { companyId } = await params;
  const { quarter, year } = await searchParams;

  const company = await getCompanyById(companyId);
  if (!company) {
    notFound();
  }

  // Parse quarter/year from query params or use current
  const now = new Date();
  const reportQuarter = quarter ? parseInt(quarter, 10) : Math.ceil((now.getMonth() + 1) / 3);
  const reportYear = year ? parseInt(year, 10) : now.getFullYear();

  return (
    <QbrLiteClient
      companyId={companyId}
      companyName={company.name}
      quarter={reportQuarter}
      year={reportYear}
    />
  );
}
