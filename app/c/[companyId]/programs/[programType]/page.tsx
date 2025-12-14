// app/c/[companyId]/programs/[programType]/page.tsx
// Program Detail Page
//
// Shows the full program editor for a specific program type (website or content)

import { notFound } from 'next/navigation';
import { getCompanyById } from '@/lib/airtable/companies';
import { loadContextGraph } from '@/lib/contextGraph/storage';
import { readStrategyFromContextGraph } from '@/lib/contextGraph/domain-writers/strategyWriter';
import { getProgramsForCompany } from '@/lib/airtable/programs';
import { ProgramsClient } from '@/app/c/[companyId]/strategy/programs/ProgramsClient';
import type { CompanyContextGraph } from '@/lib/contextGraph/companyContextGraph';
import type { ProgramType } from '@/lib/types/program';

export const dynamic = 'force-dynamic';

type PageProps = {
  params: Promise<{ companyId: string; programType: string }>;
};

// ============================================================================
// Freshness Helpers
// ============================================================================

function getFieldTimestamp(field: { provenance?: Array<{ updatedAt?: string }> } | undefined): string | null {
  if (!field?.provenance?.length) return null;
  const sorted = [...field.provenance].sort((a, b) => {
    const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
    const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
    return bTime - aTime;
  });
  return sorted[0]?.updatedAt || null;
}

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

  const contextUpdatedAt = contextGraph.meta?.updatedAt || null;

  const strategyUpdatedAt = getFieldTimestamp(
    contextGraph.brand?.positioning as { provenance?: Array<{ updatedAt?: string }> }
  ) || getFieldTimestamp(
    contextGraph.objectives?.primaryObjective as { provenance?: Array<{ updatedAt?: string }> }
  );

  const websiteLabUpdatedAt = getFieldTimestamp(
    contextGraph.website?.executiveSummary as { provenance?: Array<{ updatedAt?: string }> }
  );

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

// ============================================================================
// Page Component
// ============================================================================

export default async function ProgramDetailPage({ params }: PageProps) {
  const { companyId, programType: programTypeParam } = await params;

  // Validate program type
  if (programTypeParam !== 'website' && programTypeParam !== 'content') {
    return notFound();
  }

  const programType = programTypeParam as ProgramType;

  // Fetch all required data in parallel
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
  const programsOfType = programs.filter(p => p.type === programType);
  const latestProgram = programsOfType.length > 0 ? programsOfType[0] : null;
  const freshnessData = computeFreshnessData(contextGraph, latestProgram?.updatedAt || null);

  return (
    <ProgramsClient
      companyId={companyId}
      companyName={company.name}
      initialPrograms={programs}
      inputsSummary={inputsSummary}
      freshnessData={freshnessData}
      initialProgramType={programType}
    />
  );
}
