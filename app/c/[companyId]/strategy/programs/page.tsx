// app/c/[companyId]/strategy/programs/page.tsx
// Programs Workspace Page
//
// Supports Website and Content Programs
// Shows program editor with inputs panel and readiness gates

import { notFound } from 'next/navigation';
import { getCompanyById } from '@/lib/airtable/companies';
import { loadContextGraph } from '@/lib/contextGraph/storage';
import { readStrategyFromContextGraph } from '@/lib/contextGraph/domain-writers/strategyWriter';
import { getProgramsForCompany } from '@/lib/airtable/programs';
import { ProgramsClient } from './ProgramsClient';
import type { CompanyContextGraph } from '@/lib/contextGraph/companyContextGraph';

export const dynamic = 'force-dynamic';

type PageProps = {
  params: Promise<{ companyId: string }>;
};

// ============================================================================
// Freshness Helpers
// ============================================================================

/**
 * Extract the most recent timestamp from a context graph field's provenance
 */
function getFieldTimestamp(field: { provenance?: Array<{ updatedAt?: string }> } | undefined): string | null {
  if (!field?.provenance?.length) return null;
  const sorted = [...field.provenance].sort((a, b) => {
    const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
    const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
    return bTime - aTime;
  });
  return sorted[0]?.updatedAt || null;
}

/**
 * Compute freshness data from the context graph
 */
function computeFreshnessData(
  contextGraph: CompanyContextGraph | null,
  programUpdatedAt: string | null
): {
  contextUpdatedAt: string | null;
  strategyUpdatedAt: string | null;
  websiteLabUpdatedAt: string | null;
  contentLabUpdatedAt: string | null;
  programUpdatedAt: string | null;
} {
  if (!contextGraph) {
    return {
      contextUpdatedAt: null,
      strategyUpdatedAt: null,
      websiteLabUpdatedAt: null,
      contentLabUpdatedAt: null,
      programUpdatedAt,
    };
  }

  // Context updated at - from meta
  const contextUpdatedAt = contextGraph.meta?.updatedAt || null;

  // Strategy updated at - check brand positioning or primary objective provenance
  const strategyUpdatedAt = getFieldTimestamp(
    contextGraph.brand?.positioning as { provenance?: Array<{ updatedAt?: string }> }
  ) || getFieldTimestamp(
    contextGraph.objectives?.primaryObjective as { provenance?: Array<{ updatedAt?: string }> }
  );

  // Website Lab updated at - check executiveSummary provenance
  const websiteLabUpdatedAt = getFieldTimestamp(
    contextGraph.website?.executiveSummary as { provenance?: Array<{ updatedAt?: string }> }
  );

  // Content Lab updated at - check contentSummary provenance
  const contentLabUpdatedAt = getFieldTimestamp(
    contextGraph.content?.contentSummary as { provenance?: Array<{ updatedAt?: string }> }
  );

  return {
    contextUpdatedAt,
    strategyUpdatedAt,
    websiteLabUpdatedAt,
    contentLabUpdatedAt,
    programUpdatedAt,
  };
}

export default async function ProgramsPage({ params }: PageProps) {
  const { companyId } = await params;

  // Fetch all required data in parallel (all program types)
  const [company, contextGraph, strategyData, programs] = await Promise.all([
    getCompanyById(companyId),
    loadContextGraph(companyId),
    readStrategyFromContextGraph(companyId),
    getProgramsForCompany(companyId),
  ]);

  if (!company) {
    return notFound();
  }

  // Build inputs summary for the left panel
  const inputsSummary = {
    context: {
      hasContext: !!contextGraph,
      businessModel: contextGraph?.identity?.businessModel?.value || null,
      primaryOffering: contextGraph?.productOffer?.primaryProducts?.value?.[0] || null,
      primaryAudience: contextGraph?.audience?.primaryAudience?.value || null,
      primaryObjective: contextGraph?.objectives?.primaryObjective?.value || null,
      geographicFootprint: contextGraph?.identity?.geographicFootprint?.value || null,
      websiteScore: contextGraph?.website?.websiteScore?.value || null,
      hasWebsiteLab: !!(contextGraph?.website?.executiveSummary?.value),
      contentScore: contextGraph?.content?.contentScore?.value || null,
      hasContentLab: !!(contextGraph?.content?.contentSummary?.value),
    },
    strategy: {
      hasStrategy: !!strategyData && Object.keys(strategyData).length > 0,
      positioning: (strategyData?.['strategy.positioning'] as string) || null,
      primaryObjective: (strategyData?.['objectives.primaryObjective'] as string) || null,
    },
  };

  // Compute freshness data
  const latestProgram = programs.length > 0 ? programs[0] : null;
  const freshnessData = computeFreshnessData(contextGraph, latestProgram?.updatedAt || null);

  return (
    <ProgramsClient
      companyId={companyId}
      companyName={company.name}
      initialPrograms={programs}
      inputsSummary={inputsSummary}
      freshnessData={freshnessData}
    />
  );
}
