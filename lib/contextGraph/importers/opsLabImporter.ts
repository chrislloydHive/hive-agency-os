// lib/contextGraph/importers/opsLabImporter.ts
// Ops Lab Importer - imports data from Ops Lab runs into Context Graph
//
// DOMAIN AUTHORITY: ops, capabilities, operationalConstraints
// RULE: Only reads from findings.* - never dimensions/summaries

import type { DomainImporter, ImportResult } from './types';
import type { CompanyContextGraph } from '../companyContextGraph';
import type { OpsLabOutput, OpsLabFindings } from '@/lib/diagnostics/contracts/labOutput';
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

export const opsLabImporter: DomainImporter = {
  id: 'opsLab',
  label: 'Ops Lab',

  async supports(companyId: string, domain: string): Promise<boolean> {
    return false; // TODO: Implement when Ops Lab storage is available
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
      errors: ['Ops Lab import not yet implemented'],
      sourceRunIds: [],
    };
  },
};

export default opsLabImporter;
