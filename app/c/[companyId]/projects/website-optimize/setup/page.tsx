// app/c/[companyId]/projects/website-optimize/setup/page.tsx
// Website Optimization Setup Page
//
// This page allows users to start a Website Optimization project
// using their existing context graph (skip Labs/GAP).
//
// Flow:
// 1. Load context graph
// 2. Check readiness for website_optimization flow
// 3. If ready, show generation options
// 4. If not ready, show what's missing with Lab CTAs

import { notFound } from 'next/navigation';
import { getCompanyById } from '@/lib/airtable/companies';
import { loadContextGraph } from '@/lib/contextGraph/storage';
import { checkFlowReadinessFromGraph, type FlowReadiness } from '@/lib/os/flow/readiness';
import { WebsiteOptimizeSetupClient } from './WebsiteOptimizeSetupClient';

export const dynamic = 'force-dynamic';

type PageProps = {
  params: Promise<{ companyId: string }>;
};

export default async function WebsiteOptimizeSetupPage({ params }: PageProps) {
  const { companyId } = await params;

  // Fetch company and context graph in parallel
  const [company, contextGraph] = await Promise.all([
    getCompanyById(companyId),
    loadContextGraph(companyId),
  ]);

  if (!company) {
    return notFound();
  }

  // Check flow readiness for website optimization
  // Requires: identity (critical), website (critical)
  // Recommended: brand, seo, audience, content
  let readiness: FlowReadiness | null = null;
  if (contextGraph) {
    readiness = checkFlowReadinessFromGraph(contextGraph, 'website_optimization', companyId);
  }

  return (
    <div className="space-y-6">
      <WebsiteOptimizeSetupClient
        companyId={companyId}
        companyName={company.name}
        hasContextGraph={contextGraph !== null}
        readiness={readiness}
      />
    </div>
  );
}
