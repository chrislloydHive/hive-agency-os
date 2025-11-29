// app/c/[companyId]/tools/page.tsx
// Tools Hub - Central registry of all company diagnostic and planning tools
//
// This page displays all available tools for a company, including:
// - GAP IA (Initial Assessment)
// - Full GAP Plan
// - Website Lab
// - Analytics Scan
// - And more as they become available

import { notFound } from 'next/navigation';
import { getCompanyById } from '@/lib/airtable/companies';
import { listDiagnosticRunsForCompany } from '@/lib/os/diagnostics/runs';
import { CompanyToolsTab } from '@/components/os/CompanyToolsTab';

type PageProps = {
  params: Promise<{ companyId: string }>;
};

export const dynamic = 'force-dynamic';

export default async function ToolsPage({ params }: PageProps) {
  const { companyId } = await params;

  // Fetch company
  const company = await getCompanyById(companyId);
  if (!company) {
    return notFound();
  }

  // Fetch all diagnostic runs for this company
  const diagnosticRuns = await listDiagnosticRunsForCompany(companyId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <h1 className="text-xl font-bold text-slate-100">Tools</h1>
        <p className="mt-1 text-sm text-slate-400">
          Diagnostic and planning tools for {company.name}
        </p>
      </div>

      {/* Tools Grid */}
      <CompanyToolsTab
        companyId={companyId}
        company={company}
        diagnosticRuns={diagnosticRuns}
      />
    </div>
  );
}
