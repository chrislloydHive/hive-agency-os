// lib/contextGraph/importers/demandLabImporter.ts
// Demand Lab Importer - imports data from Demand Lab runs into Context Graph
//
// DOMAIN AUTHORITY: performanceMedia (shared with media_lab)
// RULE: Only reads from findings.* - never dimensions/summaries

import type { DomainImporter, ImportResult } from './types';
import type { CompanyContextGraph } from '../companyContextGraph';
import type { DemandLabOutput, DemandLabFindings } from '@/lib/diagnostics/contracts/labOutput';
import { setDomainFields, createProvenance } from '../mutate';
import { listDiagnosticRunsForCompany } from '@/lib/os/diagnostics/runs';

// Debug logging - enabled via DEBUG_CONTEXT_HYDRATION=1
const DEBUG = process.env.DEBUG_CONTEXT_HYDRATION === '1';
function debugLog(message: string, data?: Record<string, unknown>) {
  if (DEBUG) {
    console.log(`[demandLabImporter:DEBUG] ${message}`, data ? JSON.stringify(data, null, 2) : '');
  }
}

// ============================================================================
// Validation Helpers
// ============================================================================

function isMeaningfulValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (value === '') return false;
  if (Array.isArray(value) && value.length === 0) return false;
  if (typeof value === 'object' && Object.keys(value).length === 0) return false;

  if (typeof value === 'string') {
    const lower = value.toLowerCase();
    if (lower.includes('[placeholder]')) return false;
    if (lower.includes('n/a') && lower.length < 10) return false;
    if (lower.includes('not available')) return false;
  }

  return true;
}

function filterMeaningful<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const result: Partial<T> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (isMeaningfulValue(value)) {
      result[key as keyof T] = value as T[keyof T];
    }
  }
  return result;
}

// ============================================================================
// Contract-based Import
// ============================================================================

/**
 * Import Demand Lab findings from LabOutput contract
 *
 * Maps findings to:
 * - performanceMedia.channelPerformance
 * - performanceMedia.conversionMetrics
 * - audience.demandStates (if applicable)
 */
export function importDemandLabFromContract(
  graph: CompanyContextGraph,
  output: DemandLabOutput
): { graph: CompanyContextGraph; fieldsWritten: number; domains: string[] } {
  const { findings, meta } = output;

  if (!findings || typeof findings !== 'object') {
    return { graph, fieldsWritten: 0, domains: [] };
  }

  const provenance = createProvenance('demand_lab', {
    runId: meta.runId,
    confidence: 0.85,
    notes: `Demand Lab v${meta.version}`,
  });

  let fieldsWritten = 0;
  const domainsWritten = new Set<string>();

  // Map to performanceMedia domain
  const performanceMediaFields: Record<string, unknown> = {};

  if (isMeaningfulValue(findings.demandScore)) {
    performanceMediaFields.demandScore = findings.demandScore;
  }
  if (isMeaningfulValue(findings.demandSummary)) {
    performanceMediaFields.demandSummary = findings.demandSummary;
  }
  if (isMeaningfulValue(findings.channelPerformance)) {
    performanceMediaFields.channelPerformance = findings.channelPerformance;
  }
  if (findings.conversionMetrics && isMeaningfulValue(findings.conversionMetrics)) {
    performanceMediaFields.conversionMetrics = filterMeaningful(findings.conversionMetrics);
  }

  if (Object.keys(performanceMediaFields).length > 0) {
    setDomainFields(graph, 'performanceMedia' as any, performanceMediaFields as any, provenance);
    fieldsWritten += Object.keys(performanceMediaFields).length;
    domainsWritten.add('performanceMedia');
  }

  // Map buyer journey to audience domain if present
  if (findings.buyerJourney && isMeaningfulValue(findings.buyerJourney)) {
    setDomainFields(
      graph,
      'audience' as any,
      { buyerJourney: filterMeaningful(findings.buyerJourney) } as any,
      provenance
    );
    fieldsWritten += 1;
    domainsWritten.add('audience');
  }

  // Map demand states to audience if present
  if (isMeaningfulValue(findings.audienceDemandStates)) {
    setDomainFields(
      graph,
      'audience' as any,
      { demandStates: findings.audienceDemandStates } as any,
      provenance
    );
    fieldsWritten += 1;
    domainsWritten.add('audience');
  }

  return { graph, fieldsWritten, domains: Array.from(domainsWritten) };
}

// ============================================================================
// Legacy Importer Interface
// ============================================================================

/**
 * Demand Lab Importer
 *
 * Imports Demand Lab data from DIAGNOSTIC_RUNS into the context graph.
 */
export const demandLabImporter: DomainImporter = {
  id: 'demandLab',
  label: 'Demand Lab',

  async supports(companyId: string, domain: string): Promise<boolean> {
    try {
      // Check Diagnostic Runs table (primary source)
      const diagnosticRuns = await listDiagnosticRunsForCompany(companyId, {
        toolId: 'demandLab',
        limit: 5,
      });
      const hasDemandLab = diagnosticRuns.some(run =>
        run.status === 'complete' && run.rawJson
      );
      if (hasDemandLab) {
        console.log('[demandLabImporter] Found Demand Lab data in Diagnostic Runs');
        return true;
      }
      return false;
    } catch (error) {
      console.warn('[demandLabImporter] Error checking support:', error);
      return false;
    }
  },

  async importAll(
    graph: CompanyContextGraph,
    companyId: string,
    domain: string
  ): Promise<ImportResult> {
    const result: ImportResult = {
      success: false,
      fieldsUpdated: 0,
      updatedPaths: [],
      errors: [],
      sourceRunIds: [],
    };

    try {
      // Fetch from Diagnostic Runs table
      const diagnosticRuns = await listDiagnosticRunsForCompany(companyId, {
        toolId: 'demandLab',
        limit: 5,
      });
      const demandRun = diagnosticRuns.find(run =>
        run.status === 'complete' && run.rawJson
      );

      if (!demandRun || !demandRun.rawJson) {
        result.errors.push('No completed Demand Lab runs found in Diagnostic Runs');
        return result;
      }

      console.log('[demandLabImporter] Importing from Diagnostic Runs table');
      result.sourceRunIds.push(demandRun.id);

      // Extract the Demand Lab result from rawJson
      // Structure may be: rawEvidence.labResultV4 OR direct fields
      const rawData = demandRun.rawJson as Record<string, unknown>;
      let demandLabData: DemandLabFindings | null = null;

      // Try new format first: rawEvidence.labResultV4
      const rawEvidence = rawData.rawEvidence as Record<string, unknown> | undefined;
      let extractionPath = 'unknown';
      if (rawEvidence?.labResultV4) {
        const labResult = rawEvidence.labResultV4 as Record<string, unknown>;
        demandLabData = (labResult.findings || labResult) as DemandLabFindings;
        extractionPath = 'rawEvidence.labResultV4';
        console.log('[demandLabImporter] Extracted from rawEvidence.labResultV4');
      } else if (rawData.findings) {
        // Legacy: direct findings
        demandLabData = rawData.findings as DemandLabFindings;
        extractionPath = 'findings';
        console.log('[demandLabImporter] Extracted from root findings');
      } else {
        // Legacy: root-level fields
        demandLabData = rawData as unknown as DemandLabFindings;
        extractionPath = 'root';
        console.log('[demandLabImporter] Using root-level data');
      }
      debugLog('extraction', { source: 'DIAGNOSTIC_RUNS', extractionPath, runId: demandRun.id });

      if (!demandLabData) {
        result.errors.push('Demand Lab rawJson missing expected structure');
        return result;
      }

      // Create DemandLabOutput wrapper and import
      const output: DemandLabOutput = {
        meta: {
          labKey: 'demand_lab',
          runId: demandRun.id,
          version: '1.0',
          createdAt: demandRun.createdAt,
          inputsUsed: ['diagnostic_run'],
        },
        findings: demandLabData,
      };

      const importResult = importDemandLabFromContract(graph, output);
      result.fieldsUpdated = importResult.fieldsWritten;
      result.updatedPaths = importResult.domains.map(d => `${d}.*`);
      result.success = importResult.fieldsWritten > 0;

      console.log(`[demandLabImporter] Imported ${result.fieldsUpdated} fields from Demand Lab run ${demandRun.id}`);

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      result.errors.push(`Import failed: ${errorMsg}`);
      console.error('[demandLabImporter] Import error:', error);
    }

    return result;
  },
};

export default demandLabImporter;
