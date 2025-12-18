// lib/contextGraph/importers/seoLabImporter.ts
// SEO Lab Importer - imports data from SEO Lab runs into Context Graph
//
// DOMAIN AUTHORITY: seo
// RULE: Only reads from findings.* - never dimensions/summaries

import type { DomainImporter, ImportResult } from './types';
import type { CompanyContextGraph } from '../companyContextGraph';
import type { SeoLabOutput, SeoLabFindings } from '@/lib/diagnostics/contracts/labOutput';
import { setDomainFields, createProvenance } from '../mutate';
import { listDiagnosticRunsForCompany } from '@/lib/os/diagnostics/runs';

// Debug logging - enabled via DEBUG_CONTEXT_HYDRATION=1
const DEBUG = process.env.DEBUG_CONTEXT_HYDRATION === '1';
function debugLog(message: string, data?: Record<string, unknown>) {
  if (DEBUG) {
    console.log(`[seoLabImporter:DEBUG] ${message}`, data ? JSON.stringify(data, null, 2) : '');
  }
}

// ============================================================================
// Validation Helpers
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

// ============================================================================
// Contract-based Import
// ============================================================================

/**
 * Import SEO Lab findings from LabOutput contract
 *
 * Maps findings to:
 * - seo.seoScore
 * - seo.seoSummary
 * - seo.technicalIssues
 * - seo.keywordOpportunities
 * - seo.onPageAssessment
 * - seo.contentGaps
 * - seo.backlinks
 * - seo.localSeo
 */
export function importSeoLabFromContract(
  graph: CompanyContextGraph,
  output: SeoLabOutput
): { graph: CompanyContextGraph; fieldsWritten: number; domains: string[] } {
  const { findings, meta } = output;

  if (!findings || typeof findings !== 'object') {
    return { graph, fieldsWritten: 0, domains: [] };
  }

  const provenance = createProvenance('seo_lab', {
    runId: meta.runId,
    confidence: 0.85,
    notes: `SEO Lab v${meta.version}`,
  });

  let fieldsWritten = 0;
  const domainsWritten = new Set<string>();

  // Map to seo domain
  const seoFields: Record<string, unknown> = {};

  if (isMeaningfulValue(findings.seoScore)) {
    seoFields.seoScore = findings.seoScore;
  }
  if (isMeaningfulValue(findings.seoSummary)) {
    seoFields.seoSummary = findings.seoSummary;
  }
  if (isMeaningfulValue(findings.technicalIssues)) {
    seoFields.technicalIssues = findings.technicalIssues;
  }
  if (isMeaningfulValue(findings.keywordOpportunities)) {
    seoFields.keywordOpportunities = findings.keywordOpportunities;
  }
  if (findings.onPageAssessment && isMeaningfulValue(findings.onPageAssessment)) {
    seoFields.onPageAssessment = filterMeaningful(findings.onPageAssessment);
  }
  if (isMeaningfulValue(findings.contentGaps)) {
    seoFields.contentGaps = findings.contentGaps;
  }
  if (findings.backlinks && isMeaningfulValue(findings.backlinks)) {
    seoFields.backlinks = filterMeaningful(findings.backlinks);
  }
  if (findings.localSeo && isMeaningfulValue(findings.localSeo)) {
    seoFields.localSeo = filterMeaningful(findings.localSeo);
  }

  if (Object.keys(seoFields).length > 0) {
    setDomainFields(graph, 'seo' as any, seoFields as any, provenance);
    fieldsWritten = Object.keys(seoFields).length;
    domainsWritten.add('seo');
  }

  return { graph, fieldsWritten, domains: Array.from(domainsWritten) };
}

// ============================================================================
// Legacy Importer Interface
// ============================================================================

/**
 * SEO Lab Importer
 *
 * Imports SEO Lab data from DIAGNOSTIC_RUNS into the context graph.
 */
export const seoLabImporter: DomainImporter = {
  id: 'seoLab',
  label: 'SEO Lab',

  async supports(companyId: string, domain: string): Promise<boolean> {
    try {
      // Check Diagnostic Runs table (primary source)
      const diagnosticRuns = await listDiagnosticRunsForCompany(companyId, {
        toolId: 'seoLab',
        limit: 5,
      });
      const hasSeoLab = diagnosticRuns.some(run =>
        run.status === 'complete' && run.rawJson
      );
      if (hasSeoLab) {
        console.log('[seoLabImporter] Found SEO Lab data in Diagnostic Runs');
        return true;
      }
      return false;
    } catch (error) {
      console.warn('[seoLabImporter] Error checking support:', error);
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
        toolId: 'seoLab',
        limit: 5,
      });
      const seoRun = diagnosticRuns.find(run =>
        run.status === 'complete' && run.rawJson
      );

      if (!seoRun || !seoRun.rawJson) {
        result.errors.push('No completed SEO Lab runs found in Diagnostic Runs');
        return result;
      }

      console.log('[seoLabImporter] Importing from Diagnostic Runs table');
      result.sourceRunIds.push(seoRun.id);

      // Extract the SEO Lab result from rawJson
      // Structure may be: rawEvidence.labResultV4 OR direct fields
      const rawData = seoRun.rawJson as Record<string, unknown>;
      let seoLabData: SeoLabFindings | null = null;

      // Try new format first: rawEvidence.labResultV4
      const rawEvidence = rawData.rawEvidence as Record<string, unknown> | undefined;
      let extractionPath = 'unknown';
      if (rawEvidence?.labResultV4) {
        const labResult = rawEvidence.labResultV4 as Record<string, unknown>;
        seoLabData = (labResult.findings || labResult) as SeoLabFindings;
        extractionPath = 'rawEvidence.labResultV4';
        console.log('[seoLabImporter] Extracted from rawEvidence.labResultV4');
      } else if (rawData.findings) {
        // Legacy: direct findings
        seoLabData = rawData.findings as SeoLabFindings;
        extractionPath = 'findings';
        console.log('[seoLabImporter] Extracted from root findings');
      } else {
        // Legacy: root-level fields
        seoLabData = rawData as unknown as SeoLabFindings;
        extractionPath = 'root';
        console.log('[seoLabImporter] Using root-level data');
      }
      debugLog('extraction', { source: 'DIAGNOSTIC_RUNS', extractionPath, runId: seoRun.id });

      if (!seoLabData) {
        result.errors.push('SEO Lab rawJson missing expected structure');
        return result;
      }

      // Create SeoLabOutput wrapper and import
      const output: SeoLabOutput = {
        meta: {
          labKey: 'seo_lab',
          runId: seoRun.id,
          version: '1.0',
          createdAt: seoRun.createdAt,
          inputsUsed: ['diagnostic_run'],
        },
        findings: seoLabData,
      };

      const importResult = importSeoLabFromContract(graph, output);
      result.fieldsUpdated = importResult.fieldsWritten;
      result.updatedPaths = importResult.domains.map(d => `${d}.*`);
      result.success = importResult.fieldsWritten > 0;

      console.log(`[seoLabImporter] Imported ${result.fieldsUpdated} fields from SEO Lab run ${seoRun.id}`);

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      result.errors.push(`Import failed: ${errorMsg}`);
      console.error('[seoLabImporter] Import error:', error);
    }

    return result;
  },
};

export default seoLabImporter;
