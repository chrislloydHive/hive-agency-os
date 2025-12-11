// lib/os/findings/findingsIntegration.ts
// Bridge between new standardization engine and existing findings system

import type {
  Finding,
  LabSlug,
  FindingCategory,
  FindingSeverity,
  StandardizationResult,
} from './types';
import {
  standardizeFindings,
  standardizeMultipleLabFindings,
  getFindingsSummary,
} from './standardizeFindings';
import type {
  CreateDiagnosticFindingInput,
  DiagnosticFindingCategory,
  DiagnosticFindingSeverity,
} from '@/lib/airtable/diagnosticDetails';

/**
 * Map new Finding category to existing Airtable category
 */
function mapCategoryToAirtable(category: FindingCategory): DiagnosticFindingCategory {
  const mapping: Record<FindingCategory, DiagnosticFindingCategory> = {
    'seo': 'SEO',
    'listings': 'Brand', // GBP/citations go to Brand for now
    'social': 'Brand',
    'website': 'UX',
    'reputation': 'Brand',
    'content': 'Content',
    'technical': 'Technical',
    'competitive': 'Analytics',
  };
  return mapping[category] || 'UX';
}

/**
 * Map new Finding severity to existing Airtable severity
 */
function mapSeverityToAirtable(severity: FindingSeverity): DiagnosticFindingSeverity {
  const mapping: Record<FindingSeverity, DiagnosticFindingSeverity> = {
    'critical': 'critical',
    'high': 'high',
    'medium': 'medium',
    'low': 'low',
    'info': 'low',
  };
  return mapping[severity] || 'medium';
}

/**
 * Map old lab slug strings to new LabSlug type
 */
function mapToLabSlug(labSlug: string): LabSlug {
  const mapping: Record<string, LabSlug> = {
    'website': 'website',
    'brand': 'brand',
    'seo': 'rankings',
    'content': 'content',
    'demand': 'audience',
    'ops': 'technical',
    'gap': 'gbp',
    'gap-ia': 'gbp',
    'gap-plan': 'gbp',
    'competition': 'competition',
  };
  return mapping[labSlug.toLowerCase()] || 'website';
}

/**
 * Convert a standardized Finding to Airtable CreateDiagnosticFindingInput
 */
export function findingToAirtableInput(
  finding: Finding,
  runId: string,
  companyId: string
): CreateDiagnosticFindingInput {
  return {
    labRunId: runId,
    companyId,
    labSlug: finding.labSlug,
    category: mapCategoryToAirtable(finding.category),
    dimension: finding.dimension,
    severity: mapSeverityToAirtable(finding.severity),
    location: finding.location.url || finding.location.platform,
    issueKey: finding.issueKey,
    description: finding.description,
    recommendation: finding.recommendation,
    estimatedImpact: finding.estimatedImpact.level === 'high'
      ? 'High impact - prioritize'
      : finding.estimatedImpact.level === 'medium'
        ? 'Medium impact'
        : 'Low impact - nice to have',
  };
}

/**
 * Standardize raw lab output and convert to Airtable inputs
 *
 * This is the main integration function that:
 * 1. Takes raw lab output (any shape)
 * 2. Runs through standardization engine
 * 3. Returns Airtable-compatible findings
 */
export function standardizeAndConvert(
  labSlug: string,
  rawResult: unknown,
  runId: string,
  companyId: string,
  summaryText?: string
): {
  findings: CreateDiagnosticFindingInput[];
  standardized: Finding[];
  result: StandardizationResult;
} {
  // Map to new LabSlug
  const mappedLabSlug = mapToLabSlug(labSlug);

  // Run standardization
  const result = standardizeFindings(mappedLabSlug, rawResult, summaryText);

  // Convert to Airtable inputs
  const findings = result.findings.map(f =>
    findingToAirtableInput(f, runId, companyId)
  );

  return {
    findings,
    standardized: result.findings,
    result,
  };
}

/**
 * Standardize findings from multiple labs at once
 */
export function standardizeMultipleLabs(
  labResults: Array<{
    labSlug: string;
    rawResult: unknown;
    summaryText?: string;
  }>,
  runId: string,
  companyId: string
): {
  findings: CreateDiagnosticFindingInput[];
  standardized: Finding[];
  result: StandardizationResult;
} {
  // Map lab results to new format
  const mapped = labResults.map(lr => ({
    labSlug: mapToLabSlug(lr.labSlug),
    rawResult: lr.rawResult,
    summaryText: lr.summaryText,
  }));

  // Run standardization
  const result = standardizeMultipleLabFindings(mapped);

  // Convert to Airtable inputs
  const findings = result.findings.map(f =>
    findingToAirtableInput(f, runId, companyId)
  );

  return {
    findings,
    standardized: result.findings,
    result,
  };
}

/**
 * Get a summary suitable for display in Plan view
 */
export function getStandardizedSummary(findings: Finding[]): {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  byCategory: Record<string, number>;
  byLab: Record<string, number>;
  topIssues: Finding[];
} {
  const summary = getFindingsSummary(findings);

  return {
    total: summary.total,
    critical: summary.bySeverity.critical || 0,
    high: summary.bySeverity.high || 0,
    medium: summary.bySeverity.medium || 0,
    low: (summary.bySeverity.low || 0) + (summary.bySeverity.info || 0),
    byCategory: summary.byCategory,
    byLab: summary.byLab,
    topIssues: findings
      .filter(f => f.severity === 'critical' || f.severity === 'high')
      .slice(0, 10),
  };
}

/**
 * Group findings by theme for Plan view
 */
export function groupFindingsByTheme(findings: Finding[]): Record<string, Finding[]> {
  const themes: Record<string, Finding[]> = {
    'Foundation': [], // Technical issues
    'Visibility': [], // SEO, listings
    'Trust': [], // Reputation, reviews
    'Engagement': [], // Social, content
    'Conversion': [], // Website, UX
  };

  for (const finding of findings) {
    switch (finding.category) {
      case 'technical':
        themes['Foundation'].push(finding);
        break;
      case 'seo':
      case 'listings':
        themes['Visibility'].push(finding);
        break;
      case 'reputation':
        themes['Trust'].push(finding);
        break;
      case 'social':
      case 'content':
        themes['Engagement'].push(finding);
        break;
      case 'website':
        themes['Conversion'].push(finding);
        break;
      default:
        // Competitive goes to visibility
        themes['Visibility'].push(finding);
    }
  }

  return themes;
}

/**
 * Convert old findings format to new standardized format
 * (for migration purposes)
 */
export function migrateOldFinding(oldFinding: {
  labSlug?: string;
  category?: string;
  dimension?: string;
  severity?: string;
  location?: string;
  issueKey?: string;
  description?: string;
  recommendation?: string;
  estimatedImpact?: string;
}): Partial<Finding> {
  const labSlug = mapToLabSlug(oldFinding.labSlug || 'website');

  // Map old category to new
  const categoryMap: Record<string, FindingCategory> = {
    'Technical': 'technical',
    'UX': 'website',
    'Brand': 'reputation',
    'Content': 'content',
    'SEO': 'seo',
    'Analytics': 'competitive',
    'Media': 'social',
    'Demand': 'social',
    'Ops': 'technical',
  };

  const category = categoryMap[oldFinding.category || ''] || 'website';

  // Map old severity to new
  const severityMap: Record<string, FindingSeverity> = {
    'critical': 'critical',
    'high': 'high',
    'medium': 'medium',
    'low': 'low',
  };

  const severity = severityMap[oldFinding.severity?.toLowerCase() || ''] || 'medium';

  return {
    labSlug,
    category,
    dimension: (oldFinding.dimension?.toLowerCase() || 'completeness') as any,
    severity,
    location: { url: oldFinding.location },
    issueKey: oldFinding.issueKey || 'unknown',
    description: oldFinding.description || '',
    recommendation: oldFinding.recommendation || '',
  };
}
