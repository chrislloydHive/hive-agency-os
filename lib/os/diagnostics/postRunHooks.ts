// lib/os/diagnostics/postRunHooks.ts
// Post-run hooks for diagnostic tools
//
// Call these after a diagnostic run completes successfully to:
// 1. Generate Brain entries (diagnostic summaries)
// 2. Refresh the company's Strategic Snapshot
// 3. Update the Company Context Graph
// 4. Run domain-specific writers for full data extraction
// 5. Extract strategic insights for Brain Insights
// 6. Extract and save findings to Diagnostic Details

import { summarizeDiagnosticRunForBrain } from './aiInsights';
import { refreshCompanyStrategicSnapshot } from '@/lib/os/companies/strategySnapshot';
import { runFusion } from '@/lib/contextGraph/fusion';
import { writeWebsiteLabAndSave } from '@/lib/contextGraph/websiteLabWriter';
import { writeBrandLabAndSave } from '@/lib/contextGraph/brandLabWriter';
import { writeGapIaAndSave } from '@/lib/contextGraph/gapIaWriter';
import { processCompletedDiagnostic } from '@/lib/insights/engine';
import type { DiagnosticRun, LabSlug } from './runs';
import { getLabSlugForToolId } from './runs';
import { extractFindingsForLab, getWorstSeverity } from './findingsExtractors';
import { saveDiagnosticFindings, deleteUnconvertedFindingsForCompanyLab, type CreateDiagnosticFindingInput } from '@/lib/airtable/diagnosticDetails';
import type { WebsiteUXLabResultV4 } from '@/lib/gap-heavy/modules/websiteLab';
import type { BrandLabSummary } from '@/lib/media/diagnosticsInputs';
import { isContextV4IngestWebsiteLabEnabled, isContextV4IngestBrandLabEnabled } from '@/lib/types/contextField';
import { buildWebsiteLabCandidates, proposeFromLabResult } from '@/lib/contextGraph/v4';
import { buildBrandLabCandidates } from '@/lib/contextGraph/v4/brandLabCandidates';
import { autoProposeBaselineIfNeeded } from '@/lib/contextGraph/v4/autoProposeBaseline';

import {
  createSocialLocalWorkItemsFromSnapshot,
  suggestionsToCreateInputs,
} from '@/lib/gap/socialWorkItems';
import { createWorkItem } from '@/lib/work/workItems';
import type { SocialFootprintSnapshot } from '@/lib/gap/socialDetection';

// Debug logging - enabled via DEBUG_CONTEXT_HYDRATION=1
const DEBUG = process.env.DEBUG_CONTEXT_HYDRATION === '1';
function debugLog(message: string, data?: Record<string, unknown>) {
  if (DEBUG) {
    console.log(`[postRunHooks:DEBUG] ${message}`, data ? JSON.stringify(data, null, 2) : '');
  }
}

// ============================================================================
// URL Extraction from ModuleResult
// ============================================================================

/**
 * URL provenance extracted from a run's rawJson (ModuleResult format)
 */
interface UrlProvenance {
  inputUrl: string | null;
  normalizedUrl: string | null;
  moduleStatus: string | null;
}

/**
 * Extract URL provenance from a diagnostic run's rawJson
 *
 * The rawJson may be:
 * 1. A ModuleResult with inputUrl/normalizedUrl at top level
 * 2. Legacy format without URL provenance
 * 3. Nested in rawEvidence.labResultV4 (older format)
 *
 * Falls back to metadata if not found in rawJson.
 */
function extractUrlProvenance(run: DiagnosticRun): UrlProvenance {
  const result: UrlProvenance = {
    inputUrl: null,
    normalizedUrl: null,
    moduleStatus: null,
  };

  // Try to extract from rawJson (ModuleResult format)
  if (run.rawJson && typeof run.rawJson === 'object') {
    const rawData = run.rawJson as Record<string, unknown>;

    // Check for ModuleResult format (has inputUrl at top level)
    if ('inputUrl' in rawData) {
      result.inputUrl = rawData.inputUrl as string | null;
      result.normalizedUrl = rawData.normalizedUrl as string | null;
      result.moduleStatus = rawData.status as string | null;
      return result;
    }

    // Check for rawEvidence wrapper (older moduleResult format)
    if (rawData.rawEvidence && typeof rawData.rawEvidence === 'object') {
      const evidence = rawData.rawEvidence as Record<string, unknown>;
      if ('inputUrl' in evidence) {
        result.inputUrl = evidence.inputUrl as string | null;
        result.normalizedUrl = evidence.normalizedUrl as string | null;
      }
    }
  }

  // Fall back to metadata if available
  if (run.metadata && typeof run.metadata === 'object') {
    const meta = run.metadata as Record<string, unknown>;
    result.inputUrl = result.inputUrl ?? (meta.inputUrl as string | null);
    result.normalizedUrl = result.normalizedUrl ?? (meta.normalizedUrl as string | null);
    result.moduleStatus = result.moduleStatus ?? (meta.moduleStatus as string | null);
  }

  return result;
}

/**
 * Process a completed diagnostic run
 *
 * This should be called after any diagnostic run completes successfully.
 * It handles:
 * 1. Creating a Brain entry with AI-generated insights
 * 2. Refreshing the company's Strategic Snapshot
 *
 * Failures are logged but don't throw - we don't want to break the main flow.
 */
export async function processDiagnosticRunCompletion(
  companyId: string,
  run: DiagnosticRun
): Promise<void> {
  // Extract URL provenance from run
  const urlProvenance = extractUrlProvenance(run);

  console.log('[postRunHooks] Processing completed run:', {
    companyId,
    runId: run.id,
    toolId: run.toolId,
    score: run.score,
    inputUrl: urlProvenance.inputUrl,
    normalizedUrl: urlProvenance.normalizedUrl,
    moduleStatus: urlProvenance.moduleStatus,
  });

  // Skip if run failed
  if (run.status !== 'complete') {
    console.log('[postRunHooks] Skipping - run not complete');
    return;
  }

  // 1. Generate Brain entry
  try {
    console.log('[postRunHooks] Generating Brain entry...');
    await summarizeDiagnosticRunForBrain(companyId, run);
    console.log('[postRunHooks] Brain entry created');
  } catch (error) {
    console.error('[postRunHooks] Failed to create Brain entry:', error);
    // Don't throw - continue to snapshot
  }

  // 2. Refresh Strategic Snapshot
  try {
    console.log('[postRunHooks] Refreshing Strategic Snapshot...');
    await refreshCompanyStrategicSnapshot(companyId);
    console.log('[postRunHooks] Strategic Snapshot refreshed');
  } catch (error) {
    console.error('[postRunHooks] Failed to refresh Strategic Snapshot:', error);
    // Don't throw
  }

  // 3. Update Company Context Graph via Fusion
  try {
    console.log('[postRunHooks] Updating Context Graph via Fusion...');
    const fusionResult = await runFusion(companyId, {
      snapshotReason: 'diagnostic_run',
      snapshotDescription: `Updated after ${run.toolId} diagnostic run`,
    });
    console.log('[postRunHooks] Context Graph updated via Fusion:', {
      fieldsUpdated: fusionResult.fieldsUpdated,
      sourcesUsed: fusionResult.sourcesUsed,
      versionId: fusionResult.versionId,
    });
  } catch (error) {
    console.error('[postRunHooks] Failed to update Context Graph via Fusion:', error);
    // Don't throw - context graph updates are supplementary
  }

  // 4. Run domain-specific writers for full data extraction
  // These writers extract more detailed data than the fusion pipeline
  await runDomainWriters(companyId, run);

  // 5. Extract strategic insights for Brain Insights
  try {
    console.log('[postRunHooks] Extracting strategic insights...');
    const insightResult = await processCompletedDiagnostic(companyId, run);
    console.log('[postRunHooks] Strategic insights extracted:', {
      created: insightResult.insightsCreated,
      skipped: insightResult.insightsSkipped,
      durationMs: insightResult.duration,
    });
  } catch (error) {
    console.error('[postRunHooks] Failed to extract strategic insights:', error);
    // Don't throw - insight extraction is supplementary
  }

  // 6. Extract and save findings to Diagnostic Details
  try {
    console.log('[postRunHooks] Extracting and saving findings to Diagnostic Details...');
    const findingsResult = await extractAndSaveFindings(companyId, run);
    console.log('[postRunHooks] Findings saved to Diagnostic Details:', {
      labSlug: findingsResult.labSlug,
      findingsCount: findingsResult.findingsCount,
      savedIds: findingsResult.savedIds.length,
      worstSeverity: findingsResult.worstSeverity,
    });
  } catch (error) {
    console.error('[postRunHooks] Failed to save findings:', error);
    // Don't throw - findings extraction is supplementary
  }

  console.log('[postRunHooks] Completed processing for run:', run.id);
}

/**
 * Run domain-specific writers based on the tool type
 *
 * These writers extract detailed data from the full diagnostic result
 * that may not be captured by the general fusion pipeline.
 */
async function runDomainWriters(
  companyId: string,
  run: DiagnosticRun
): Promise<void> {
  // Only proceed if we have raw data
  if (!run.rawJson) {
    console.log('[postRunHooks] No rawJson in run, skipping domain writers');
    return;
  }

  try {
    switch (run.toolId) {
      case 'websiteLab': {
        // Check if V4 ingestion is enabled for WebsiteLab
        if (isContextV4IngestWebsiteLabEnabled()) {
          console.log('[postRunHooks] Running WebsiteLab V4 proposal flow...');

          // Build candidates from rawJson
          const candidateResult = buildWebsiteLabCandidates(run.rawJson);

          if (candidateResult.candidates.length === 0) {
            console.warn('[postRunHooks] No WebsiteLab candidates for V4 proposal');
            console.warn('[postRunHooks] Extraction path:', candidateResult.extractionPath);
            console.warn('[postRunHooks] Skipped:', candidateResult.skipped);
            return;
          }

          // Propose fields to V4 Review Queue
          const proposalResult = await proposeFromLabResult({
            companyId,
            importerId: 'websiteLab',
            source: 'lab',
            sourceId: run.id,
            extractionPath: candidateResult.extractionPath,
            candidates: candidateResult.candidates,
          });

          console.log('[postRunHooks] WebsiteLab V4 proposal complete:', {
            proposed: proposalResult.proposed,
            blocked: proposalResult.blocked,
            replaced: proposalResult.replaced,
            errors: proposalResult.errors.length,
            skippedWrongDomain: candidateResult.skipped.wrongDomain,
          });

          // Log skipped wrong-domain keys for debugging (these are cross-domain observations)
          if (candidateResult.skippedWrongDomainKeys.length > 0) {
            debugLog('websiteLab_v4_skipped_domains', {
              skippedKeys: candidateResult.skippedWrongDomainKeys.slice(0, 10),
            });
          }

          // Auto-propose baseline for required strategy fields (if enabled)
          // This runs after lab proposals so required fields show as Proposed immediately
          try {
            await autoProposeBaselineIfNeeded({
              companyId,
              triggeredBy: 'websiteLab',
              runId: run.id,
            });
          } catch (autoError) {
            // Non-blocking: log but don't fail the lab run
            console.error('[postRunHooks] Auto-propose baseline failed:', autoError);
          }

          // DO NOT call legacy writer - V4 proposal is the only path
          break;
        }

        // LEGACY PATH: Direct graph write (when V4 ingestion is disabled)
        console.log('[postRunHooks] Running WebsiteLab domain writer (legacy)...');

        // Extract the WebsiteUXLabResultV4 from rawJson
        // The rawJson structure may be:
        // 1. Direct: { siteAssessment, siteGraph, ... }
        // 2. Wrapped in result: { result: { siteAssessment, ... } }
        // 3. New format: { rawEvidence: { labResultV4: { siteAssessment, ... } } }
        const rawData = run.rawJson as Record<string, unknown>;
        let websiteResult: WebsiteUXLabResultV4;

        // Try new format first: rawEvidence.labResultV4
        const rawEvidence = rawData.rawEvidence as Record<string, unknown> | undefined;
        let extractionPath: 'rawEvidence.labResultV4' | 'legacy' = 'legacy';
        if (rawEvidence?.labResultV4) {
          websiteResult = rawEvidence.labResultV4 as WebsiteUXLabResultV4;
          extractionPath = 'rawEvidence.labResultV4';
          console.log('[postRunHooks] Found WebsiteLab data at rawEvidence.labResultV4');
        } else {
          // Fall back to legacy formats
          websiteResult = (rawData.result || rawData) as WebsiteUXLabResultV4;
          console.log('[postRunHooks] Using legacy WebsiteLab data format');
        }
        debugLog('websiteLab_extraction', { extractionPath, runId: run.id });

        // Validate we have the expected structure
        if (!websiteResult.siteAssessment && !websiteResult.siteGraph) {
          console.warn('[postRunHooks] WebsiteLab rawJson missing expected structure, skipping writer');
          console.warn('[postRunHooks] rawJson keys:', Object.keys(rawData));
          if (rawEvidence) {
            console.warn('[postRunHooks] rawEvidence keys:', Object.keys(rawEvidence));
          }
          return;
        }

        const { summary } = await writeWebsiteLabAndSave(
          companyId,
          websiteResult,
          run.id
        );

        console.log('[postRunHooks] WebsiteLab domain writer complete:', {
          fieldsUpdated: summary.fieldsUpdated,
          updatedPaths: summary.updatedPaths.slice(0, 5),
          errors: summary.errors.length,
        });
        break;
      }

      case 'brandLab': {
        console.log('[postRunHooks] Running BrandLab hooks...');

        // ====================================================================
        // V4 PROPOSAL PATH (when V4 ingestion is enabled)
        // ====================================================================
        if (isContextV4IngestBrandLabEnabled()) {
          console.log('[postRunHooks] Running BrandLab V4 proposal flow...');

          // Build candidates from rawJson
          const candidateResult = buildBrandLabCandidates(run.rawJson);

          if (candidateResult.candidates.length === 0) {
            console.warn('[postRunHooks] No BrandLab candidates for V4 proposal', {
              extractionPath: candidateResult.extractionPath,
              rawKeysFound: candidateResult.rawKeysFound,
              debug: candidateResult.debug,
            });
          } else {
            // Propose fields to V4 Review Queue
            try {
              const proposalResult = await proposeFromLabResult({
                companyId,
                importerId: 'brandLab',
                source: 'lab',
                sourceId: run.id,
                extractionPath: candidateResult.extractionPath,
                candidates: candidateResult.candidates,
              });

              console.log('[postRunHooks] BrandLab V4 proposal complete:', {
                proposed: proposalResult.proposed,
                blocked: proposalResult.blocked,
                errors: proposalResult.errors.length,
                proposedKeys: proposalResult.proposedKeys,
              });

              // Auto-propose baseline if first proposal
              if (proposalResult.proposed > 0) {
                try {
                  await autoProposeBaselineIfNeeded({
                    companyId,
                    triggeredBy: 'brandLab',
                    runId: run.id,
                  });
                } catch (baselineErr) {
                  console.warn('[postRunHooks] BrandLab auto-propose baseline failed:', baselineErr);
                }
              }
            } catch (proposeErr) {
              console.error('[postRunHooks] BrandLab V4 proposal failed:', proposeErr);
            }
          }
        }

        // ====================================================================
        // LEGACY DOMAIN WRITER PATH (runs regardless of V4 flag)
        // ====================================================================
        console.log('[postRunHooks] Running BrandLab domain writer...');

        // Extract the BrandLabResult from rawJson
        // The rawJson structure may be:
        // 1. New format: { rawEvidence: { labResultV4: { findings, ... } } }
        // 2. Wrapped in result: { result: { findings, ... } }
        // 3. Direct: { findings, ... }
        const rawData = run.rawJson as Record<string, unknown>;
        let brandResult: import('@/lib/diagnostics/brand-lab/types').BrandLabResult;

        // Try new format first: rawEvidence.labResultV4
        const rawEvidence = rawData.rawEvidence as Record<string, unknown> | undefined;
        let extractionPath: 'rawEvidence.labResultV4' | 'legacy' = 'legacy';
        if (rawEvidence?.labResultV4) {
          brandResult = rawEvidence.labResultV4 as import('@/lib/diagnostics/brand-lab/types').BrandLabResult;
          extractionPath = 'rawEvidence.labResultV4';
          console.log('[postRunHooks] Found BrandLab data at rawEvidence.labResultV4');
        } else {
          // Fall back to legacy formats
          brandResult = (rawData.result || rawData) as import('@/lib/diagnostics/brand-lab/types').BrandLabResult;
          console.log('[postRunHooks] Using legacy BrandLab data format');
        }
        debugLog('brandLab_extraction', { extractionPath, runId: run.id });

        // Check if this is a full BrandLabResult (has findings object)
        const hasFindings = brandResult.findings &&
          (brandResult.findings.valueProp || brandResult.findings.differentiators || brandResult.findings.icp);

        if (hasFindings) {
          // Use the full BrandLabResult writer that extracts canonical findings
          const { writeBrandLabResultAndSave } = await import('@/lib/contextGraph/brandLabWriter');
          const { legacySummary, findingsSummary } = await writeBrandLabResultAndSave(
            companyId,
            brandResult,
            run.id
          );

          console.log('[postRunHooks] BrandLab domain writer complete (with findings):', {
            legacyFields: legacySummary.fieldsUpdated,
            findingsFields: findingsSummary.fieldsUpdated,
            updatedPaths: [...legacySummary.updatedPaths, ...findingsSummary.updatedPaths].slice(0, 8),
            skippedPaths: findingsSummary.skippedPaths,
          });
        } else {
          // Fallback: Legacy BrandLabSummary path
          const legacyResult = brandResult as unknown as BrandLabSummary;

          // Validate we have some meaningful data
          if (!legacyResult.positioningSummary && !legacyResult.valueProps && !legacyResult.voiceTone) {
            console.warn('[postRunHooks] BrandLab rawJson missing expected structure, skipping writer');
            return;
          }

          const { summary } = await writeBrandLabAndSave(
            companyId,
            legacyResult,
            run.id
          );

          console.log('[postRunHooks] BrandLab domain writer complete (legacy):', {
            fieldsUpdated: summary.fieldsUpdated,
            updatedPaths: summary.updatedPaths.slice(0, 5),
            errors: summary.errors.length,
          });
        }
        break;
      }

      case 'gapSnapshot': {
        console.log('[postRunHooks] Running GAP-IA domain writer...');

        // Extract the GAP-IA result from rawJson
        // The rawJson structure has initialAssessment, businessContext, etc.
        const rawData = run.rawJson as Record<string, unknown>;

        // Validate we have the expected structure
        if (!rawData.initialAssessment) {
          console.warn('[postRunHooks] GAP-IA rawJson missing initialAssessment, skipping writer');
          return;
        }

        const { summary } = await writeGapIaAndSave(
          companyId,
          rawData,
          run.id
        );

        console.log('[postRunHooks] GAP-IA domain writer complete:', {
          fieldsUpdated: summary.fieldsUpdated,
          updatedPaths: summary.updatedPaths.slice(0, 5),
          errors: summary.errors.length,
        });

        // Generate Work Items from V5 socialFootprint if available
        const socialFootprint = rawData.socialFootprint as SocialFootprintSnapshot | undefined;
        if (socialFootprint) {
          try {
            console.log('[postRunHooks] Generating social/local work items...');

            const businessType = (rawData.businessContext as any)?.businessType;
            const workItemResult = createSocialLocalWorkItemsFromSnapshot(socialFootprint, {
              businessType,
            });

            // Create work items for high-confidence suggestions
            const highConfidenceSuggestions = workItemResult.suggestions.filter(
              s => s.recommendationConfidence === 'high'
            );

            if (highConfidenceSuggestions.length > 0) {
              const inputs = suggestionsToCreateInputs(highConfidenceSuggestions, companyId);

              // Create work items (limit to top 3 to avoid overwhelming)
              const createdItems = [];
              for (const input of inputs.slice(0, 3)) {
                const item = await createWorkItem(input);
                if (item) {
                  createdItems.push(item.id);
                }
              }

              console.log('[postRunHooks] Social/local work items created:', {
                created: createdItems.length,
                skipped: workItemResult.skipped.length,
                dataConfidence: workItemResult.dataConfidence,
              });
            } else {
              console.log('[postRunHooks] No high-confidence work items to create');
            }
          } catch (workItemError) {
            console.error('[postRunHooks] Failed to create social work items:', workItemError);
            // Don't throw - work item creation is supplementary
          }
        }
        break;
      }

      // Add other domain writers here as they're implemented
      // case 'contentLab': { ... }
      // case 'seoLab': { ... }

      default:
        // No domain writer for this tool type
        break;
    }
  } catch (error) {
    console.error(`[postRunHooks] Domain writer failed for ${run.toolId}:`, error);
    // Don't throw - domain writer failures are supplementary
  }
}

/**
 * Process diagnostic run completion in the background
 *
 * Same as processDiagnosticRunCompletion but doesn't wait for completion.
 * Use this when you want to return a response immediately.
 */
export function processDiagnosticRunCompletionAsync(
  companyId: string,
  run: DiagnosticRun
): void {
  // Fire and forget
  processDiagnosticRunCompletion(companyId, run).catch((error) => {
    console.error('[postRunHooks] Async processing failed:', error);
  });
}

// ============================================================================
// Findings Extraction
// ============================================================================

interface ExtractAndSaveFindingsResult {
  labSlug: string | null;
  findingsCount: number;
  savedIds: string[];
  worstSeverity: string | null;
}

/**
 * Extract findings from a diagnostic run and save them to Diagnostic Details
 *
 * This function:
 * 1. Determines the labSlug from the toolId
 * 2. Extracts structured findings from the rawJson
 * 3. Saves findings to the Diagnostic Details table
 * 4. Returns summary statistics
 */
async function extractAndSaveFindings(
  companyId: string,
  run: DiagnosticRun
): Promise<ExtractAndSaveFindingsResult> {
  console.log('[postRunHooks] extractAndSaveFindings starting:', {
    companyId,
    runId: run.id,
    toolId: run.toolId,
    hasRawJson: !!run.rawJson,
  });

  // Get the labSlug for this tool
  const labSlug = getLabSlugForToolId(run.toolId);

  if (!labSlug) {
    console.log('[postRunHooks] No labSlug mapping for toolId:', run.toolId);
    return {
      labSlug: null,
      findingsCount: 0,
      savedIds: [],
      worstSeverity: null,
    };
  }

  // Skip if no raw data to extract from
  if (!run.rawJson) {
    console.log('[postRunHooks] No rawJson in run, skipping findings extraction');
    return {
      labSlug,
      findingsCount: 0,
      savedIds: [],
      worstSeverity: null,
    };
  }

  // Log the raw JSON structure for debugging
  const raw = run.rawJson as Record<string, unknown>;
  console.log('[postRunHooks] rawJson structure keys:', Object.keys(raw));
  if (raw.siteAssessment) {
    const sa = raw.siteAssessment as Record<string, unknown>;
    console.log('[postRunHooks] siteAssessment keys:', Object.keys(sa));
    console.log('[postRunHooks] siteAssessment.issues count:', Array.isArray(sa.issues) ? (sa.issues as unknown[]).length : 0);
    console.log('[postRunHooks] siteAssessment.recommendations count:', Array.isArray(sa.recommendations) ? (sa.recommendations as unknown[]).length : 0);
  }

  // Extract findings using the appropriate extractor
  const findings = extractFindingsForLab(labSlug, run.id, companyId, run.rawJson);

  console.log('[postRunHooks] Extracted findings:', {
    labSlug,
    findingsCount: findings.length,
    firstFinding: findings[0] ? {
      labSlug: findings[0].labSlug,
      category: findings[0].category,
      severity: findings[0].severity,
      description: (findings[0].description || '').slice(0, 80),
    } : null,
  });

  if (findings.length === 0) {
    console.log('[postRunHooks] No findings extracted for labSlug:', labSlug);
    return {
      labSlug,
      findingsCount: 0,
      savedIds: [],
      worstSeverity: null,
    };
  }

  // Delete old unconverted findings for this company/lab before saving new ones
  // This prevents duplicate findings from accumulating across runs
  console.log('[postRunHooks] Clearing old unconverted findings...');
  const deletedCount = await deleteUnconvertedFindingsForCompanyLab(companyId, labSlug);
  if (deletedCount > 0) {
    console.log('[postRunHooks] Deleted', deletedCount, 'old unconverted findings');
  }

  // Save findings to Diagnostic Details
  console.log('[postRunHooks] Saving', findings.length, 'findings to Airtable...');
  const savedIds = await saveDiagnosticFindings(findings);
  console.log('[postRunHooks] Saved', savedIds.length, 'findings, IDs:', savedIds.slice(0, 3));

  // Determine worst severity
  const worstSeverity = getWorstSeverity(findings);

  return {
    labSlug,
    findingsCount: findings.length,
    savedIds,
    worstSeverity,
  };
}
