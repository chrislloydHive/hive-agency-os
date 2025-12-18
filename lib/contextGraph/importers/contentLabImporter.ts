// lib/contextGraph/importers/contentLabImporter.ts
// Content Lab Importer - imports data from Content Lab runs into Context Graph
//
// DOMAIN AUTHORITY: content
// RULE: Only reads from findings.* - never dimensions/summaries

import type { DomainImporter, ImportResult } from './types';
import type { CompanyContextGraph } from '../companyContextGraph';
import type { ContentLabOutput, ContentLabFindings } from '@/lib/diagnostics/contracts/labOutput';
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
 * Imports historical Content Lab data into the context graph.
 * Note: Requires Content Lab runs to be stored - implement fetching when available.
 */
export const contentLabImporter: DomainImporter = {
  id: 'contentLab',
  label: 'Content Lab',

  async supports(companyId: string, domain: string): Promise<boolean> {
    // TODO: Check if company has Content Lab runs
    // For now, return false until Content Lab storage is implemented
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

    // TODO: Implement when Content Lab run storage is available
    // 1. Fetch most recent Content Lab run for company
    // 2. Convert to ContentLabOutput format
    // 3. Call importContentLabFromContract()

    result.errors.push('Content Lab import not yet implemented - requires Content Lab run storage');
    return result;
  },
};

export default contentLabImporter;
