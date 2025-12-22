// app/companies/page.tsx
// Companies Directory Page - OS CRM Index
// Server component that fetches enriched company data and renders directory client

import { Suspense } from 'react';
import { aggregateCompaniesData } from '@/lib/os/companies/aggregate';
import type {
  CompanyListFilterV2,
  CompanyStage,
  AttentionFilter,
  SortField,
  SortDirection,
} from '@/lib/os/companies/types';
import { CompaniesDirectoryClientV2 } from '@/components/os/companies/CompaniesDirectoryClientV2';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Companies',
  description: 'Manage your client roster. Track health, scores, and prioritize who needs attention.',
};

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface CompaniesPageProps {
  searchParams: Promise<{
    stage?: string;
    q?: string;
    attention?: string;
    sortBy?: string;
    sortDirection?: string;
  }>;
}

function CompaniesLoading() {
  return (
    <div className="p-8">
      <div className="mb-6">
        <div className="h-8 w-48 bg-slate-800 rounded animate-pulse" />
        <div className="h-4 w-96 bg-slate-800/50 rounded mt-2 animate-pulse" />
      </div>
      <div className="space-y-4">
        {/* Attention chips skeleton */}
        <div className="flex gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-8 w-28 bg-slate-800 rounded-lg animate-pulse" />
          ))}
        </div>
        {/* Tabs skeleton */}
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-10 w-24 bg-slate-800 rounded-lg animate-pulse" />
          ))}
        </div>
        {/* Search/filters skeleton */}
        <div className="h-12 bg-slate-800/50 rounded-lg animate-pulse" />
        {/* Table skeleton */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
          {[1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div key={i} className="h-14 bg-slate-800/30 rounded mb-2 animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  );
}

async function CompaniesContent({ searchParams }: CompaniesPageProps) {
  const params = await searchParams;

  // Build filter from search params
  const filter: CompanyListFilterV2 = {
    stage: (params.stage as CompanyStage | 'All') || 'All',
    search: params.q || '',
    attention: params.attention as AttentionFilter | undefined,
    sortBy: (params.sortBy as SortField) || 'lastActivity',
    sortDirection: (params.sortDirection as SortDirection) || 'desc',
  };

  // Fetch aggregated company data
  const { companies, summary } = await aggregateCompaniesData(filter);

  // Determine default stage: show Clients tab if there are any clients
  const hasClients = summary.countsByStage.client > 0;
  if (!params.stage && hasClients) {
    filter.stage = 'Client';
    // Re-fetch with Client filter
    const { companies: clientCompanies } = await aggregateCompaniesData(filter);
    return (
      <div className="p-8">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-100">Companies</h1>
            <p className="text-slate-400 mt-1">
              Track health, activity, and prioritize who needs attention.
            </p>
          </div>
          <a
            href="/c/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-900 font-medium rounded-lg transition-colors text-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Company
          </a>
        </div>

        <CompaniesDirectoryClientV2
          initialCompanies={clientCompanies}
          summary={summary}
          initialFilter={filter}
        />
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-100">Companies</h1>
          <p className="text-slate-400 mt-1">
            Track health, activity, and prioritize who needs attention.
          </p>
        </div>
        <a
          href="/c/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-900 font-medium rounded-lg transition-colors text-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Company
        </a>
      </div>

      <CompaniesDirectoryClientV2
        initialCompanies={companies}
        summary={summary}
        initialFilter={filter}
      />
    </div>
  );
}

export default async function CompaniesPage(props: CompaniesPageProps) {
  return (
    <Suspense fallback={<CompaniesLoading />}>
      <CompaniesContent {...props} />
    </Suspense>
  );
}
