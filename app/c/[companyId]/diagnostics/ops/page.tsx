// app/c/[companyId]/diagnostics/ops/page.tsx
// Ops Diagnostics Page
//
// Uses the generic ToolDiagnosticsPageClient for consistent UI and AI insights.

import { notFound } from 'next/navigation';
import { getCompanyById } from '@/lib/airtable/companies';
import { listDiagnosticRunsForCompany } from '@/lib/os/diagnostics/runs';
import { getToolConfig } from '@/lib/os/diagnostics/tools';
import { ToolDiagnosticsPageClient } from '@/components/os/diagnostics';

type PageProps = {
  params: Promise<{ companyId: string }>;
};

export const dynamic = 'force-dynamic';

export default async function OpsDetailPage({ params }: PageProps) {
  const { companyId } = await params;

  // Fetch company
  const company = await getCompanyById(companyId);
  if (!company) {
    return notFound();
  }

  // Get tool config
  const tool = getToolConfig('opsLab');
  if (!tool) {
    return notFound();
  }

  // Fetch all diagnostic runs for this tool (sorted by date desc)
  const allRuns = await listDiagnosticRunsForCompany(companyId, {
    toolId: 'opsLab',
    limit: 20,
  });
  const latestRun = allRuns.length > 0 ? allRuns[0] : null;

  return (
    <ToolDiagnosticsPageClient
      companyId={companyId}
      companyName={company.name}
      tool={tool}
      latestRun={latestRun}
      allRuns={allRuns}
    >
      {/* Ops Lab coming soon - minimal content */}
      {latestRun?.rawJson ? (
        <div className="text-sm text-slate-400">
          <p>Ops Lab diagnostic data available. View full report for details.</p>
        </div>
      ) : null}
    </ToolDiagnosticsPageClient>
  );
}
