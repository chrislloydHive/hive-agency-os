// app/c/[companyId]/projects/website-optimize/generate/page.tsx
// Website Optimization Generation Page
//
// This page triggers and displays website optimization recommendations.

import { notFound } from 'next/navigation';
import { getCompanyById } from '@/lib/airtable/companies';
import { loadContextGraph } from '@/lib/contextGraph/storage';
import { checkFlowReadinessFromGraph, type FlowReadiness } from '@/lib/os/flow/readiness';
import { WebsiteOptimizeGenerateClient } from './WebsiteOptimizeGenerateClient';

export const dynamic = 'force-dynamic';

type PageProps = {
  params: Promise<{ companyId: string }>;
};

export default async function WebsiteOptimizeGeneratePage({ params }: PageProps) {
  const { companyId } = await params;

  // Fetch company and context graph in parallel
  const [company, contextGraph] = await Promise.all([
    getCompanyById(companyId),
    loadContextGraph(companyId),
  ]);

  if (!company) {
    return notFound();
  }

  // Check flow readiness
  let readiness: FlowReadiness | null = null;
  if (contextGraph) {
    readiness = checkFlowReadinessFromGraph(contextGraph, 'website_optimization', companyId);
  }

  return (
    <div className="space-y-6">
      <WebsiteOptimizeGenerateClient
        companyId={companyId}
        companyName={company.name}
        hasContextGraph={contextGraph !== null}
        initialReadiness={readiness}
      />
    </div>
  );
}
