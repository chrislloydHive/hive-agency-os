// app/c/[companyId]/brain/explorer/page.tsx
// Strategic Explorer - Visual map of company context
//
// Part of the 4-tab Brain IA:
// - Explorer (this): Explore mode - visual map for discovery
// - Context: Inspect mode - field-level editor for data entry
// - Insights: Understand mode - AI-generated analysis
// - Labs: Improve mode - diagnostic tools that refine context

import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getCompanyById } from '@/lib/airtable/companies';
import { loadContextGraph } from '@/lib/contextGraph/storage';
import { createEmptyContextGraph } from '@/lib/contextGraph/companyContextGraph';
import { computeContextHealthScore } from '@/lib/contextGraph/health';
import { buildStrategicMapGraph } from '@/lib/contextGraph/strategicMap';
import { queryInsights } from '@/lib/insights/engine';
import { StrategicMapClient } from '../map/StrategicMapClient';

// ============================================================================
// Dynamic Rendering
// ============================================================================

// Force dynamic rendering to ensure fresh data after promotion
export const dynamic = 'force-dynamic';

// ============================================================================
// Types
// ============================================================================

interface PageProps {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ focus?: string }>;
}

// ============================================================================
// Metadata
// ============================================================================

export const metadata: Metadata = {
  title: 'Brain - Explorer',
};

// ============================================================================
// Page Component
// ============================================================================

export default async function ExplorerPage({ params, searchParams }: PageProps) {
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
