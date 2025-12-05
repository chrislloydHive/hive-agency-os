// lib/insights/ingestors/index.ts
// Central dispatcher for insight ingestors

import type { DiagnosticRun } from '@/lib/os/diagnostics/runs';
import type { IngestorParams, IngestorResult } from './baseIngestor';

// Import all ingestors
import { ingestGapSnapshot, ingestFullGap } from './gapIngestor';
import { ingestWebsiteLab } from './websiteLabIngestor';
import { ingestBrandLab } from './brandLabIngestor';
import { ingestAudienceLab } from './audienceLabIngestor';
import { ingestMediaLab } from './mediaLabIngestor';
import { ingestCreativeLab } from './creativeLabIngestor';
import { ingestSeoLab } from './seoLabIngestor';
import { ingestContentLab } from './contentLabIngestor';
import { ingestDemandLab } from './demandLabIngestor';
import { ingestOpsLab } from './opsLabIngestor';

// ============================================================================
// Types
// ============================================================================

export type { IngestorParams, IngestorResult } from './baseIngestor';

type IngestorFn = (params: IngestorParams) => Promise<IngestorResult>;

// ============================================================================
// Ingestor Registry
// ============================================================================

/**
 * Map of diagnostic tool IDs to their ingestors
 */
const INGESTOR_REGISTRY: Record<string, IngestorFn> = {
  gapSnapshot: ingestGapSnapshot,
  gapPlan: ingestFullGap,
  gapHeavy: ingestFullGap,
  websiteLab: ingestWebsiteLab,
  brandLab: ingestBrandLab,
  audienceLab: ingestAudienceLab,
  mediaLab: ingestMediaLab,
  creativeLab: ingestCreativeLab,
  seoLab: ingestSeoLab,
  contentLab: ingestContentLab,
  demandLab: ingestDemandLab,
  opsLab: ingestOpsLab,
};

// ============================================================================
// Main Functions
// ============================================================================

/**
 * Run insight extraction for a diagnostic run
 *
 * This is the main entry point for extracting insights from any diagnostic.
 * It automatically dispatches to the correct ingestor based on toolId.
 */
export async function extractInsightsFromRun(
  companyId: string,
  run: DiagnosticRun
): Promise<IngestorResult> {
  const toolId = run.toolId;

  console.log(`[Insights] Extracting insights for ${toolId}`, {
    companyId,
    runId: run.id,
  });

  // Find the appropriate ingestor
  const ingestor = INGESTOR_REGISTRY[toolId];
  if (!ingestor) {
    console.log(`[Insights] No ingestor found for toolId: ${toolId}`);
    return {
      success: true,
      insightsCreated: 0,
      insightsSkipped: 0,
    };
  }

  // Run the ingestor
  try {
    const result = await ingestor({ companyId, run });

    console.log(`[Insights] Extraction complete for ${toolId}`, {
      success: result.success,
      created: result.insightsCreated,
      skipped: result.insightsSkipped,
      error: result.error,
    });

    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[Insights] Extraction failed for ${toolId}:`, error);
    return {
      success: false,
      insightsCreated: 0,
      insightsSkipped: 0,
      error: message,
    };
  }
}

/**
 * Check if a tool has an ingestor
 */
export function hasIngestor(toolId: string): boolean {
  return toolId in INGESTOR_REGISTRY;
}

/**
 * Get list of supported tool IDs
 */
export function getSupportedToolIds(): string[] {
  return Object.keys(INGESTOR_REGISTRY);
}

// ============================================================================
// Re-exports for direct access
// ============================================================================

export {
  ingestGapSnapshot,
  ingestFullGap,
  ingestWebsiteLab,
  ingestBrandLab,
  ingestAudienceLab,
  ingestMediaLab,
  ingestCreativeLab,
  ingestSeoLab,
  ingestContentLab,
  ingestDemandLab,
  ingestOpsLab,
};
