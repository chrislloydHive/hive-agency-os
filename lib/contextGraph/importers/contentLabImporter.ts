// lib/contextGraph/importers/contentLabImporter.ts
// Content Lab Importer - imports data from Content Lab runs into Context Graph
//
// DOMAIN AUTHORITY: content
// RULE: Only reads from findings.* - never dimensions/summaries

import type { DomainImporter, ImportResult } from './types';
import type { CompanyContextGraph } from '../companyContextGraph';
import type { ContentLabOutput, ContentLabFindings } from '@/lib/diagnostics/contracts/labOutput';
import { setDomainFields, createProvenance } from '../mutate';
import { listDiagnosticRunsForCompany } from '@/lib/os/diagnostics/runs';

// Debug logging - enabled via DEBUG_CONTEXT_HYDRATION=1
const DEBUG = process.env.DEBUG_CONTEXT_HYDRATION === '1';
function debugLog(message: string, data?: Record<string, unknown>) {
  if (DEBUG) {
    console.log(`[contentLabImporter:DEBUG] ${message}`, data ? JSON.stringify(data, null, 2) : '');
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
 * Import Content Lab findings from LabOutput contract
 *
 * Maps findings to:
 * - content.contentScore
 * - content.contentSummary
 * - content.contentPillars
 * - content.contentGaps
 * - content.contentStrengths
 * - content.contentCalendar
 * - content.topPerformingContent
 * - content.contentRecommendations
 */
export function importContentLabFromContract(
  graph: CompanyContextGraph,
  output: ContentLabOutput
): { graph: CompanyContextGraph; fieldsWritten: number; domains: string[] } {
  const { findings, meta } = output;

  if (!findings || typeof findings !== 'object') {
    return { graph, fieldsWritten: 0, domains: [] };
  }

  const provenance = createProvenance('content_lab', {
    runId: meta.runId,
    confidence: 0.85,
    notes: `Content Lab v${meta.version}`,
  });

  let fieldsWritten = 0;
  const domainsWritten = new Set<string>();

  // Map to content domain
  const contentFields: Record<string, unknown> = {};

  if (isMeaningfulValue(findings.contentScore)) {
    contentFields.contentScore = findings.contentScore;
  }
  if (isMeaningfulValue(findings.contentSummary)) {
    contentFields.contentSummary = findings.contentSummary;
  }
  if (isMeaningfulValue(findings.contentPillars)) {
    contentFields.contentPillars = findings.contentPillars;
  }
  if (isMeaningfulValue(findings.contentGaps)) {
    contentFields.contentGaps = findings.contentGaps;
  }
  if (isMeaningfulValue(findings.contentStrengths)) {
    contentFields.contentStrengths = findings.contentStrengths;
  }
  if (findings.contentCalendar && isMeaningfulValue(findings.contentCalendar)) {
    contentFields.contentCalendar = filterMeaningful(findings.contentCalendar);
  }
  if (isMeaningfulValue(findings.topPerformingContent)) {
    contentFields.topPerformingContent = findings.topPerformingContent;
  }
  if (isMeaningfulValue(findings.contentRecommendations)) {
    contentFields.contentRecommendations = findings.contentRecommendations;
  }

  if (Object.keys(contentFields).length > 0) {
    setDomainFields(graph, 'content' as any, contentFields as any, provenance);
    fieldsWritten = Object.keys(contentFields).length;
    domainsWritten.add('content');
  }

  return { graph, fieldsWritten, domains: Array.from(domainsWritten) };
}

// ============================================================================
// Legacy Importer Interface
// ============================================================================

/**
 * Content Lab Importer
 *
 * Imports Content Lab data from DIAGNOSTIC_RUNS into the context graph.
 */
export const contentLabImporter: DomainImporter = {
  id: 'contentLab',
  label: 'Content Lab',

  async supports(companyId: string, domain: string): Promise<boolean> {
    try {
      // Check Diagnostic Runs table (primary source)
      const diagnosticRuns = await listDiagnosticRunsForCompany(companyId, {
        toolId: 'contentLab',
        limit: 5,
      });
      const hasContentLab = diagnosticRuns.some(run =>
        run.status === 'complete' && run.rawJson
      );
      if (hasContentLab) {
        console.log('[contentLabImporter] Found Content Lab data in Diagnostic Runs');
        return true;
      }
      return false;
    } catch (error) {
      console.warn('[contentLabImporter] Error checking support:', error);
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
        toolId: 'contentLab',
        limit: 5,
      });
      const contentRun = diagnosticRuns.find(run =>
        run.status === 'complete' && run.rawJson
      );

      if (!contentRun || !contentRun.rawJson) {
        result.errors.push('No completed Content Lab runs found in Diagnostic Runs');
        return result;
      }

      console.log('[contentLabImporter] Importing from Diagnostic Runs table');
      result.sourceRunIds.push(contentRun.id);

      // Extract the Content Lab result from rawJson
      // Structure may be: rawEvidence.labResultV4 OR direct fields
      const rawData = contentRun.rawJson as Record<string, unknown>;
      let contentLabData: ContentLabFindings | null = null;

      // Try new format first: rawEvidence.labResultV4
      const rawEvidence = rawData.rawEvidence as Record<string, unknown> | undefined;
      let extractionPath = 'unknown';
      if (rawEvidence?.labResultV4) {
        const labResult = rawEvidence.labResultV4 as Record<string, unknown>;
        contentLabData = (labResult.findings || labResult) as ContentLabFindings;
        extractionPath = 'rawEvidence.labResultV4';
        console.log('[contentLabImporter] Extracted from rawEvidence.labResultV4');
      } else if (rawData.findings) {
        // Legacy: direct findings
        contentLabData = rawData.findings as ContentLabFindings;
        extractionPath = 'findings';
        console.log('[contentLabImporter] Extracted from root findings');
      } else {
        // Legacy: root-level fields
        contentLabData = rawData as unknown as ContentLabFindings;
        extractionPath = 'root';
        console.log('[contentLabImporter] Using root-level data');
      }
      debugLog('extraction', { source: 'DIAGNOSTIC_RUNS', extractionPath, runId: contentRun.id });

      if (!contentLabData) {
        result.errors.push('Content Lab rawJson missing expected structure');
        return result;
      }

      // Create ContentLabOutput wrapper and import
      const output: ContentLabOutput = {
        meta: {
          labKey: 'content_lab',
          runId: contentRun.id,
          version: '1.0',
          createdAt: contentRun.createdAt,
          inputsUsed: ['diagnostic_run'],
        },
        findings: contentLabData,
      };

      const importResult = importContentLabFromContract(graph, output);
      result.fieldsUpdated = importResult.fieldsWritten;
      result.updatedPaths = importResult.domains.map(d => `${d}.*`);
      result.success = importResult.fieldsWritten > 0;

      console.log(`[contentLabImporter] Imported ${result.fieldsUpdated} fields from Content Lab run ${contentRun.id}`);

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      result.errors.push(`Import failed: ${errorMsg}`);
      console.error('[contentLabImporter] Import error:', error);
    }

    return result;
  },
};

export default contentLabImporter;
