// lib/contextGraph/importers/opsLabImporter.ts
// Ops Lab Importer - imports data from Ops Lab runs into Context Graph
//
// DOMAIN AUTHORITY: ops, capabilities, operationalConstraints
// RULE: Only reads from findings.* - never dimensions/summaries

import type { DomainImporter, ImportResult } from './types';
import type { CompanyContextGraph } from '../companyContextGraph';
import type { OpsLabOutput, OpsLabFindings } from '@/lib/diagnostics/contracts/labOutput';
import { setDomainFields, createProvenance } from '../mutate';
import { listDiagnosticRunsForCompany } from '@/lib/os/diagnostics/runs';

// Debug logging - enabled via DEBUG_CONTEXT_HYDRATION=1
const DEBUG = process.env.DEBUG_CONTEXT_HYDRATION === '1';
function debugLog(message: string, data?: Record<string, unknown>) {
  if (DEBUG) {
    console.log(`[opsLabImporter:DEBUG] ${message}`, data ? JSON.stringify(data, null, 2) : '');
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
 * Import Ops Lab findings from LabOutput contract
 *
 * Maps findings to:
 * - ops.opsScore, ops.opsSummary, ops.teamStructure, ops.processMaturity, ops.toolStack
 * - capabilities.* (team skills and capacity)
 * - operationalConstraints.constraints
 */
export function importOpsLabFromContract(
  graph: CompanyContextGraph,
  output: OpsLabOutput
): { graph: CompanyContextGraph; fieldsWritten: number; domains: string[] } {
  const { findings, meta } = output;

  if (!findings || typeof findings !== 'object') {
    return { graph, fieldsWritten: 0, domains: [] };
  }

  const provenance = createProvenance('ops_lab', {
    runId: meta.runId,
    confidence: 0.85,
    notes: `Ops Lab v${meta.version}`,
  });

  let fieldsWritten = 0;
  const domainsWritten = new Set<string>();

  // Map to ops domain
  const opsFields: Record<string, unknown> = {};

  if (isMeaningfulValue(findings.opsScore)) {
    opsFields.opsScore = findings.opsScore;
  }
  if (isMeaningfulValue(findings.opsSummary)) {
    opsFields.opsSummary = findings.opsSummary;
  }
  if (findings.teamStructure && isMeaningfulValue(findings.teamStructure)) {
    opsFields.teamStructure = filterMeaningful(findings.teamStructure);
  }
  if (findings.processMaturity && isMeaningfulValue(findings.processMaturity)) {
    opsFields.processMaturity = filterMeaningful(findings.processMaturity);
  }
  if (findings.toolStack && isMeaningfulValue(findings.toolStack)) {
    opsFields.toolStack = filterMeaningful(findings.toolStack);
  }
  if (isMeaningfulValue(findings.capacityAssessment)) {
    opsFields.capacityAssessment = findings.capacityAssessment;
  }

  if (Object.keys(opsFields).length > 0) {
    setDomainFields(graph, 'ops' as any, opsFields as any, provenance);
    fieldsWritten += Object.keys(opsFields).length;
    domainsWritten.add('ops');
  }

  // Map operational constraints
  if (isMeaningfulValue(findings.operationalConstraints)) {
    setDomainFields(
      graph,
      'operationalConstraints' as any,
      { constraints: findings.operationalConstraints } as any,
      provenance
    );
    fieldsWritten += 1;
    domainsWritten.add('operationalConstraints');
  }

  return { graph, fieldsWritten, domains: Array.from(domainsWritten) };
}

// ============================================================================
// Legacy Importer Interface
// ============================================================================

/**
 * Ops Lab Importer
 *
 * Imports Ops Lab data from DIAGNOSTIC_RUNS into the context graph.
 */
export const opsLabImporter: DomainImporter = {
  id: 'opsLab',
  label: 'Ops Lab',

  async supports(companyId: string, domain: string): Promise<boolean> {
    try {
      // Check Diagnostic Runs table (primary source)
      const diagnosticRuns = await listDiagnosticRunsForCompany(companyId, {
        toolId: 'opsLab',
        limit: 5,
      });
      const hasOpsLab = diagnosticRuns.some(run =>
        run.status === 'complete' && run.rawJson
      );
      if (hasOpsLab) {
        console.log('[opsLabImporter] Found Ops Lab data in Diagnostic Runs');
        return true;
      }
      return false;
    } catch (error) {
      console.warn('[opsLabImporter] Error checking support:', error);
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
        toolId: 'opsLab',
        limit: 5,
      });
      const opsRun = diagnosticRuns.find(run =>
        run.status === 'complete' && run.rawJson
      );

      if (!opsRun || !opsRun.rawJson) {
        result.errors.push('No completed Ops Lab runs found in Diagnostic Runs');
        return result;
      }

      console.log('[opsLabImporter] Importing from Diagnostic Runs table');
      result.sourceRunIds.push(opsRun.id);

      // Extract the Ops Lab result from rawJson
      // Structure may be: rawEvidence.labResultV4 OR direct fields
      const rawData = opsRun.rawJson as Record<string, unknown>;
      let opsLabData: OpsLabFindings | null = null;

      // Try new format first: rawEvidence.labResultV4
      const rawEvidence = rawData.rawEvidence as Record<string, unknown> | undefined;
      let extractionPath = 'unknown';
      if (rawEvidence?.labResultV4) {
        const labResult = rawEvidence.labResultV4 as Record<string, unknown>;
        opsLabData = (labResult.findings || labResult) as OpsLabFindings;
        extractionPath = 'rawEvidence.labResultV4';
        console.log('[opsLabImporter] Extracted from rawEvidence.labResultV4');
      } else if (rawData.findings) {
        // Legacy: direct findings
        opsLabData = rawData.findings as OpsLabFindings;
        extractionPath = 'findings';
        console.log('[opsLabImporter] Extracted from root findings');
      } else {
        // Legacy: root-level fields
        opsLabData = rawData as unknown as OpsLabFindings;
        extractionPath = 'root';
        console.log('[opsLabImporter] Using root-level data');
      }
      debugLog('extraction', { source: 'DIAGNOSTIC_RUNS', extractionPath, runId: opsRun.id });

      if (!opsLabData) {
        result.errors.push('Ops Lab rawJson missing expected structure');
        return result;
      }

      // Create OpsLabOutput wrapper and import
      const output: OpsLabOutput = {
        meta: {
          labKey: 'ops_lab',
          runId: opsRun.id,
          version: '1.0',
          createdAt: opsRun.createdAt,
          inputsUsed: ['diagnostic_run'],
        },
        findings: opsLabData,
      };

      const importResult = importOpsLabFromContract(graph, output);
      result.fieldsUpdated = importResult.fieldsWritten;
      result.updatedPaths = importResult.domains.map(d => `${d}.*`);
      result.success = importResult.fieldsWritten > 0;

      console.log(`[opsLabImporter] Imported ${result.fieldsUpdated} fields from Ops Lab run ${opsRun.id}`);

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      result.errors.push(`Import failed: ${errorMsg}`);
      console.error('[opsLabImporter] Import error:', error);
    }

    return result;
  },
};

export default opsLabImporter;
