// app/c/[companyId]/notes/page.tsx
// Company Notes/Activity page - Shows timeline of company activity

import { notFound } from 'next/navigation';
import { getCompanyById } from '@/lib/airtable/companies';
import { getGapIaRunsForCompany } from '@/lib/airtable/gapIaRuns';
import { getGapPlanRunsForCompany } from '@/lib/airtable/gapPlanRuns';
import { getWorkItemsForCompany } from '@/lib/airtable/workItems';
import { CompanyNotesTab } from '@/components/os/CompanyNotesTab';

export const dynamic = 'force-dynamic';

type PageProps = {
  params: Promise<{ companyId: string }>;
};

export default async function CompanyNotesPage({ params }: PageProps) {
  const { companyId } = await params;

  const [company, gapIaRuns, gapPlanRuns, workItems] = await Promise.all([
    getCompanyById(companyId),
    getGapIaRunsForCompany(companyId, 50),
    getGapPlanRunsForCompany(companyId, 50),
    getWorkItemsForCompany(companyId),
  ]);

  if (!company) {
    return notFound();
  }

  return (
    <div className="space-y-6">
      <CompanyNotesTab
        company={company}
        gapIaRuns={gapIaRuns}
        gapPlanRuns={gapPlanRuns}
        workItems={workItems}
      />
    </div>
  );
}
