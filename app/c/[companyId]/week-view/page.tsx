// app/c/[companyId]/week-view/page.tsx
// Week View Dashboard - Single daily/weekly home base for programs
//
// Shows:
// - This Week Deliverables (due within 7 days)
// - Overdue Deliverables
// - Recently Created Work
// - Scope Drift Summary
// - Program Health Summary
// - Approvals Needed

import { listPlanningPrograms } from '@/lib/airtable/planningPrograms';
import { getWorkItemsForCompany } from '@/lib/airtable/workItems';
import { WeekViewClient } from './WeekViewClient';

export default async function WeekViewPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;

  // Fetch all data in parallel
  const [programs, workItems] = await Promise.all([
    listPlanningPrograms(companyId),
    getWorkItemsForCompany(companyId),
  ]);

  return (
    <WeekViewClient
      companyId={companyId}
      programs={programs}
      workItems={workItems}
    />
  );
}
