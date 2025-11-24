/**
 * Work Module - Global Workboard
 *
 * Shows all work items across companies with filters for:
 * - Mine / All
 * - Status (Backlog, Planned, In Progress, Done)
 * - Area (Brand, Content, SEO, Website UX, Funnel, Other)
 * - Company
 */

import { base } from '@/lib/airtable/client';
import { getAllCompanies, type CompanyRecord } from '@/lib/airtable/companies';
import { WorkboardClient } from '@/components/os/WorkboardClient';

// Fetch all work items with company data
async function getWorkItemsWithCompanies() {
  const [workItems, companies] = await Promise.all([
    fetchAllWorkItems(),
    getAllCompanies(),
  ]);

  // Build company lookup
  const companyLookup = new Map<string, CompanyRecord>();
  for (const company of companies) {
    companyLookup.set(company.id, company);
  }

  // Enrich work items with company names
  const enrichedItems = workItems.map((item) => ({
    ...item,
    companyName: item.companyId
      ? companyLookup.get(item.companyId)?.name
      : undefined,
  }));

  return { workItems: enrichedItems, companies };
}

async function fetchAllWorkItems() {
  try {
    const records = await base('Work Items')
      .select({
        sort: [
          { field: 'Status', direction: 'asc' },
          { field: 'Due Date', direction: 'asc' },
        ],
        maxRecords: 200,
      })
      .all();

    return records.map((record) => ({
      id: record.id,
      title: (record.fields['Title'] as string) || 'Untitled',
      companyId: (record.fields['Company'] as string[])?.[0],
      area: record.fields['Area'] as string,
      status: (record.fields['Status'] as string) || 'Backlog',
      severity: record.fields['Severity'] as string,
      owner: record.fields['Owner'] as string,
      dueDate: record.fields['Due Date'] as string,
      notes: record.fields['Notes'] as string,
      effort: record.fields['Effort'] as string,
      impact: record.fields['Impact'] as string,
      createdAt: record.fields['Created At'] as string,
    }));
  } catch (error) {
    console.error('[Work] Failed to fetch work items:', error);
    return [];
  }
}

export default async function WorkPage() {
  const { workItems, companies } = await getWorkItemsWithCompanies();

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-100">Work</h1>
        <p className="text-slate-400 mt-1">
          Active tasks and deliverables across all companies
        </p>
      </div>

      <WorkboardClient workItems={workItems} companies={companies} />
    </div>
  );
}
