// app/c/[companyId]/opportunities/page.tsx
// Company Opportunities page - Shows pipeline opportunities

import { notFound } from 'next/navigation';
import { getCompanyById } from '@/lib/airtable/companies';
import { CompanyOpportunitiesTab } from '@/components/os/CompanyOpportunitiesTab';

export const dynamic = 'force-dynamic';

type PageProps = {
  params: Promise<{ companyId: string }>;
};

export default async function CompanyOpportunitiesPage({ params }: PageProps) {
  const { companyId } = await params;

  const company = await getCompanyById(companyId);

  if (!company) {
    return notFound();
  }

  return (
    <div className="space-y-6">
      <CompanyOpportunitiesTab
        companyId={companyId}
        companyName={company.name}
      />
    </div>
  );
}
