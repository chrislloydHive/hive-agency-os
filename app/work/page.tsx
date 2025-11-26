/**
 * Work Module - Global Workboard
 *
 * Shows all work items across companies with filters for:
 * - Mine / All
 * - Status (Backlog, Planned, In Progress, Done)
 * - Area (Brand, Content, SEO, Website UX, Funnel, Other)
 * - Company
 * - Company Stage (Prospect, Client, Internal, Dormant, Lost)
 */

import { Suspense } from 'react';
import { base } from '@/lib/airtable/client';
import {
  getAllCompanies,
  parseCompanyStage,
  type CompanyRecord,
  type CompanyStage,
} from '@/lib/airtable/companies';
import { WorkboardClient } from '@/components/os/WorkboardClient';
import type { WorkSource } from '@/lib/types/work';

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

  // Enrich work items with company names and stages
  const enrichedItems = workItems.map((item) => {
    const company = item.companyId ? companyLookup.get(item.companyId) : undefined;
    return {
      ...item,
      companyName: company?.name,
      // Use lookup field if available, otherwise fall back to company record stage
      companyStage: item.companyStageFromLookup ?? parseCompanyStage(company?.stage),
    };
  });

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

    return records.map((record) => {
      // Get Company Stage from lookup field (returns array for lookup fields)
      const companyStageRaw = record.fields['Company Stage'];
      const companyStageLabel = Array.isArray(companyStageRaw)
        ? companyStageRaw[0]
        : (companyStageRaw as string | undefined);

      // Get Owner Name from lookup field (returns array for lookup fields)
      const ownerNameRaw = record.fields['Owner Name'];
      const ownerName = Array.isArray(ownerNameRaw)
        ? ownerNameRaw[0]
        : (ownerNameRaw as string | undefined);

      // Parse source JSON if available
      let source: WorkSource | undefined;
      const sourceJson = record.fields['Source JSON'] as string | undefined;
      if (sourceJson) {
        try {
          source = JSON.parse(sourceJson) as WorkSource;
        } catch {
          // Invalid JSON, leave source undefined
        }
      }

      return {
        id: record.id,
        title: (record.fields['Title'] as string) || 'Untitled',
        companyId: (record.fields['Company'] as string[])?.[0],
        companyStageFromLookup: parseCompanyStage(companyStageLabel),
        area: record.fields['Area'] as string,
        status: (record.fields['Status'] as string) || 'Backlog',
        severity: record.fields['Severity'] as string,
        owner: record.fields['Owner'] as string,
        ownerName: ownerName,
        dueDate: record.fields['Due Date'] as string,
        notes: record.fields['Notes'] as string,
        effort: record.fields['Effort'] as string,
        impact: record.fields['Impact'] as string,
        createdAt: record.fields['Created At'] as string,
        updatedAt: record.fields['Updated At'] as string,
        lastTouchedAt: record.fields['Last Touched At'] as string,
        aiAdditionalInfo: record.fields['AI Additional Info'] as string,
        source,
      };
    });
  } catch (error) {
    console.error('[Work] Failed to fetch work items:', error);
    return [];
  }
}

// Loading skeleton for work board
function WorkboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Stats skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
            <div className="h-8 w-12 bg-slate-700 rounded mb-2" />
            <div className="h-3 w-16 bg-slate-800 rounded" />
          </div>
        ))}
      </div>
      {/* Filter bar skeleton */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
        <div className="flex gap-4">
          <div className="h-8 w-24 bg-slate-800 rounded" />
          <div className="h-8 w-48 bg-slate-800 rounded flex-1" />
          <div className="h-8 w-24 bg-slate-800 rounded" />
        </div>
      </div>
      {/* Board skeleton */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
        <div className="h-6 w-24 bg-slate-700 rounded mb-4" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-slate-800/50 rounded-lg p-4 h-24" />
          ))}
        </div>
      </div>
    </div>
  );
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

      <Suspense fallback={<WorkboardSkeleton />}>
        <WorkboardClient workItems={workItems} companies={companies} />
      </Suspense>
    </div>
  );
}
