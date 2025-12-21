// app/c/[companyId]/readiness/page.tsx
// Company Flow Readiness Page
//
// Canonical "what should I do next?" view.
// Shows overall readiness + signals + ranked reasons + recommended action.

import { notFound } from 'next/navigation';
import { getCompanyById } from '@/lib/airtable/companies';
import { ReadinessClient } from './ReadinessClient';

export const dynamic = 'force-dynamic';

type PageProps = {
  params: Promise<{ companyId: string }>;
};

export default async function ReadinessPage({ params }: PageProps) {
  const { companyId } = await params;

  const company = await getCompanyById(companyId);

  if (!company) {
    return notFound();
  }

  return (
    <div className="space-y-6">
      <ReadinessClient
        companyId={companyId}
        companyName={company.name}
      />
    </div>
  );
}
