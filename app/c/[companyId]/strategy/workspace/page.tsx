// app/c/[companyId]/strategy/workspace/page.tsx
// Strategy Workspace V4 Page
//
// 3-column layout for strategy development with artifacts

import { notFound } from 'next/navigation';
import { getCompanyById } from '@/lib/airtable/companies';
import { getActiveStrategy } from '@/lib/os/strategy';
import { getCompanyContext } from '@/lib/os/context';
import { getArtifactSummaries } from '@/lib/os/strategy/artifacts';
import { StrategyWorkspaceV4Client } from './StrategyWorkspaceV4Client';

export const dynamic = 'force-dynamic';

type PageProps = {
  params: Promise<{ companyId: string }>;
};

export default async function StrategyWorkspaceV4Page({ params }: PageProps) {
  const { companyId } = await params;

  // Fetch all required data in parallel
  const [company, strategy, context, artifacts] = await Promise.all([
    getCompanyById(companyId),
    getActiveStrategy(companyId),
    getCompanyContext(companyId),
    getArtifactSummaries(companyId),
  ]);

  if (!company) {
    return notFound();
  }

  // Build context summary for the inputs panel
  const contextSummary = {
    companyName: company.name,
    industry: context?.companyCategory || undefined,
    objectives: context?.objectives || [],
    audienceSummary: context?.icpDescription || undefined,
    competitionSummary: context?.competitorsNotes || undefined,
    contextCompleteness: calculateContextCompleteness(context),
  };

  return (
    <div className="p-6">
      <StrategyWorkspaceV4Client
        companyId={companyId}
        companyName={company.name}
        contextSummary={contextSummary}
        initialArtifacts={artifacts}
        canonicalStrategy={strategy}
      />
    </div>
  );
}

// Calculate context completeness percentage
function calculateContextCompleteness(context: unknown): number {
  if (!context || typeof context !== 'object') return 0;

  const ctx = context as Record<string, unknown>;
  // Core fields from CompanyContext that indicate completeness
  const coreFields = [
    'businessModel',
    'valueProposition',
    'icpDescription',
    'objectives',
    'competitorsNotes',
    'differentiators',
  ];
  let filled = 0;

  for (const field of coreFields) {
    const value = ctx[field];
    if (value && (Array.isArray(value) ? value.length > 0 : true)) {
      filled++;
    }
  }

  return Math.round((filled / coreFields.length) * 100);
}
