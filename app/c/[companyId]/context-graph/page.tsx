// app/c/[companyId]/context-graph/page.tsx
// Context Graph Viewer & Editor - Server Component

import { Suspense } from 'react';
import { getCompanyById } from '@/lib/airtable/companies';
import { loadContextGraph } from '@/lib/contextGraph/storage';
import { createEmptyContextGraph } from '@/lib/contextGraph/companyContextGraph';
import { getNeedsRefreshReport } from '@/lib/contextGraph/needsRefresh';
import { checkContextGraphHealth } from '@/lib/contextGraph/health';
import { calculateGraphSummary, formatSummaryForLog } from '@/lib/contextGraph/sectionSummary';
import { getSnapshotById } from '@/lib/contextGraph/snapshots';
import { ContextGraphClient } from './ContextGraphClient';

interface ContextGraphPageProps {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ snapshotId?: string }>;
}

export default async function ContextGraphPage({ params, searchParams }: ContextGraphPageProps) {
  const { companyId } = await params;
  const { snapshotId } = await searchParams;

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

  // Check if we're viewing a snapshot
  let snapshotInfo: { label: string; createdAt: string } | null = null;
  let graph = null;
  let isNewGraph = false;

  if (snapshotId) {
    // Load from snapshot
    const snapshot = await getSnapshotById(snapshotId);
    if (snapshot) {
      graph = snapshot.graph;
      snapshotInfo = {
        label: snapshot.label,
        createdAt: snapshot.createdAt,
      };
    }
  }

  // If not loading a snapshot (or snapshot not found), load live graph
  if (!graph) {
    graph = await loadContextGraph(companyId);
    if (!graph) {
      // Create empty graph for display (won't be saved until edited)
      graph = createEmptyContextGraph(companyId, company.name);
      isNewGraph = true;
    }
  }

  // Calculate health, coverage, and section summaries
  const health = checkContextGraphHealth(graph);
  const graphSummary = calculateGraphSummary(graph);

  // Convert section summaries to domain coverage format (0-100 percentage)
  const domainCoverage = graphSummary.sections.reduce((acc, section) => {
    acc[section.id] = Math.round(section.coverage * 100);
    return acc;
  }, {} as Record<string, number>);

  // Log summary for debugging (server-side)
  if (!isNewGraph) {
    console.log(formatSummaryForLog(graphSummary));
  }

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
        snapshotInfo={snapshotInfo}
      />
    </Suspense>
  );
}
