// lib/contextGraph/importers/demandLabImporter.ts
// Demand Lab Importer - imports data from Demand Lab runs into Context Graph
//
// DOMAIN AUTHORITY: performanceMedia (shared with media_lab)
// RULE: Only reads from findings.* - never dimensions/summaries

import type { DomainImporter, ImportResult } from './types';
import type { CompanyContextGraph } from '../companyContextGraph';
import type { DemandLabOutput, DemandLabFindings } from '@/lib/diagnostics/contracts/labOutput';
import { setDomainFields, createProvenance } from '../mutate';

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

export const demandLabImporter: DomainImporter = {
  id: 'demandLab',
  label: 'Demand Lab',

  async supports(companyId: string, domain: string): Promise<boolean> {
    return false; // TODO: Implement when Demand Lab storage is available
  },

  async importAll(
    graph: CompanyContextGraph,
    companyId: string,
    domain: string
  ): Promise<ImportResult> {
    return {
      success: false,
      fieldsUpdated: 0,
      updatedPaths: [],
      errors: ['Demand Lab import not yet implemented'],
      sourceRunIds: [],
    };
  },
};

export default demandLabImporter;
