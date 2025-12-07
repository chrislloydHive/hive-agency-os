// lib/competition-v3/updateCompetitiveDomain.ts
// Writer for updating Context Graph competitive domain from V3 summary
//
// This module takes a CompetitiveSummary (produced by summarizeForContext)
// and writes it to the Context Graph competitive domain.

import { loadContextGraph, saveContextGraph } from '@/lib/contextGraph/storage';
import { createEmptyCompetitiveDomain } from '@/lib/contextGraph/domains/competitive';
import type { CompetitiveSummary, CompetitorSummary } from './summarizeForContext';
import type { CompanyContextGraph } from '@/lib/contextGraph/companyContextGraph';
import type { ProvenanceTag } from '@/lib/contextGraph/types';
import { canSourceOverwrite } from '@/lib/contextGraph/sourcePriority';

// ============================================================================
// Types
// ============================================================================

export interface UpdateCompetitiveDomainResult {
  success: boolean;
  companyId: string;
  fieldsUpdated: string[];
  fieldsSkipped: string[]; // Fields skipped due to human override
  error?: string;
}

// ============================================================================
// Main Writer
// ============================================================================

/**
 * Update the Context Graph competitive domain with V3 summary data
 *
 * This merges the summarized competitive data into the Context Graph,
 * providing stable competitive intelligence inside Brain.
 *
 * @param companyId - Company ID to update
 * @param summary - CompetitiveSummary from summarizeForContext
 * @param runId - Optional run ID for provenance tracking
 */
export async function updateCompetitiveDomain(
  companyId: string,
  summary: CompetitiveSummary,
  runId?: string
): Promise<UpdateCompetitiveDomainResult> {
  const fieldsUpdated: string[] = [];
  const fieldsSkipped: string[] = [];

  try {
    // Load existing graph
    let graph = await loadContextGraph(companyId);

    if (!graph) {
      console.warn(`[updateCompetitiveDomain] No context graph found for ${companyId}`);
      return {
        success: false,
        companyId,
        fieldsUpdated: [],
        fieldsSkipped: [],
        error: 'No context graph found',
      };
    }

    // Ensure competitive domain exists
    if (!graph.competitive) {
      graph.competitive = createEmptyCompetitiveDomain();
    }

    const now = new Date().toISOString();

    // Create provenance tag for all updates
    // Using 'brain' as the source since Competition Lab is part of Brain
    const provenance: ProvenanceTag = {
      source: 'brain',
      sourceRunId: runId,
      updatedAt: now,
      confidence: 0.85,
      validForDays: 30,
      notes: 'Competition Lab V3 summary',
    };

    // Helper to safely update a field respecting human overrides
    // Returns true if updated, false if skipped
    const safeUpdateField = (
      fieldName: string,
      currentField: { value: unknown; provenance: ProvenanceTag[] } | undefined,
      newValue: unknown
    ): boolean => {
      const existingProvenance = currentField?.provenance ?? [];

      // Check if we can overwrite based on source priority
      const check = canSourceOverwrite('competitive', existingProvenance, 'brain', 0.85);

      if (!check.canOverwrite) {
        // Skip this field - human override or higher priority source
        fieldsSkipped.push(fieldName);
        console.log(`[updateCompetitiveDomain] Skipping ${fieldName}: ${check.reason}`);
        return false;
      }

      // Safe to update - use any since competitive domain structure is known
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (graph.competitive as any)[fieldName] = {
        value: newValue,
        provenance: [provenance],
      };
      fieldsUpdated.push(fieldName);
      return true;
    };

    // Convert CompetitorSummary to CompetitorProfile format
    const toCompetitorProfile = (c: CompetitorSummary) => ({
      name: c.name,
      domain: c.domain || null,
      website: c.url || null,
      category: mapTypeToCategory(c.type),
      positioning: null,
      estimatedBudget: null,
      primaryChannels: [],
      strengths: [],
      weaknesses: [],
      uniqueClaims: [],
      offers: [],
      pricingSummary: null,
      pricingNotes: null,
      notes: null,
      xPosition: (c.valueModelFit - 50), // Convert 0-100 to -50 to +50
      yPosition: (c.icpFit - 50),
      positionPrimary: c.valueModelFit,
      positionSecondary: c.icpFit,
      confidence: 0.85,
      lastValidatedAt: now,
      trajectory: null,
      trajectoryReason: null,
      provenance: [{
        field: 'all',
        source: 'competition-v3-summary',
        updatedAt: now,
        confidence: 0.85,
      }],
      threatLevel: c.threat,
      threatDrivers: [],
      // Competition Lab V3 results are derived from analysis, not raw AI suggestions
      // Mark as verified so they appear on the positioning map immediately
      autoSeeded: false,
    });

    // Build competitor profiles
    const allCompetitors = [
      ...summary.primaryCompetitors.map(toCompetitorProfile),
      ...summary.alternativeCompetitors.map(toCompetitorProfile),
    ];
    const primaryOnly = summary.primaryCompetitors.map(toCompetitorProfile);

    // Update competitors (respecting human overrides)
    safeUpdateField('competitors', graph.competitive.competitors, allCompetitors);
    safeUpdateField('primaryCompetitors', graph.competitive.primaryCompetitors, primaryOnly);

    // Update positioning axes
    safeUpdateField('primaryAxis', graph.competitive.primaryAxis, 'Value Model Alignment');
    safeUpdateField('secondaryAxis', graph.competitive.secondaryAxis, 'ICP Alignment');

    // Update summaries
    safeUpdateField('positionSummary', graph.competitive.positionSummary, summary.landscapeSummary);
    safeUpdateField('positioningSummary', graph.competitive.positioningSummary, summary.categoryBreakdown);

    // Update threat level
    safeUpdateField('overallThreatLevel', graph.competitive.overallThreatLevel, summary.threatLevel);

    // Update threats and opportunities
    safeUpdateField('competitiveThreats', graph.competitive.competitiveThreats, summary.keyRisks);
    safeUpdateField('competitiveOpportunities', graph.competitive.competitiveOpportunities, summary.keyOpportunities);
    safeUpdateField('whitespaceOpportunities', graph.competitive.whitespaceOpportunities, summary.keyOpportunities.slice(0, 5));

    // Update metadata (these are always safe to update as they're system-managed)
    safeUpdateField('dataConfidence', graph.competitive.dataConfidence, 0.85);
    safeUpdateField('lastValidatedAt', graph.competitive.lastValidatedAt, summary.lastUpdated);

    // Save updated graph
    await saveContextGraph(graph, 'brain');

    console.log(`[updateCompetitiveDomain] Updated ${fieldsUpdated.length} fields, skipped ${fieldsSkipped.length} (human overrides) for ${companyId}`);
    if (fieldsSkipped.length > 0) {
      console.log(`[updateCompetitiveDomain] Skipped fields: ${fieldsSkipped.join(', ')}`);
    }

    return {
      success: true,
      companyId,
      fieldsUpdated,
      fieldsSkipped,
    };
  } catch (error) {
    console.error(`[updateCompetitiveDomain] Error updating ${companyId}:`, error);
    return {
      success: false,
      companyId,
      fieldsUpdated,
      fieldsSkipped,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Map V3 competitor type to Context Graph category
 */
function mapTypeToCategory(
  type: string
): 'direct' | 'indirect' | 'aspirational' | 'emerging' | null {
  switch (type) {
    case 'direct':
      return 'direct';
    case 'partial':
    case 'fractional':
    case 'internal':
      return 'indirect';
    case 'platform':
      return 'emerging';
    default:
      return null;
  }
}
