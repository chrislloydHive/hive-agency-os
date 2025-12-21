// app/context-v4/[companyId]/review/page.tsx
// Context V4: Review Queue Page
//
// Shows proposed facts awaiting user confirmation.

import { Metadata } from 'next';
import { redirect, notFound } from 'next/navigation';
import { getCompanyById } from '@/lib/airtable/companies';
import { isContextV4Enabled } from '@/lib/types/contextField';
import { ReviewQueueClient } from '@/components/context-v4/ReviewQueueClient';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ domain?: string; source?: string }>;
}

export const metadata: Metadata = {
  title: 'Review Queue - Context V4',
};

export default async function ContextV4ReviewPage({
  params,
  searchParams,
}: PageProps) {
  // Feature flag check
  if (!isContextV4Enabled()) {
    redirect('/');
  }

  const { companyId } = await params;
  const { domain, source } = await searchParams;

  // Load company
  const company = await getCompanyById(companyId);
  if (!company) {
    notFound();
  }

  return (
    <ReviewQueueClient
      companyId={companyId}
      companyName={company.name}
      initialDomain={domain}
      initialSource={source}
    />
  );
}
