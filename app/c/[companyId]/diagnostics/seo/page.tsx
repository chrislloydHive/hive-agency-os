// app/c/[companyId]/diagnostics/seo/page.tsx
// SEO Diagnostics Page
//
// Uses the generic ToolDiagnosticsPageClient for consistent UI and AI insights.

import { notFound } from 'next/navigation';
import { getCompanyById } from '@/lib/airtable/companies';
import { getLatestRunForCompanyAndTool } from '@/lib/os/diagnostics/runs';
import { getToolConfig } from '@/lib/os/diagnostics/tools';
import { ToolDiagnosticsPageClient } from '@/components/os/diagnostics';

type PageProps = {
  params: Promise<{ companyId: string }>;
};

export const dynamic = 'force-dynamic';

export default async function SeoDetailPage({ params }: PageProps) {
  const { companyId } = await params;

  // Fetch company
  const company = await getCompanyById(companyId);
  if (!company) {
    return notFound();
  }

  // Get tool config
  const tool = getToolConfig('seoLab');
  if (!tool) {
    return notFound();
  }

  // Fetch latest diagnostic run
  const latestRun = await getLatestRunForCompanyAndTool(companyId, 'seoLab');

  return (
    <ToolDiagnosticsPageClient
      companyId={companyId}
      companyName={company.name}
      tool={tool}
      latestRun={latestRun}
    >
      {/* Tool-specific content can be added here if needed */}
      {latestRun?.rawJson ? (
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400 mb-3">
            Technical Details
          </h2>
          <pre className="text-xs text-slate-400 overflow-x-auto bg-[#050509]/50 p-4 rounded-lg max-h-96">
            {JSON.stringify(latestRun.rawJson, null, 2)}
          </pre>
        </div>
      ) : null}
    </ToolDiagnosticsPageClient>
  );
}
