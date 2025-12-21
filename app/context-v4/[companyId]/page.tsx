// app/context-v4/[companyId]/page.tsx
// Context V4: Fact Sheet Page
//
// The default view for Context V4 showing confirmed facts grouped by domain.

import { Metadata } from 'next';
import { redirect, notFound } from 'next/navigation';
import { getCompanyById } from '@/lib/airtable/companies';
import { isContextV4Enabled } from '@/lib/types/contextField';
import { FactSheetClient } from '@/components/context-v4/FactSheetClient';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ companyId: string }>;
}

export const metadata: Metadata = {
  title: 'Fact Sheet - Context V4',
};

export default async function ContextV4FactSheetPage({ params }: PageProps) {
  // Feature flag check
  if (!isContextV4Enabled()) {
    redirect('/');
  }

  const { companyId } = await params;

  // Load company
  const company = await getCompanyById(companyId);
  if (!company) {
    notFound();
  }

  return <FactSheetClient companyId={companyId} companyName={company.name} />;
}
