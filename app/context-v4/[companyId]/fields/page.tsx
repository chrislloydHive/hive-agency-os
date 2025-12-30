// app/context-v4/[companyId]/fields/page.tsx
// Context V4: All Fields Page
//
// Searchable table of all context fields with status, source, and confidence.

import { Metadata } from 'next';
import { redirect, notFound } from 'next/navigation';
import { getCompanyById } from '@/lib/airtable/companies';
import { isContextV4Enabled } from '@/lib/types/contextField';
import { FieldsClient } from '@/components/context-v4/FieldsClient';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ q?: string; status?: string; domain?: string }>;
}

export const metadata: Metadata = {
  title: 'All Fields - Context V4',
};

export default async function ContextV4FieldsPage({
  params,
  searchParams,
}: PageProps) {
  // Feature flag check
  if (!isContextV4Enabled()) {
    redirect('/');
  }

  const { companyId } = await params;
  const { q, status, domain } = await searchParams;

  // Load company
  const company = await getCompanyById(companyId);
  if (!company) {
    notFound();
  }

  return (
    <FieldsClient
      companyId={companyId}
      companyName={company.name}
      initialQuery={q}
      initialStatus={status}
      initialDomain={domain}
    />
  );
}
