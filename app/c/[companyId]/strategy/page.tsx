// app/c/[companyId]/strategy/page.tsx
// Strategy Workspace Page
//
// V4 (artifact-based) workspace is the default.
// V3 (single document) available via ?v=3 query param.

import { notFound } from 'next/navigation';
import { getCompanyById } from '@/lib/airtable/companies';
import { getActiveStrategy } from '@/lib/os/strategy';
import { getCompanyContext } from '@/lib/os/context';
import { getArtifactsForCompany } from '@/lib/os/strategy/artifacts';
import { getStrategyInputs } from '@/lib/os/strategy/strategyInputs';
import { getProgramsForCompany } from '@/lib/airtable/programs';
import { StrategyWorkspaceClient } from './StrategyWorkspaceClient';
import { StrategyWorkspaceV4Client } from './StrategyWorkspaceV4Client';

export const dynamic = 'force-dynamic';

type PageProps = {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ v?: string }>;
};

export default async function StrategyPage({ params, searchParams }: PageProps) {
  const { companyId } = await params;
  const { v: version } = await searchParams;

  // V4 is default, use V3 only if ?v=3 query param is present
  const useV3 = version === '3';

  // Fetch all required data in parallel
  const [company, strategy, context, artifacts, strategyInputs, websitePrograms] = await Promise.all([
    getCompanyById(companyId),
    getActiveStrategy(companyId),
    getCompanyContext(companyId),
    useV3 ? Promise.resolve([]) : getArtifactsForCompany(companyId),
    useV3 ? Promise.resolve(null) : getStrategyInputs(companyId),
    useV3 ? Promise.resolve([]) : getProgramsForCompany(companyId, 'website'),
  ]);

  if (!company) {
    return notFound();
  }

  // V3 Workspace: Single document mode (legacy, via ?v=3)
  if (useV3) {
    return (
      <div className="space-y-6">
        <StrategyWorkspaceClient
          companyId={companyId}
          companyName={company.name}
          initialStrategy={strategy}
          contextObjectives={context?.objectives || []}
        />
      </div>
    );
  }

  // V4 Workspace: 3-column layout with artifacts (default)
  // Build programs info for CTA visibility
  // Use most recently updated program for comparison
  const latestProgram = websitePrograms.length > 0 ? websitePrograms[0] : null;
  const programsInfo = {
    hasWebsiteProgram: websitePrograms.length > 0,
    programUpdatedAt: latestProgram?.updatedAt || null,
  };

  return (
    <div className="space-y-6">
      <StrategyWorkspaceV4Client
        companyId={companyId}
        companyName={company.name}
        initialStrategy={strategy}
        initialArtifacts={artifacts}
        strategyInputs={strategyInputs!}
        programsInfo={programsInfo}
      />
    </div>
  );
}
