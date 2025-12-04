// lib/contextGraph/contextGraphService.ts
// Service layer for ContextGraphs - manages summary records and updates

import { getBase } from '@/lib/airtable';
import { AIRTABLE_TABLES } from '@/lib/airtable/tables';
import { getCompanyById } from '@/lib/airtable/companies';
import {
  CompanyContextGraph,
  createEmptyContextGraph,
} from './companyContextGraph';
import { loadContextGraph, saveContextGraph } from './storage';
import {
  ContextGraphSummary,
  ContextGraphSectionSummary,
  calculateGraphSummary,
  recalculateSectionFromPath,
  formatSummaryForLog,
} from './sectionSummary';

const CONTEXT_GRAPHS_TABLE = AIRTABLE_TABLES.CONTEXT_GRAPHS;

// ============================================================================
// Extended Record Type (includes section summaries)
// ============================================================================

export interface ContextGraphRecordWithSummary {
  id: string; // Airtable record ID
  companyId: string;
  companyName: string;
  graph: CompanyContextGraph;
  version: string;
  // Summary data
  health: number;           // 0-1 overall health
  completeness: number;     // 0-1 overall coverage
  sections: ContextGraphSectionSummary[];
  // Metadata
  lastFusionAt: string | null;
  lastFusionRunId: string | null;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// Core Service Functions
// ============================================================================

/**
 * Get or create a context graph record for a company
 * If no graph exists, creates an empty one with default summary
 */
export async function getOrCreateContextGraphRecord(
  companyId: string
): Promise<ContextGraphRecordWithSummary> {
  // Try to load existing graph
  let graph = await loadContextGraph(companyId);
  let isNew = false;

  if (!graph) {
    // Get company name for new graph
    const company = await getCompanyById(companyId);
    const companyName = company?.name || 'Unknown Company';

    // Create empty graph
    graph = createEmptyContextGraph(companyId, companyName);
    isNew = true;

    // Save the new graph
    await saveContextGraph(graph);
    console.log(`[ContextGraphService] Created new graph for ${companyName}`);
  }

  // Calculate summary
  const summary = calculateGraphSummary(graph);

  return {
    id: '', // Will be filled by Airtable on save
    companyId: graph.companyId,
    companyName: graph.companyName,
    graph,
    version: graph.meta.version,
    health: summary.health,
    completeness: summary.completeness,
    sections: summary.sections,
    lastFusionAt: graph.meta.lastFusionAt,
    lastFusionRunId: graph.meta.lastFusionRunId,
    createdAt: graph.meta.createdAt,
    updatedAt: graph.meta.updatedAt,
  };
}

/**
 * Recalculate and persist the full context graph summary
 * Call this after bulk updates or when you need a complete refresh
 */
export async function recalculateContextGraphSummary(
  companyId: string
): Promise<ContextGraphSummary | null> {
  const graph = await loadContextGraph(companyId);
  if (!graph) {
    console.warn(`[ContextGraphService] No graph found for ${companyId}`);
    return null;
  }

  const summary = calculateGraphSummary(graph);

  // Update graph metadata with new scores
  graph.meta.completenessScore = Math.round(summary.completeness * 100);
  graph.meta.domainCoverage = summary.sections.reduce((acc, s) => {
    acc[s.id] = Math.round(s.coverage * 100);
    return acc;
  }, {} as Record<string, number>);
  graph.meta.updatedAt = new Date().toISOString();

  // Save updated graph
  await saveContextGraph(graph);

  console.log(formatSummaryForLog(summary));

  return summary;
}

/**
 * Update context graph summary after a single field change
 * Optimized for incremental updates - recalculates only affected section
 *
 * @param companyId - Company ID
 * @param path - Field path that was changed (e.g., "identity.businessName")
 */
export async function updateContextGraphForNode(
  companyId: string,
  path: string
): Promise<ContextGraphSummary | null> {
  const graph = await loadContextGraph(companyId);
  if (!graph) {
    console.warn(`[ContextGraphService] No graph found for ${companyId}`);
    return null;
  }

  // For now, do a full recalculation
  // Future optimization: only recalculate the affected section
  const updatedSection = recalculateSectionFromPath(graph, path);
  if (updatedSection) {
    console.log(`[ContextGraphService] Section ${updatedSection.id}: ${Math.round(updatedSection.coverage * 100)}% coverage`);
  }

  // Full recalculation for accurate overall stats
  const summary = calculateGraphSummary(graph);

  // Update graph metadata
  graph.meta.completenessScore = Math.round(summary.completeness * 100);
  graph.meta.domainCoverage = summary.sections.reduce((acc, s) => {
    acc[s.id] = Math.round(s.coverage * 100);
    return acc;
  }, {} as Record<string, number>);

  // Save is handled by the caller (mergeField or edit API)
  // We just return the summary for logging/UI updates

  return summary;
}

/**
 * Get the current summary for a context graph without modifying it
 */
export async function getContextGraphSummary(
  companyId: string
): Promise<ContextGraphSummary | null> {
  const graph = await loadContextGraph(companyId);
  if (!graph) {
    return null;
  }

  return calculateGraphSummary(graph);
}

/**
 * Get section summaries for display in the UI
 * Returns array of section stats matching the DomainNav format
 */
export async function getContextGraphSections(
  companyId: string
): Promise<ContextGraphSectionSummary[]> {
  const summary = await getContextGraphSummary(companyId);
  return summary?.sections || [];
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if a context graph exists for a company
 */
export async function contextGraphExists(companyId: string): Promise<boolean> {
  const graph = await loadContextGraph(companyId);
  return graph !== null;
}

/**
 * Get quick stats for a company's context graph
 */
export async function getQuickStats(companyId: string): Promise<{
  exists: boolean;
  health: number;
  completeness: number;
  populatedFields: number;
  totalFields: number;
} | null> {
  const summary = await getContextGraphSummary(companyId);
  if (!summary) {
    return {
      exists: false,
      health: 0,
      completeness: 0,
      populatedFields: 0,
      totalFields: 0,
    };
  }

  return {
    exists: true,
    health: summary.health,
    completeness: summary.completeness,
    populatedFields: summary.totalPopulated,
    totalFields: summary.totalFields,
  };
}
