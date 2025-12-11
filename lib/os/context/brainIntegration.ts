// lib/os/context/brainIntegration.ts
// Bridge context graph integrity engine to Brain + Overview

import {
  checkContextIntegrity,
  calculateFreshnessScore,
  autoResolveConflict,
  updateProvenance,
  getFieldsNeedingAttention,
} from './graphIntegrity';
import {
  REQUIRED_FIELDS,
  type IntegrityCheckResult,
  type ContextHealth,
  type FieldProvenance,
  type FieldConflict,
  type FreshnessScore,
  type MissingField,
  type ContextSource,
} from './types';

/**
 * Context health summary for display in Overview/Brain
 */
export interface ContextHealthSummary {
  /** Overall health score (0-100) */
  overallScore: number;
  /** Health level label */
  level: 'strong' | 'good' | 'needs-attention' | 'critical';
  /** Color for display */
  color: 'emerald' | 'cyan' | 'amber' | 'red';
  /** Short description */
  description: string;
  /** Completeness percentage */
  completenessPercent: number;
  /** Freshness percentage */
  freshnessPercent: number;
  /** Number of conflicts */
  conflictCount: number;
  /** Number of stale fields */
  staleFieldCount: number;
  /** Number of missing critical fields */
  missingCriticalCount: number;
  /** Last checked timestamp */
  lastChecked: string;
  /** Top issues to address */
  topIssues: Array<{
    field: string;
    issue: 'missing' | 'stale' | 'conflict';
    severity: 'critical' | 'high' | 'medium' | 'low';
  }>;
}

/**
 * Convert IntegrityCheckResult to ContextHealthSummary for UI
 */
export function toHealthSummary(result: IntegrityCheckResult): ContextHealthSummary {
  const score = result.health.overallScore;

  // Determine level
  let level: ContextHealthSummary['level'];
  let color: ContextHealthSummary['color'];
  let description: string;

  if (score >= 80) {
    level = 'strong';
    color = 'emerald';
    description = 'Context is well-maintained and up-to-date';
  } else if (score >= 60) {
    level = 'good';
    color = 'cyan';
    description = 'Context is mostly complete with minor gaps';
  } else if (score >= 40) {
    level = 'needs-attention';
    color = 'amber';
    description = 'Several context fields need updating';
  } else {
    level = 'critical';
    color = 'red';
    description = 'Context requires immediate attention';
  }

  // Get top issues
  const fieldsNeedingAttention = getFieldsNeedingAttention(result);
  const topIssues: ContextHealthSummary['topIssues'] = [];

  // Add critical missing fields
  for (const field of fieldsNeedingAttention.critical.slice(0, 3)) {
    topIssues.push({ field, issue: 'missing', severity: 'critical' });
  }

  // Add high priority fields
  for (const field of fieldsNeedingAttention.high.slice(0, 2)) {
    const isMissing = result.missingFields.some(m => m.fieldPath === field);
    const isStale = result.freshness.some(f => f.fieldPath === field && f.status !== 'fresh');
    topIssues.push({
      field,
      issue: isMissing ? 'missing' : isStale ? 'stale' : 'conflict',
      severity: 'high',
    });
  }

  return {
    overallScore: score,
    level,
    color,
    description,
    completenessPercent: result.health.completenessScore,
    freshnessPercent: result.health.freshnessScore,
    conflictCount: result.health.conflictCount,
    staleFieldCount: result.health.staleFieldCount,
    missingCriticalCount: result.health.missingCriticalCount,
    lastChecked: result.health.checkedAt,
    topIssues: topIssues.slice(0, 5),
  };
}

/**
 * Check context health for a company
 *
 * @param contextData - The company's context data object
 * @param provenanceMap - Map of field paths to provenance data
 * @returns Health summary for display
 */
export function checkCompanyContextHealth(
  contextData: unknown,
  provenanceMap: Record<string, Omit<FieldProvenance, 'fieldPath'>>
): ContextHealthSummary {
  const result = checkContextIntegrity(contextData, provenanceMap);
  return toHealthSummary(result);
}

/**
 * Get detailed integrity check for Brain Context page
 */
export function getDetailedIntegrityCheck(
  contextData: unknown,
  provenanceMap: Record<string, Omit<FieldProvenance, 'fieldPath'>>
): {
  health: ContextHealthSummary;
  missingFields: MissingField[];
  staleFields: FreshnessScore[];
  conflicts: FieldConflict[];
  recommendations: string[];
  provenance: Map<string, FieldProvenance>;
} {
  const result = checkContextIntegrity(contextData, provenanceMap);
  const health = toHealthSummary(result);

  // Filter to stale/expired fields
  const staleFields = result.freshness.filter(
    f => f.status === 'stale' || f.status === 'expired'
  );

  return {
    health,
    missingFields: result.missingFields,
    staleFields,
    conflicts: result.conflicts,
    recommendations: result.recommendations,
    provenance: result.provenance,
  };
}

/**
 * Format health summary for DataConfidenceBadge
 */
export function healthToDataSource(summary: ContextHealthSummary): {
  id: string;
  name: string;
  type: 'brain';
  lastUpdated: string | null;
  status: 'fresh' | 'stale' | 'missing' | 'error';
  description: string;
} {
  let status: 'fresh' | 'stale' | 'missing' | 'error';
  if (summary.level === 'strong' || summary.level === 'good') {
    status = 'fresh';
  } else if (summary.level === 'needs-attention') {
    status = 'stale';
  } else {
    status = 'missing';
  }

  return {
    id: 'context-health',
    name: 'Context Graph',
    type: 'brain',
    lastUpdated: summary.lastChecked,
    status,
    description: `${summary.overallScore}/100 · ${summary.conflictCount > 0 ? `${summary.conflictCount} conflicts` : 'No conflicts'}`,
  };
}

/**
 * Get quick health indicator for Overview card
 */
export function getQuickHealthIndicator(
  contextData: unknown,
  provenanceMap: Record<string, Omit<FieldProvenance, 'fieldPath'>>
): {
  score: number;
  label: string;
  color: string;
  needsAction: boolean;
  actionText?: string;
} {
  const summary = checkCompanyContextHealth(contextData, provenanceMap);

  let actionText: string | undefined;
  if (summary.missingCriticalCount > 0) {
    actionText = `Add ${summary.missingCriticalCount} critical field(s)`;
  } else if (summary.staleFieldCount > 2) {
    actionText = `Refresh ${summary.staleFieldCount} stale field(s)`;
  } else if (summary.conflictCount > 0) {
    actionText = `Resolve ${summary.conflictCount} conflict(s)`;
  }

  return {
    score: summary.overallScore,
    label: summary.level === 'strong' ? 'Strong' :
           summary.level === 'good' ? 'Good' :
           summary.level === 'needs-attention' ? 'Needs Update' : 'Critical',
    color: summary.color,
    needsAction: summary.level === 'needs-attention' || summary.level === 'critical',
    actionText,
  };
}

/**
 * Track a field update with provenance
 */
export function trackFieldUpdate(
  existingProvenance: Record<string, Omit<FieldProvenance, 'fieldPath'>>,
  fieldPath: string,
  newValue: unknown,
  source: ContextSource,
  confidence: number = 80
): Record<string, Omit<FieldProvenance, 'fieldPath'>> {
  const existing = existingProvenance[fieldPath]
    ? { ...existingProvenance[fieldPath], fieldPath }
    : undefined;

  const updated = updateProvenance(existing, fieldPath, newValue, source, confidence);

  return {
    ...existingProvenance,
    [fieldPath]: {
      value: updated.value,
      source: updated.source,
      setAt: updated.setAt,
      verifiedAt: updated.verifiedAt,
      history: updated.history,
      confidence: updated.confidence,
      locked: updated.locked,
      lockReason: updated.lockReason,
    },
  };
}

/**
 * Get fields grouped by status for display
 */
export function getFieldsByStatus(result: IntegrityCheckResult): {
  healthy: string[];
  stale: string[];
  expired: string[];
  missing: string[];
  conflicted: string[];
} {
  const healthy: string[] = [];
  const stale: string[] = [];
  const expired: string[] = [];
  const missing = result.missingFields.map(f => f.fieldPath);
  const conflicted = result.conflicts.filter(c => !c.resolved).map(c => c.fieldPath);

  for (const f of result.freshness) {
    if (conflicted.includes(f.fieldPath)) continue;

    switch (f.status) {
      case 'fresh':
        healthy.push(f.fieldPath);
        break;
      case 'stale':
        stale.push(f.fieldPath);
        break;
      case 'expired':
        expired.push(f.fieldPath);
        break;
    }
  }

  return { healthy, stale, expired, missing, conflicted };
}

/**
 * Generate context health report text
 */
export function generateHealthReport(summary: ContextHealthSummary): string {
  const lines: string[] = [];

  lines.push(`## Context Health Report`);
  lines.push('');
  lines.push(`**Overall Score:** ${summary.overallScore}/100 (${summary.level})`);
  lines.push(`**Completeness:** ${summary.completenessPercent}%`);
  lines.push(`**Freshness:** ${summary.freshnessPercent}%`);
  lines.push('');

  if (summary.topIssues.length > 0) {
    lines.push(`### Issues to Address`);
    for (const issue of summary.topIssues) {
      const icon = issue.severity === 'critical' ? '🔴' :
                   issue.severity === 'high' ? '🟠' : '🟡';
      lines.push(`${icon} **${issue.field}**: ${issue.issue}`);
    }
    lines.push('');
  }

  lines.push(`_Last checked: ${new Date(summary.lastChecked).toLocaleString()}_`);

  return lines.join('\n');
}
