// app/companies/page.tsx
// Companies Directory Page - OS CRM Index
// Server component that fetches enriched company data and renders directory client

import { Suspense } from 'react';
import {
  listCompaniesForOsDirectory,
  type CompanyListFilter,
  type CompanyStage,
  type CompanyHealth,
} from '@/lib/os/companies/list';
import { CompaniesDirectoryClient } from '@/components/os/companies/CompaniesDirectoryClient';
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
    health?: string;
    q?: string;
    atRisk?: string;
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
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-10 w-24 bg-slate-800 rounded-lg animate-pulse" />
          ))}
        </div>
        <div className="h-12 bg-slate-800/50 rounded-lg animate-pulse" />
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 bg-slate-800/30 rounded mb-2 animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  );
}

async function CompaniesContent({ searchParams }: CompaniesPageProps) {
  const params = await searchParams;

  // Parse search params into filter
  const filter: CompanyListFilter = {
    stage: (params.stage as CompanyStage) || 'All',
    health: params.health as CompanyHealth | undefined,
    search: params.q || '',
    atRiskOnly: params.atRisk === 'true',
  };

  // Fetch companies with enriched data
  const companies = await listCompaniesForOsDirectory(filter);

  // Determine default stage view based on data
  const hasClients = companies.some((c) => c.stage === 'Client');
  const defaultStage = hasClients ? 'Client' : 'All';

  // If no stage filter was specified, use the default
  const effectiveFilter = {
    ...filter,
    stage: filter.stage || defaultStage,
  };

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-100">Companies</h1>
        <p className="text-slate-400 mt-1">
          All companies in your OS, with stage, health, owner, and activity.
        </p>
      </div>

      <CompaniesDirectoryClient
        initialCompanies={companies}
        initialFilter={effectiveFilter}
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
