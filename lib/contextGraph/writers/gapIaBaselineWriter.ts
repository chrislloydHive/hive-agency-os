// lib/contextGraph/writers/gapIaBaselineWriter.ts
// Maps GAP-IA dimension outputs to Context Graph fields
//
// This writer is used during the baseline context build to populate
// SEO, Content, DigitalInfra, and Ops sections from GAP-IA analysis.
//
// Rules:
// - All writes use source: "gap_ia"
// - Does NOT overwrite human/manual, qbr, strategy, setup_wizard, gap_heavy sources
// - Uses existing mergeField semantics via setFieldUntypedWithResult

import { loadContextGraph, saveContextGraph } from '@/lib/contextGraph/storage';
import {
  setFieldUntypedWithResult,
  createProvenance,
  type ProvenanceSource,
} from '@/lib/contextGraph/mutate';
import type { CompanyContextGraph } from '@/lib/contextGraph/companyContextGraph';
import type { OsGapIaBaselineResult } from '@/lib/gap/orchestrator/osGapIaBaseline';

// ============================================================================
// Types
// ============================================================================

/**
 * Result of writing GAP-IA baseline to context
 */
export interface GapIaBaselineWriteResult {
  success: boolean;
  fieldsWritten: number;
  fieldsSkipped: number;
  /** Breakdown by domain */
  domainStats: {
    seo: { written: number; skipped: number };
    content: { written: number; skipped: number };
    digitalInfra: { written: number; skipped: number };
    website: { written: number; skipped: number };
    brand: { written: number; skipped: number };
  };
  error?: string;
}

// ============================================================================
// Main Function
// ============================================================================

/**
 * Write GAP-IA baseline results to the Context Graph
 *
 * Maps structured GAP-IA dimension outputs to Context Graph fields.
 * Respects source priority - won't overwrite human overrides.
 *
 * @param companyId - Company to update
 * @param gapIaResult - Result from runGapIaForOsBaseline
 * @param options - Optional configuration
 */
export async function writeGapIaBaselineToContext(
  companyId: string,
  gapIaResult: OsGapIaBaselineResult,
  options?: {
    runId?: string;
    dryRun?: boolean;
    debug?: boolean;
  }
): Promise<GapIaBaselineWriteResult> {
  const { runId, dryRun = false, debug = false } = options || {};

  console.log('[GAP-IA Writer] Starting write for company:', companyId);

  if (!gapIaResult.success) {
    console.warn('[GAP-IA Writer] GAP-IA result was not successful, skipping write');
    return {
      success: false,
      fieldsWritten: 0,
      fieldsSkipped: 0,
      domainStats: createEmptyDomainStats(),
      error: gapIaResult.error || 'GAP-IA analysis failed',
    };
  }

  // Load current context graph
  let graph = await loadContextGraph(companyId);
  if (!graph) {
    console.warn('[GAP-IA Writer] No context graph found for company:', companyId);
    return {
      success: false,
      fieldsWritten: 0,
      fieldsSkipped: 0,
      domainStats: createEmptyDomainStats(),
      error: 'No context graph found',
    };
  }

  const stats = createEmptyDomainStats();
  let totalWritten = 0;
  let totalSkipped = 0;

  // Create provenance for all writes
  const provenance = createProvenance('gap_ia' as ProvenanceSource, {
    confidence: 0.75, // Medium-high confidence for GAP-IA
    runId,
    notes: `GAP-IA baseline analysis (score: ${gapIaResult.overallScore})`,
  });

  // Helper to write a field and track stats
  const writeField = (
    domain: keyof typeof stats,
    field: string,
    value: unknown
  ): boolean => {
    if (value === null || value === undefined) {
      return false;
    }

    // Skip empty strings and empty arrays
    if (value === '' || (Array.isArray(value) && value.length === 0)) {
      return false;
    }

    const { graph: updatedGraph, result } = setFieldUntypedWithResult(
      graph!,
      domain,
      field,
      value,
      provenance,
      { debug }
    );

    if (result.updated) {
      graph = updatedGraph;
      stats[domain].written++;
      totalWritten++;
      if (debug) {
        console.log(`[GAP-IA Writer] Wrote ${domain}.${field}`);
      }
      return true;
    } else {
      stats[domain].skipped++;
      totalSkipped++;
      if (debug) {
        console.log(`[GAP-IA Writer] Skipped ${domain}.${field}: ${result.reason}`);
      }
      return false;
    }
  };

  // ========================================================================
  // Map SEO Dimension
  // ========================================================================
  if (gapIaResult.dimensions.seo) {
    const seo = gapIaResult.dimensions.seo;
    writeField('seo', 'seoScore', seo.score);
    writeField('seo', 'seoSummary', seo.oneLiner);

    // Map issues to technical issues format
    if (seo.issues && seo.issues.length > 0) {
      const technicalIssues = seo.issues.map((issue, idx) => ({
        title: `SEO Issue ${idx + 1}`,
        description: issue,
        severity: 'medium' as const,
        category: 'general',
        affectedUrls: null,
        recommendation: null,
      }));
      writeField('seo', 'technicalIssues', technicalIssues);
    }
  }

  // ========================================================================
  // Map Content Dimension
  // ========================================================================
  if (gapIaResult.dimensions.content) {
    const content = gapIaResult.dimensions.content;
    writeField('content', 'contentScore', content.score);
    writeField('content', 'contentSummary', content.oneLiner);

    // Map issues to content gaps
    if (content.issues && content.issues.length > 0) {
      const contentGaps = content.issues.map((issue) => ({
        topic: issue,
        priority: 'medium' as const,
        audienceNeed: null,
        recommendedFormat: null,
      }));
      writeField('content', 'contentGaps', contentGaps);
    }
  }

  // ========================================================================
  // Map Website Dimension
  // ========================================================================
  if (gapIaResult.dimensions.website) {
    const website = gapIaResult.dimensions.website;
    // Website domain doesn't have a score field, but we can set summary
    writeField('website', 'websiteSummary', website.oneLiner);

    // Map quick wins to website recommendations
    if (gapIaResult.quickWins && gapIaResult.quickWins.length > 0) {
      writeField('website', 'quickWins', gapIaResult.quickWins);
    }
  }

  // ========================================================================
  // Map Brand Dimension
  // ========================================================================
  if (gapIaResult.dimensions.brand) {
    const brand = gapIaResult.dimensions.brand;
    // Brand domain - map to positioning/summary fields
    writeField('brand', 'positioning', brand.oneLiner);

    if (brand.issues && brand.issues.length > 0) {
      // Map to brand weaknesses (the existing field for brand issues)
      writeField('brand', 'brandWeaknesses', brand.issues);
    }
  }

  // ========================================================================
  // Map Digital Footprint → DigitalInfra
  // ========================================================================
  if (gapIaResult.digitalFootprintData) {
    const df = gapIaResult.digitalFootprintData;

    // GBP health - use valid HealthStatus enum values
    if (df.gbp.found) {
      writeField('digitalInfra', 'gbpHealth', 'healthy');
    } else {
      writeField('digitalInfra', 'gbpHealth', 'not_configured');
    }

    // Build tracking summary
    const trackingParts: string[] = [];
    if (df.gbp.found) trackingParts.push('GBP found');
    if (df.linkedin.found) trackingParts.push('LinkedIn found');
    if (df.otherSocials.instagram) trackingParts.push('Instagram');
    if (df.otherSocials.facebook) trackingParts.push('Facebook');
    if (df.otherSocials.youtube) trackingParts.push('YouTube');

    if (trackingParts.length > 0) {
      writeField('digitalInfra', 'trackingStackSummary', trackingParts.join(', '));
    }
  }

  if (gapIaResult.dimensions.digitalFootprint) {
    const dfDim = gapIaResult.dimensions.digitalFootprint;
    // Could map subscore fields if available
    if (dfDim.oneLiner) {
      writeField('digitalInfra', 'dataQuality', dfDim.oneLiner);
    }
  }

  // ========================================================================
  // Save Updated Graph
  // ========================================================================
  if (totalWritten > 0 && !dryRun) {
    await saveContextGraph(graph, 'gap_ia_baseline');
    console.log('[GAP-IA Writer] Saved context graph with', totalWritten, 'fields written');
  }

  console.log('[GAP-IA Writer] Complete:', {
    fieldsWritten: totalWritten,
    fieldsSkipped: totalSkipped,
    stats,
  });

  return {
    success: true,
    fieldsWritten: totalWritten,
    fieldsSkipped: totalSkipped,
    domainStats: stats,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create empty domain stats object
 */
function createEmptyDomainStats(): GapIaBaselineWriteResult['domainStats'] {
  return {
    seo: { written: 0, skipped: 0 },
    content: { written: 0, skipped: 0 },
    digitalInfra: { written: 0, skipped: 0 },
    website: { written: 0, skipped: 0 },
    brand: { written: 0, skipped: 0 },
  };
}
