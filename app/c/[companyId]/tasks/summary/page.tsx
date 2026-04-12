// app/c/[companyId]/tasks/summary/page.tsx
// Daily Summary page — server component shell

import { notFound } from 'next/navigation';
import { getCompanyById } from '@/lib/airtable/companies';
import { SummaryClient } from './SummaryClient';

type PageProps = {
  params: Promise<{ companyId: string }>;
};

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: PageProps) {
  const { companyId } = await params;
  const company = await getCompanyById(companyId);

  if (!company) {
    return { title: 'Company Not Found | Hive OS' };
  }

  return {
    title: `Daily Summary | ${company.name} | Hive OS`,
    description: `Daily task summary for ${company.name} — overdue, hot, and due today`,
  };
}

export default async function SummaryPage({ params }: PageProps) {
  const { companyId } = await params;
  const company = await getCompanyById(companyId);
  if (!company) return notFound();

  return (
    <SummaryClient
      companyId={company.id}
      companyName={company.name}
    />
  );
}
