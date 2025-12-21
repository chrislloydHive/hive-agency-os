// lib/contextGraph/v4/autoProposeBaseline.ts
// Auto-propose baseline for required strategy fields after Labs/GAPs complete
//
// This runs automatically when enabled, proposing missing required fields
// to the V4 Review Queue. It does NOT auto-confirm anything.
//
// Features:
// - Required fields only (uses getMissingRequiredV4)
// - Idempotent (already proposed fields are skipped)
// - Gated by feature flags
// - Non-blocking (failures don't break the lab run)
// - Simple debounce to prevent redundant runs

import { loadContextFieldsV4 } from '../fieldStoreV4';
import { getMissingRequiredV4 } from './requiredStrategyFields';
import { getLatestRunForCompanyAndTool } from '@/lib/os/diagnostics/runs';
import { getGapPlanRunsForCompany } from '@/lib/airtable/gapPlanRuns';
import {
  buildWebsiteLabCandidates,
  extractWebsiteLabResult,
} from './websiteLabCandidates';
import {
  buildGapPlanCandidates,
  extractGapPlanStructured,
} from './gapPlanCandidates';
import { proposeFromLabResult, type LabCandidate } from './propose';
import {
  isContextV4AutoProposeBaselineEnabled,
  isContextV4IngestWebsiteLabEnabled,
  isContextV4IngestGapPlanEnabled,
} from '@/lib/types/contextField';

// ============================================================================
// Types
// ============================================================================

export type AutoProposeTriggeredBy = 'websiteLab' | 'gapPlan' | 'brandLab';

export interface AutoProposeBaselineParams {
  companyId: string;
  triggeredBy: AutoProposeTriggeredBy;
  runId?: string;
}

export interface AutoProposeBaselineResult {
  attempted: number;
  created: number;
  skipped: number;
  failed: number;
}

// ============================================================================
// Debounce / Rate Limiting
// ============================================================================

// Simple in-memory debounce: track last auto-propose time per company
const lastAutoProposedAt = new Map<string, number>();
const DEBOUNCE_MS = 60_000; // 60 seconds

function shouldDebounce(companyId: string): boolean {
  const lastRun = lastAutoProposedAt.get(companyId);
  if (!lastRun) return false;
  return Date.now() - lastRun < DEBOUNCE_MS;
}

function recordAutoPropose(companyId: string): void {
  lastAutoProposedAt.set(companyId, Date.now());
}

// ============================================================================
// Main Function
// ============================================================================

/**
 * Auto-propose baseline fields if needed
 *
 * Called after Labs/GAPs complete to propose missing required strategy fields.
 * Safe, idempotent, non-blocking.
 *
 * @param params - Company ID, trigger source, optional run ID
 * @returns Summary of what was proposed
 */
export async function autoProposeBaselineIfNeeded(
  params: AutoProposeBaselineParams
): Promise<AutoProposeBaselineResult> {
  const { companyId, triggeredBy, runId } = params;

  const result: AutoProposeBaselineResult = {
    attempted: 0,
    created: 0,
    skipped: 0,
    failed: 0,
  };

  try {
    // Check feature flag
    if (!isContextV4AutoProposeBaselineEnabled()) {
      return result; // Feature disabled, return early
    }

    // Check source-specific flags
    if (triggeredBy === 'websiteLab' && !isContextV4IngestWebsiteLabEnabled()) {
      return result; // WebsiteLab ingestion disabled
    }
    if (triggeredBy === 'gapPlan' && !isContextV4IngestGapPlanEnabled()) {
      return result; // GAP Plan ingestion disabled
    }
    // TODO: Add check for brandLab when implemented

    // Debounce check
    if (shouldDebounce(companyId)) {
      console.log('[autoProposeBaseline] Debounced - recent run exists', {
        companyId,
        triggeredBy,
      });
      return result;
    }

    // Load V4 store to get current field status
    const store = await loadContextFieldsV4(companyId);
    const confirmedKeys = new Set<string>();
    const proposedKeys = new Set<string>();

    if (store) {
      for (const [key, field] of Object.entries(store.fields)) {
        if (field.status === 'confirmed') {
          confirmedKeys.add(key);
        } else if (field.status === 'proposed') {
          proposedKeys.add(key);
        }
      }
    }

    // Get missing required fields
    const missingRequired = getMissingRequiredV4(confirmedKeys, proposedKeys);
    const missingPaths = new Set(missingRequired.map((f) => f.path));

    // Also include alternatives that are missing
    for (const field of missingRequired) {
      if (field.alternatives) {
        for (const alt of field.alternatives) {
          if (!confirmedKeys.has(alt) && !proposedKeys.has(alt)) {
            missingPaths.add(alt);
          }
        }
      }
    }

    if (missingPaths.size === 0) {
      console.log('[autoProposeBaseline] All required fields already populated', {
        companyId,
        triggeredBy,
      });
      return result;
    }

    result.attempted = missingPaths.size;

    // Collect candidates from the triggering lab source
    const allCandidates: LabCandidate[] = [];
    let sourceId: string | null = null;
    let extractionPath: string | undefined;

    // Determine source type for proposeFromLabResult
    let sourceType: 'lab' | 'gap' = 'lab';

    if (triggeredBy === 'websiteLab') {
      // Get the latest WebsiteLab run (or use the provided runId)
      const websiteLabRun = await getLatestRunForCompanyAndTool(companyId, 'websiteLab');
      if (websiteLabRun?.rawJson) {
        const extraction = extractWebsiteLabResult(websiteLabRun.rawJson);
        if (extraction) {
          const candidateResult = buildWebsiteLabCandidates(websiteLabRun.rawJson);
          // Filter to only missing required fields
          const filtered = candidateResult.candidates.filter((c) =>
            missingPaths.has(c.key)
          );
          allCandidates.push(...filtered);
          sourceId = runId || websiteLabRun.id;
          extractionPath = candidateResult.extractionPath;
          sourceType = 'lab';
        }
      }
    } else if (triggeredBy === 'gapPlan') {
      // Get the latest GAP Plan run
      const gapPlanRuns = await getGapPlanRunsForCompany(companyId, 1);
      const gapPlanRun = gapPlanRuns.find((r) => r.status === 'completed' && r.dataJson);
      if (gapPlanRun?.dataJson) {
        const extraction = extractGapPlanStructured(gapPlanRun.dataJson);
        if (extraction) {
          const candidateResult = buildGapPlanCandidates(gapPlanRun.dataJson);
          // Filter to only missing required fields
          const filtered = candidateResult.candidates.filter((c) =>
            missingPaths.has(c.key)
          );
          allCandidates.push(...filtered);
          sourceId = runId || gapPlanRun.id;
          extractionPath = candidateResult.extractionPath;
          sourceType = 'gap';
        }
      }
    }
    // TODO: Add brandLab source when implemented

    if (allCandidates.length === 0) {
      // No candidates found - mark all as skipped
      result.skipped = missingPaths.size;
      console.log('[autoProposeBaseline] No candidates from lab source', {
        companyId,
        triggeredBy,
        missingPaths: [...missingPaths],
      });
      return result;
    }

    // Propose the candidates
    if (sourceId && extractionPath) {
      const proposalResult = await proposeFromLabResult({
        companyId,
        importerId: triggeredBy,
        source: sourceType,
        sourceId,
        extractionPath,
        candidates: allCandidates,
      });

      result.created = proposalResult.proposed;
      result.skipped = proposalResult.blocked;
      result.failed = proposalResult.errors.length;

      // Record the auto-propose time for debouncing
      recordAutoPropose(companyId);

      // Structured log for observability
      console.log('[contextV4.autoProposeBaseline]', {
        companyId,
        triggeredBy,
        runId: sourceId,
        attempted: result.attempted,
        created: result.created,
        skipped: result.skipped,
        failed: result.failed,
      });
    } else {
      result.skipped = missingPaths.size;
    }

    return result;
  } catch (error) {
    // Non-blocking: log error but don't throw
    console.error('[autoProposeBaseline] Error:', {
      companyId,
      triggeredBy,
      error: error instanceof Error ? error.message : String(error),
    });
    result.failed = result.attempted || 1;
    return result;
  }
}
