// app/c/[companyId]/context-graph/page.tsx
// Context Graph Viewer & Editor - Server Component

import { Suspense } from 'react';
import { getCompanyById } from '@/lib/airtable/companies';
import { loadContextGraph } from '@/lib/contextGraph/storage';
import { createEmptyContextGraph, calculateDomainCoverage } from '@/lib/contextGraph/companyContextGraph';
import { getNeedsRefreshReport } from '@/lib/contextGraph/needsRefresh';
import { checkContextGraphHealth } from '@/lib/contextGraph/health';
import { ContextGraphClient } from './ContextGraphClient';

interface ContextGraphPageProps {
  params: Promise<{ companyId: string }>;
}

export default async function ContextGraphPage({ params }: ContextGraphPageProps) {
  const { companyId } = await params;

  // Load company data
  const company = await getCompanyById(companyId);
  if (!company) {
    return (
      <div className="p-8 text-center">
        <h1 className="text-xl font-semibold text-slate-300">Company Not Found</h1>
        <p className="text-slate-500 mt-2">Unable to load company data</p>
      </div>
    );
  }

  // Load or create empty context graph
  let graph = await loadContextGraph(companyId);
  let isNewGraph = false;

  if (!graph) {
    // Create empty graph for display (won't be saved until edited)
    graph = createEmptyContextGraph(companyId, company.name);
    isNewGraph = true;
  }

  // Calculate health and refresh flags
  const health = checkContextGraphHealth(graph);
  const domainCoverage = calculateDomainCoverage(graph);

  // Get refresh flags (only if graph has data)
  let refreshReport = null;
  if (!isNewGraph) {
    try {
      refreshReport = getNeedsRefreshReport(graph);
    } catch (e) {
      console.warn('[ContextGraphPage] Could not compute refresh report:', e);
    }
  }

  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-screen">
          <div className="text-slate-400">Loading Context Graph...</div>
        </div>
      }
    >
      <ContextGraphClient
        companyId={companyId}
        companyName={company.name}
        initialGraph={graph}
        isNewGraph={isNewGraph}
        health={health}
        domainCoverage={domainCoverage}
        refreshReport={refreshReport}
      />
    </Suspense>
  );
}
