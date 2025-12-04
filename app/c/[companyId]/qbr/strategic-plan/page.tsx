// app/c/[companyId]/qbr/strategic-plan/page.tsx
// Strategic Plan Page - Server Component
//
// The durable "living strategy" that powers QBR, SSM, AI insights, and execution.
// Shows current strategy populated from Context Graph, allows edits,
// and supports snapshot creation for quarterly reviews.

import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getCompanyById } from '@/lib/airtable/companies';
import { loadContextGraph } from '@/lib/contextGraph/storage';
import { extractStrategyWithMeta, type StrategyFieldWithMeta } from '@/lib/contextGraph/domain-writers/strategyWriter';
import { getSnapshotById, getLatestSnapshotByType } from '@/lib/contextGraph/snapshots';
import { StrategicPlanClient } from './StrategicPlanClient';

// ============================================================================
// Types
// ============================================================================

interface PageProps {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ snapshotId?: string }>;
}

// ============================================================================
// Metadata
// ============================================================================

export const metadata: Metadata = {
  title: 'Strategic Plan - QBR',
};

// ============================================================================
// Page Component
// ============================================================================

export default async function StrategicPlanPage({ params, searchParams }: PageProps) {
  const { companyId } = await params;
  const { snapshotId } = await searchParams;

  // Load company info
  const company = await getCompanyById(companyId);
  if (!company) {
    notFound();
  }

  // Determine if viewing a snapshot or live data
  let graph;
  let isSnapshotView = false;
  let snapshotLabel: string | undefined;
  let snapshotDate: string | undefined;

  if (snapshotId) {
    // Load from snapshot
    const snapshot = await getSnapshotById(snapshotId);
    if (snapshot) {
      graph = snapshot.graph;
      isSnapshotView = true;
      snapshotLabel = snapshot.label;
      snapshotDate = snapshot.createdAt;
    } else {
      // Snapshot not found, fall back to live
      graph = await loadContextGraph(companyId);
    }
  } else {
    // Load live context graph
    graph = await loadContextGraph(companyId);
  }

  // Extract strategy fields with metadata
  let strategyFields: StrategyFieldWithMeta[] = [];
  if (graph) {
    strategyFields = extractStrategyWithMeta(graph);
  }

  // Get latest QBR snapshot for reference
  const latestQbrSnapshot = await getLatestSnapshotByType(companyId, 'qbr');

  return (
    <StrategicPlanClient
      companyId={companyId}
      companyName={company.name}
      strategyFields={strategyFields}
      isSnapshotView={isSnapshotView}
      snapshotId={snapshotId}
      snapshotLabel={snapshotLabel}
      snapshotDate={snapshotDate}
      latestQbrSnapshotId={latestQbrSnapshot?.id}
      latestQbrSnapshotLabel={latestQbrSnapshot?.label}
      latestQbrSnapshotDate={latestQbrSnapshot?.createdAt}
      hasGraph={!!graph}
    />
  );
}
