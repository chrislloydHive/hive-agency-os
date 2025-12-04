// lib/contextGraph/health.ts
// Context Graph health checking utilities

import type { CompanyContextGraph, DomainName } from './companyContextGraph';
import { DOMAIN_NAMES } from './companyContextGraph';

/**
 * Context Graph health status
 */
export type ContextGraphHealthStatus = 'healthy' | 'partial' | 'empty' | 'unavailable';

/**
 * Context Graph health check result
 */
export interface ContextGraphHealth {
  status: ContextGraphHealthStatus;
  completenessScore: number;
  domainCoverage: Record<DomainName, number>;
  missingCoreDomains: DomainName[];
  lastUpdated: string | null;
  message: string;
}

/**
 * Core domains that should have data for a healthy graph
 */
const CORE_DOMAINS: DomainName[] = [
  'identity',
  'objectives',
  'audience',
];

/**
 * Check if a context graph is healthy and usable
 *
 * @param graph - The context graph to check, or null if unavailable
 * @returns Health check result with status and details
 */
export function checkContextGraphHealth(
  graph: CompanyContextGraph | null
): ContextGraphHealth {
  // Unavailable - null graph
  if (!graph) {
    return {
      status: 'unavailable',
      completenessScore: 0,
      domainCoverage: createEmptyDomainCoverage(),
      missingCoreDomains: [...CORE_DOMAINS],
      lastUpdated: null,
      message: 'Context data is not available for this company.',
    };
  }

  // Calculate domain coverage
  const domainCoverage = graph.meta.domainCoverage
    ? (graph.meta.domainCoverage as Record<DomainName, number>)
    : calculateDomainCoverageLocal(graph);

  const completenessScore = graph.meta.completenessScore ?? 0;

  // Find missing core domains (coverage < 10%)
  const missingCoreDomains = CORE_DOMAINS.filter(
    domain => (domainCoverage[domain] ?? 0) < 10
  );

  // Determine status
  let status: ContextGraphHealthStatus;
  let message: string;

  if (completenessScore >= 50 && missingCoreDomains.length === 0) {
    status = 'healthy';
    message = 'Context data is complete and ready for use.';
  } else if (completenessScore >= 20 || missingCoreDomains.length < CORE_DOMAINS.length) {
    status = 'partial';
    message = 'Context data is partially available. Some insights may be limited.';
  } else {
    status = 'empty';
    message = 'Context data is mostly empty. Run Strategic Setup or diagnostics to populate.';
  }

  return {
    status,
    completenessScore,
    domainCoverage,
    missingCoreDomains,
    lastUpdated: graph.meta.updatedAt ?? null,
    message,
  };
}

/**
 * Quick check if graph is healthy enough to proceed
 * Use this for gating features that require context data
 */
export function isContextGraphHealthy(graph: CompanyContextGraph | null): boolean {
  if (!graph) return false;
  const health = checkContextGraphHealth(graph);
  return health.status === 'healthy' || health.status === 'partial';
}

/**
 * Get a user-friendly status label
 */
export function getHealthStatusLabel(status: ContextGraphHealthStatus): string {
  switch (status) {
    case 'healthy':
      return 'Complete';
    case 'partial':
      return 'Partial';
    case 'empty':
      return 'Empty';
    case 'unavailable':
      return 'Unavailable';
  }
}

/**
 * Get status color classes for UI
 */
export function getHealthStatusColors(status: ContextGraphHealthStatus): {
  bg: string;
  text: string;
  border: string;
} {
  switch (status) {
    case 'healthy':
      return {
        bg: 'bg-emerald-500/10',
        text: 'text-emerald-400',
        border: 'border-emerald-500/30',
      };
    case 'partial':
      return {
        bg: 'bg-amber-500/10',
        text: 'text-amber-400',
        border: 'border-amber-500/30',
      };
    case 'empty':
      return {
        bg: 'bg-slate-500/10',
        text: 'text-slate-400',
        border: 'border-slate-500/30',
      };
    case 'unavailable':
      return {
        bg: 'bg-red-500/10',
        text: 'text-red-400',
        border: 'border-red-500/30',
      };
  }
}

/**
 * Create empty domain coverage record
 */
function createEmptyDomainCoverage(): Record<DomainName, number> {
  const coverage: Partial<Record<DomainName, number>> = {};
  for (const domain of DOMAIN_NAMES) {
    coverage[domain] = 0;
  }
  return coverage as Record<DomainName, number>;
}

/**
 * Calculate domain coverage locally (fallback when not in meta)
 */
function calculateDomainCoverageLocal(graph: CompanyContextGraph): Record<DomainName, number> {
  const coverage: Partial<Record<DomainName, number>> = {};

  for (const domain of DOMAIN_NAMES) {
    let totalFields = 0;
    let populatedFields = 0;

    function countFields(obj: unknown, depth = 0): void {
      if (depth > 10) return;

      if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
        const record = obj as Record<string, unknown>;

        if ('value' in record && 'provenance' in record) {
          totalFields++;
          if (record.value !== null && record.value !== undefined) {
            if (Array.isArray(record.value) && record.value.length === 0) {
              // Empty arrays don't count
            } else {
              populatedFields++;
            }
          }
        } else {
          for (const value of Object.values(record)) {
            countFields(value, depth + 1);
          }
        }
      }
    }

    countFields(graph[domain]);
    coverage[domain] = totalFields > 0 ? Math.round((populatedFields / totalFields) * 100) : 0;
  }

  return coverage as Record<DomainName, number>;
}
