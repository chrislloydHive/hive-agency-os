// app/c/[companyId]/work/page.tsx
// Work Hub - Tasks, Experiments, and Backlog
//
// This page now includes:
// - Tasks: Active work items (In Progress, Planned, Done)
// - Experiments: A/B tests and growth experiments
// - Backlog: Suggested work from diagnostics

import { notFound } from 'next/navigation';
import { getCompanyById } from '@/lib/airtable/companies';
import { getFullReportsForCompany } from '@/lib/airtable/fullReports';
import { getWorkItemsForCompany, getWorkItemsForCompanyByPriorityId } from '@/lib/airtable/workItems';
import { getCompanyStrategySnapshot } from '@/lib/os/companies/strategySnapshot';
import type { PrioritiesPayload } from '@/lib/airtable/fullReports';
import type { EvidencePayload } from '@/lib/gap/types';
import { WorkClient } from './WorkClient';

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
    title: `Work | ${company.name} | Hive OS`,
    description: `Tasks, experiments, and opportunities for ${company.name}`,
  };
}

export default async function WorkPage({ params }: PageProps) {
  const { companyId } = await params;

  // Load company
  const company = await getCompanyById(companyId);
  if (!company) {
    return notFound();
  }

  // Load full reports for this company
  const reports = await getFullReportsForCompany(companyId);
  const latestReport = reports[0]; // Assuming sorted newest first

  // Load work items
  const workItems = await getWorkItemsForCompany(companyId);

  // Load work items indexed by priority ID for quick lookup
  const workItemsByPriorityId = await getWorkItemsForCompanyByPriorityId(companyId);

  // Load strategic snapshot for focus areas
  const strategicSnapshot = await getCompanyStrategySnapshot(companyId);

  // Extract priorities from latest report
  const prioritiesPayload: PrioritiesPayload | undefined = latestReport?.prioritiesJson;
  const priorities = prioritiesPayload?.items || [];

  // Extract evidence (telemetry) from latest report
  const evidence = latestReport?.evidenceJson as EvidencePayload | undefined;

  return (
    <WorkClient
      company={{
        id: company.id,
        name: company.name,
        website: company.website,
      }}
      workItems={workItems}
      priorities={priorities}
      evidence={evidence}
      strategicSnapshot={strategicSnapshot}
      fullReportId={latestReport?.id}
      workItemsByPriorityId={workItemsByPriorityId}
    />
  );
}
