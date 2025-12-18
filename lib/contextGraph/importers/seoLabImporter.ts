// lib/contextGraph/importers/seoLabImporter.ts
// SEO Lab Importer - imports data from SEO Lab runs into Context Graph
//
// DOMAIN AUTHORITY: seo
// RULE: Only reads from findings.* - never dimensions/summaries

import type { DomainImporter, ImportResult } from './types';
import type { CompanyContextGraph } from '../companyContextGraph';
import type { SeoLabOutput, SeoLabFindings } from '@/lib/diagnostics/contracts/labOutput';
import { setDomainFields, createProvenance } from '../mutate';

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
 * Imports historical SEO Lab data into the context graph.
 * Note: Requires SEO Lab runs to be stored - implement fetching when available.
 */
export const seoLabImporter: DomainImporter = {
  id: 'seoLab',
  label: 'SEO Lab',

  async supports(companyId: string, domain: string): Promise<boolean> {
    // TODO: Check if company has SEO Lab runs
    // For now, return false until SEO Lab storage is implemented
    return false;
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

    // TODO: Implement when SEO Lab run storage is available
    // 1. Fetch most recent SEO Lab run for company
    // 2. Convert to SeoLabOutput format
    // 3. Call importSeoLabFromContract()

    result.errors.push('SEO Lab import not yet implemented - requires SEO Lab run storage');
    return result;
  },
};

export default seoLabImporter;
