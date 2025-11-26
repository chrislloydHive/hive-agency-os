// app/c/[companyId]/client-brain/page.tsx
// Client Brain Page - Strategic insights storage for a company

import { getCompanyById } from '@/lib/airtable/companies';
import { listClientInsightsForCompany } from '@/lib/airtable/clientInsights';
import { listDiagnosticRunsForCompany } from '@/lib/os/diagnostics/runs';
import { ClientBrainPageClient } from './ClientBrainPageClient';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ companyId: string }>;
}

export default async function ClientBrainPage({ params }: PageProps) {
  const { companyId } = await params;

  // Fetch company and insights in parallel
  const [company, insights, diagnosticRuns] = await Promise.all([
    getCompanyById(companyId),
    listClientInsightsForCompany(companyId, { limit: 100 }),
    listDiagnosticRunsForCompany(companyId),
  ]);

  if (!company) {
    return (
      <div className="p-6 text-center">
        <p className="text-slate-400">Company not found</p>
      </div>
    );
  }

  // Get completed diagnostic runs for extraction
  const completedRuns = diagnosticRuns.filter((r) => r.status === 'complete');

  return (
    <ClientBrainPageClient
      companyId={companyId}
      companyName={company.name}
      initialInsights={insights}
      diagnosticRuns={completedRuns}
    />
  );
}
