// lib/contextGraph/importers/websiteLabImporter.ts
// Website Lab Importer - imports data from Website Lab V4 runs into Context Graph
//
// DOMAIN AUTHORITY: website, digitalInfra
// RULE: Only reads from findings.* - never dimensions/summaries
//
// Uses the existing WebsiteLabWriter mappings to import historical Website Lab data.
// Fetches runs via GAP Heavy Run records that contain websiteLabV4 diagnostic details.

import type { DomainImporter, ImportResult, ImportProof } from './types';
import type { CompanyContextGraph } from '../companyContextGraph';
import { getHeavyGapRunsByCompanyId } from '@/lib/airtable/gapHeavyRuns';
import { listDiagnosticRunsForCompany, type DiagnosticRun } from '@/lib/os/diagnostics/runs';
import { writeWebsiteLabToGraph } from '../websiteLabWriter';
import type { WebsiteUXLabResultV4 } from '@/lib/gap-heavy/modules/websiteLab';
import type { WebsiteLabOutput, WebsiteLabFindings } from '@/lib/diagnostics/contracts/labOutput';
import { setDomainFields, createProvenance } from '../mutate';

// Debug logging - enabled via DEBUG_CONTEXT_HYDRATION=1
const DEBUG = process.env.DEBUG_CONTEXT_HYDRATION === '1';
function debugLog(message: string, data?: Record<string, unknown>) {
  if (DEBUG) {
    console.log(`[websiteLabImporter:DEBUG] ${message}`, data ? JSON.stringify(data, null, 2) : '');
  }
}

// ============================================================================
// Contract-based Import (New)
// ============================================================================

/**
 * Check if a value is meaningful (not empty/placeholder)
 */
function isMeaningfulValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (value === '') return false;
  if (Array.isArray(value) && value.length === 0) return false;
  if (typeof value === 'object' && Object.keys(value).length === 0) return false;

  // Check for placeholder text
  if (typeof value === 'string') {
    const lower = value.toLowerCase();
    if (lower.includes('[placeholder]')) return false;
    if (lower.includes('n/a') && lower.length < 10) return false;
    if (lower.includes('not available')) return false;
    if (lower.includes('to be determined')) return false;
  }

  return true;
}

/**
 * Filter out non-meaningful values from an object
 */
function filterMeaningful<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const result: Partial<T> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (isMeaningfulValue(value)) {
      result[key as keyof T] = value as T[keyof T];
    }
  }
  return result;
}

/**
 * Import Website Lab findings from LabOutput contract
 * This is the new contract-based import method
 */
export function importWebsiteLabFromContract(
  graph: CompanyContextGraph,
  output: WebsiteLabOutput
): { graph: CompanyContextGraph; fieldsWritten: number; domains: string[] } {
  const { findings, meta } = output;

  if (!findings || typeof findings !== 'object') {
    return { graph, fieldsWritten: 0, domains: [] };
  }

  const provenance = createProvenance('website_lab', {
    runId: meta.runId,
    confidence: 0.85,
    notes: `Website Lab v${meta.version}`,
  });

  let fieldsWritten = 0;
  const domainsWritten = new Set<string>();

  // Map to website domain
  const websiteFields: Record<string, unknown> = {};

  if (isMeaningfulValue(findings.websiteScore)) {
    websiteFields.websiteScore = findings.websiteScore;
  }
  if (isMeaningfulValue(findings.websiteSummary)) {
    websiteFields.websiteSummary = findings.websiteSummary;
  }
  if (isMeaningfulValue(findings.criticalIssues)) {
    websiteFields.criticalIssues = findings.criticalIssues;
  }
  if (isMeaningfulValue(findings.quickWins)) {
    websiteFields.quickWins = findings.quickWins;
  }
  if (findings.uxAssessment && isMeaningfulValue(findings.uxAssessment)) {
    websiteFields.uxAssessment = filterMeaningful(findings.uxAssessment);
  }
  if (findings.conversionPaths && isMeaningfulValue(findings.conversionPaths)) {
    websiteFields.conversionPaths = filterMeaningful(findings.conversionPaths);
  }
  if (findings.technicalHealth && isMeaningfulValue(findings.technicalHealth)) {
    websiteFields.technicalHealth = filterMeaningful(findings.technicalHealth);
  }

  if (Object.keys(websiteFields).length > 0) {
    setDomainFields(graph, 'website' as any, websiteFields as any, provenance);
    fieldsWritten += Object.keys(websiteFields).length;
    domainsWritten.add('website');
  }

  // Map to digitalInfra domain
  const digitalInfraFields: Record<string, unknown> = {};

  if (findings.trackingStack && isMeaningfulValue(findings.trackingStack)) {
    if (findings.trackingStack.summary && isMeaningfulValue(findings.trackingStack.summary)) {
      digitalInfraFields.trackingStackSummary = findings.trackingStack.summary;
    }
    if (findings.trackingStack.analytics && isMeaningfulValue(findings.trackingStack.analytics)) {
      digitalInfraFields.analytics = findings.trackingStack.analytics;
    }
  }

  if (Object.keys(digitalInfraFields).length > 0) {
    setDomainFields(graph, 'digitalInfra' as any, digitalInfraFields as any, provenance);
    fieldsWritten += Object.keys(digitalInfraFields).length;
    domainsWritten.add('digitalInfra');
  }

  return { graph, fieldsWritten, domains: Array.from(domainsWritten) };
}

// ============================================================================
// Legacy Import (Backwards Compatible)
// ============================================================================

/**
 * Website Lab Importer
 *
 * Imports historical Website Lab V4 data into the context graph.
 * Uses the most recent completed run with websiteLabV4 data.
 */
export const websiteLabImporter: DomainImporter = {
  id: 'websiteLab',
  label: 'Website Lab',

  async supports(companyId: string, domain: string): Promise<boolean> {
    try {
      // Check Diagnostic Runs table first (primary source - where labs write)
      const diagnosticRuns = await listDiagnosticRunsForCompany(companyId, {
        toolId: 'websiteLab',
        limit: 5,
      });
      const hasDiagnosticWebsiteLab = diagnosticRuns.some(run =>
        run.status === 'complete' && run.rawJson
      );
      if (hasDiagnosticWebsiteLab) {
        console.log('[websiteLabImporter] Found Website Lab data in Diagnostic Runs');
        return true;
      }

      // Fall back to Heavy GAP Runs (legacy)
      const runs = await getHeavyGapRunsByCompanyId(companyId, 5);
      const hasWebsiteLab = runs.some(run => {
        const status = run.status;
        const hasLab = run.evidencePack?.websiteLabV4;
        return (status === 'completed' || status === 'paused') && hasLab;
      });

      return hasWebsiteLab;
    } catch (error) {
      console.warn('[websiteLabImporter] Error checking support:', error);
      return false;
    }
  },

  async importAll(
    graph: CompanyContextGraph,
    companyId: string,
    domain: string
  ): Promise<ImportResult> {
    const proofMode = process.env.DEBUG_CONTEXT_PROOF === '1';

    const result: ImportResult = {
      success: false,
      fieldsUpdated: 0,
      updatedPaths: [],
      errors: [],
      sourceRunIds: [],
    };

    // Initialize proof structure
    if (proofMode) {
      result.proof = {
        extractionPath: null,
        rawKeysFound: 0,
        candidateWrites: [],
        droppedByReason: {
          emptyValue: 0,
          domainAuthority: 0,
          wrongDomainForField: 0,
          sourcePriority: 0,
          humanConfirmed: 0,
          notCanonical: 0,
          other: 0,
        },
        persistedWrites: [],
      };
    }

    try {
      // 1. Try Diagnostic Runs table first (primary source - where labs write)
      const diagnosticRuns = await listDiagnosticRunsForCompany(companyId, {
        toolId: 'websiteLab',
        limit: 5,
      });
      const diagnosticWebsiteRun = diagnosticRuns.find(run =>
        run.status === 'complete' && run.rawJson
      );

      if (diagnosticWebsiteRun && diagnosticWebsiteRun.rawJson) {
        console.log('[websiteLabImporter] Importing from Diagnostic Runs table');
        result.sourceRunIds.push(diagnosticWebsiteRun.id);

        // Extract the WebsiteUXLabResultV4 from rawJson
        // The rawJson structure may be:
        // 1. New format: { rawEvidence: { labResultV4: { siteAssessment, ... } } }
        // 2. Wrapped in result: { result: { siteAssessment, ... } }
        // 3. Direct: { siteAssessment, siteGraph, ... }
        const rawData = diagnosticWebsiteRun.rawJson as Record<string, unknown>;
        let websiteLabData: WebsiteUXLabResultV4;

        // Try new format first: rawEvidence.labResultV4
        const rawEvidence = rawData.rawEvidence as Record<string, unknown> | undefined;
        let extractionPath: string = 'legacy';
        if (rawEvidence?.labResultV4) {
          websiteLabData = rawEvidence.labResultV4 as WebsiteUXLabResultV4;
          extractionPath = 'rawEvidence.labResultV4';
          console.log('[websiteLabImporter] Extracted from rawEvidence.labResultV4');
        } else {
          // Fall back to legacy formats
          websiteLabData = (rawData.result || rawData) as WebsiteUXLabResultV4;
          extractionPath = rawData.result ? 'result' : 'direct';
          console.log('[websiteLabImporter] Using legacy extraction path:', extractionPath);
        }

        // Update proof with extraction path
        if (proofMode && result.proof) {
          result.proof.extractionPath = `DIAGNOSTIC_RUNS:${extractionPath}`;
          result.proof.rawKeysFound = Object.keys(websiteLabData || {}).length;
        }

        debugLog('extraction', { source: 'DIAGNOSTIC_RUNS', extractionPath, runId: diagnosticWebsiteRun.id });

        // Validate we have expected structure
        if (!websiteLabData.siteAssessment && !websiteLabData.siteGraph) {
          console.warn('[websiteLabImporter] rawJson missing expected structure');
          console.warn('[websiteLabImporter] rawJson keys:', Object.keys(rawData));
          if (rawEvidence) {
            console.warn('[websiteLabImporter] rawEvidence keys:', Object.keys(rawEvidence));
          }
          result.errors.push('WebsiteLab rawJson missing siteAssessment or siteGraph');
          return result;
        }

        // Use the existing WebsiteLabWriter to map the data
        const writerResult = writeWebsiteLabToGraph(graph, websiteLabData, diagnosticWebsiteRun.id, { proofMode });

        result.fieldsUpdated = writerResult.fieldsUpdated;
        result.updatedPaths = writerResult.updatedPaths;
        result.errors.push(...writerResult.errors);
        result.success = writerResult.fieldsUpdated > 0;

        // Merge proof data from writer
        if (proofMode && result.proof && writerResult.proof) {
          result.proof.candidateWrites = writerResult.proof.candidateWrites;
          result.proof.droppedByReason = writerResult.proof.droppedByReason;
          result.proof.persistedWrites = writerResult.updatedPaths;
          if (writerResult.proof.offendingFields) {
            result.proof.offendingFields = writerResult.proof.offendingFields;
          }
        }

        console.log(`[websiteLabImporter] Imported ${result.fieldsUpdated} fields from Diagnostic Run ${diagnosticWebsiteRun.id}`);
        return result;
      }

      // 2. Fall back to Heavy GAP Runs (legacy)
      console.log('[websiteLabImporter] Falling back to Heavy GAP Runs');

      if (proofMode && result.proof) {
        result.proof.extractionPath = 'GAP_HEAVY_RUNS:evidencePack.websiteLabV4';
      }

      debugLog('fallback', { source: 'GAP_HEAVY_RUNS', reason: 'no_diagnostic_runs' });
      const runs = await getHeavyGapRunsByCompanyId(companyId, 10);

      // Find the most recent run with websiteLabV4 data
      const runWithLab = runs.find(run => {
        const status = run.status;
        return (status === 'completed' || status === 'paused') &&
               run.evidencePack?.websiteLabV4;
      });

      if (!runWithLab || !runWithLab.evidencePack?.websiteLabV4) {
        result.errors.push('No completed Website Lab runs found in Diagnostic Runs or Heavy GAP Runs');
        return result;
      }

      result.sourceRunIds.push(runWithLab.id);

      // Use the existing WebsiteLabWriter to map the data
      const websiteLabData = runWithLab.evidencePack.websiteLabV4 as WebsiteUXLabResultV4;

      if (proofMode && result.proof) {
        result.proof.rawKeysFound = Object.keys(websiteLabData || {}).length;
      }

      const writerResult = writeWebsiteLabToGraph(graph, websiteLabData, runWithLab.id, { proofMode });

      result.fieldsUpdated = writerResult.fieldsUpdated;
      result.updatedPaths = writerResult.updatedPaths;
      result.errors.push(...writerResult.errors);

      // Merge proof data from writer
      if (proofMode && result.proof && writerResult.proof) {
        result.proof.candidateWrites = writerResult.proof.candidateWrites;
        result.proof.droppedByReason = writerResult.proof.droppedByReason;
        result.proof.persistedWrites = writerResult.updatedPaths;
        if (writerResult.proof.offendingFields) {
          result.proof.offendingFields = writerResult.proof.offendingFields;
        }
      }

      result.success = writerResult.fieldsUpdated > 0;
      console.log(`[websiteLabImporter] Imported ${result.fieldsUpdated} fields from Heavy GAP Run ${runWithLab.id}`);

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      result.errors.push(`Import failed: ${errorMsg}`);
      console.error('[websiteLabImporter] Import error:', error);
    }

    return result;
  },
};

export default websiteLabImporter;
