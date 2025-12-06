// app/c/[companyId]/brain/map/page.tsx
// Strategic Map View 2.0 - Server Component
//
// Multi-mode, AI-powered strategic intelligence visualization.
// Features: Mode switching, ghost nodes, AI summaries, inline editing.

import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getCompanyById } from '@/lib/airtable/companies';
import { loadContextGraph } from '@/lib/contextGraph/storage';
import { createEmptyContextGraph } from '@/lib/contextGraph/companyContextGraph';
import { computeContextHealthScore } from '@/lib/contextGraph/health';
import { buildStrategicMapGraph } from '@/lib/contextGraph/strategicMap';
import { queryInsights } from '@/lib/insights/engine';
import { StrategicMapClient } from './StrategicMapClient';

// ============================================================================
// Types
// ============================================================================

interface PageProps {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ focus?: string; mode?: string }>;
}

// ============================================================================
// Metadata
// ============================================================================

export const metadata: Metadata = {
  title: 'Brain - Strategic Map',
};

// ============================================================================
// Page Component
// ============================================================================

export default async function StrategicMapPage({ params, searchParams }: PageProps) {
  const { companyId } = await params;
  const { focus } = await searchParams;

  // Load company info
  const company = await getCompanyById(companyId);
  if (!company) {
    notFound();
  }

  // Load context graph, health score, and insights in parallel
  const [graph, healthScore, globalInsights] = await Promise.all([
    loadContextGraph(companyId),
    computeContextHealthScore(companyId),
    queryInsights(companyId, { limit: 50 }).catch(() => []),
  ]);

  const isNewGraph = !graph;

  // Create empty graph if none exists
  const contextGraph = graph || createEmptyContextGraph(companyId, company.name);

  // Build the strategic map graph with insights for node metadata
  const mapGraph = buildStrategicMapGraph(contextGraph, healthScore, globalInsights);

  return (
    <StrategicMapClient
      companyId={companyId}
      companyName={company.name}
      mapGraph={mapGraph}
      healthScore={healthScore}
      isNewGraph={isNewGraph}
      focusNodeId={focus}
      globalInsights={globalInsights}
    />
  );
}
