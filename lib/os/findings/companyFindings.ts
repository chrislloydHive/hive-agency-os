// lib/os/findings/companyFindings.ts
// Company Findings Service
//
// Provides functions to query, filter, and manage diagnostic findings for a company.
// Integrates with:
// - Diagnostic Details (findings storage)
// - Work Items (for conversion)

import {
  getDiagnosticFindingsForCompany,
  getDiagnosticFindingsByRunId,
  updateDiagnosticFinding,
  type DiagnosticDetailFinding,
  type DiagnosticFindingCategory,
  type DiagnosticFindingSeverity,
} from '@/lib/airtable/diagnosticDetails';
import { createWorkItem, type CreateWorkItemInput } from '@/lib/work/workItems';
import type { WorkItem } from '@/lib/types/work';

// ============================================================================
// Types
// ============================================================================

export interface FindingsFilter {
  /** Filter by lab slugs (e.g., ['website', 'brand']) */
  labs?: string[];
  /** Filter by severities (e.g., ['high', 'critical']) */
  severities?: string[];
  /** Filter by categories (e.g., ['Technical', 'UX']) */
  categories?: string[];
  /** Include findings already converted to work items */
  includeConverted?: boolean;
}

export interface FindingsSummary {
  /** Total number of findings for the company */
  total: number;
  /** Count by severity */
  bySeverity: Record<string, number>;
  /** Count by lab slug */
  byLab: Record<string, number>;
  /** Count by category */
  byCategory: Record<string, number>;
  /** Count of findings converted to work items */
  converted: number;
  /** Count of findings not yet converted */
  unconverted: number;
}

export interface ConvertToWorkItemResult {
  /** Updated finding with work item link */
  finding: DiagnosticDetailFinding;
  /** Created work item */
  workItem: WorkItem;
}

// ============================================================================
// Query Functions
// ============================================================================

/**
 * Get all findings for a company with optional filtering
 *
 * @param companyId - Company ID
 * @param filters - Optional filters for labs, severities, categories
 * @returns Filtered list of findings
 */
export async function getCompanyFindings(
  companyId: string,
  filters?: FindingsFilter
): Promise<DiagnosticDetailFinding[]> {
  console.log('[companyFindings] getCompanyFindings:', { companyId, filters });

  // Fetch all findings for the company
  // Note: getDiagnosticFindingsForCompany only supports labSlug and severity filters
  // We'll do additional filtering in code
  const allFindings = await getDiagnosticFindingsForCompany(companyId);

  // Apply filters in code
  let filtered = allFindings;

  // Filter by labs
  if (filters?.labs && filters.labs.length > 0) {
    const labSet = new Set(filters.labs.map(l => l.toLowerCase()));
    filtered = filtered.filter(f => f.labSlug && labSet.has(f.labSlug.toLowerCase()));
  }

  // Filter by severities
  if (filters?.severities && filters.severities.length > 0) {
    const sevSet = new Set(filters.severities.map(s => s.toLowerCase()));
    filtered = filtered.filter(f => f.severity && sevSet.has(f.severity.toLowerCase()));
  }

  // Filter by categories
  if (filters?.categories && filters.categories.length > 0) {
    const catSet = new Set(filters.categories.map(c => c.toLowerCase()));
    filtered = filtered.filter(f => f.category && catSet.has(f.category.toLowerCase()));
  }

  // Filter out converted findings unless requested
  if (filters?.includeConverted === false) {
    filtered = filtered.filter(f => !f.isConvertedToWorkItem);
  }

  console.log('[companyFindings] Found', filtered.length, 'findings after filtering');
  return filtered;
}

/**
 * Get a summary of findings for a company
 *
 * @param companyId - Company ID
 * @returns Summary with counts by severity, lab, category
 */
export async function getCompanyFindingsSummary(
  companyId: string
): Promise<FindingsSummary> {
  console.log('[companyFindings] getCompanyFindingsSummary:', companyId);

  const findings = await getDiagnosticFindingsForCompany(companyId);

  const summary: FindingsSummary = {
    total: findings.length,
    bySeverity: {},
    byLab: {},
    byCategory: {},
    converted: 0,
    unconverted: 0,
  };

  for (const finding of findings) {
    // Count by severity
    const severity = finding.severity || 'unknown';
    summary.bySeverity[severity] = (summary.bySeverity[severity] || 0) + 1;

    // Count by lab
    const lab = finding.labSlug || 'unknown';
    summary.byLab[lab] = (summary.byLab[lab] || 0) + 1;

    // Count by category
    const category = finding.category || 'unknown';
    summary.byCategory[category] = (summary.byCategory[category] || 0) + 1;

    // Count converted vs unconverted
    if (finding.isConvertedToWorkItem) {
      summary.converted++;
    } else {
      summary.unconverted++;
    }
  }

  console.log('[companyFindings] Summary:', summary);
  return summary;
}

/**
 * Get the count of unconverted findings for a company
 *
 * @param companyId - Company ID
 * @returns Count of unconverted findings
 */
export async function getCompanyFindingsCount(
  companyId: string
): Promise<number> {
  const summary = await getCompanyFindingsSummary(companyId);
  return summary.unconverted;
}

/**
 * Get a single finding by ID
 *
 * @param findingId - Finding record ID
 * @returns The finding or null if not found
 */
export async function getFindingById(
  findingId: string
): Promise<DiagnosticDetailFinding | null> {
  // We don't have a direct getById, so we'll use the run query
  // This is a bit inefficient but works for now
  // TODO: Add a direct getById to diagnosticDetails.ts
  console.log('[companyFindings] getFindingById:', findingId);

  // For now, return null - the API will handle this via Airtable directly
  // In practice, the finding will be passed from the list
  return null;
}

// ============================================================================
// Work Item Conversion
// ============================================================================

/**
 * Map finding category to Work Item area
 */
function mapCategoryToArea(category?: string): string {
  const mapping: Record<string, string> = {
    'Technical': 'Website UX',
    'UX': 'Website UX',
    'Brand': 'Brand',
    'Content': 'Content',
    'SEO': 'SEO',
    'Analytics': 'Strategy',
    'Media': 'Strategy',
    'Demand': 'Funnel',
    'Ops': 'Strategy',
  };
  return mapping[category || ''] || 'Other';
}

/**
 * Map finding severity to Work Item priority
 */
function mapSeverityToPriority(severity?: string): 'high' | 'medium' | 'low' {
  const mapping: Record<string, 'high' | 'medium' | 'low'> = {
    'critical': 'high',
    'high': 'high',
    'medium': 'medium',
    'low': 'low',
  };
  return mapping[severity || 'medium'] || 'medium';
}

/**
 * Generate a work item title from a finding
 */
function generateWorkItemTitle(finding: DiagnosticDetailFinding): string {
  const parts: string[] = [];

  // Add dimension if available
  if (finding.dimension && finding.dimension !== 'Summary' && finding.dimension !== 'General') {
    parts.push(`[${finding.dimension}]`);
  } else if (finding.category) {
    parts.push(`[${finding.category}]`);
  }

  // Add description (truncated)
  const description = finding.description || 'Finding from diagnostic';
  const truncated = description.length > 80
    ? description.substring(0, 77) + '...'
    : description;
  parts.push(truncated);

  return parts.join(' ');
}

/**
 * Generate a work item description from a finding
 */
function generateWorkItemDescription(finding: DiagnosticDetailFinding): string {
  const parts: string[] = [];

  // Add finding description
  if (finding.description) {
    parts.push('**Issue:**');
    parts.push(finding.description);
    parts.push('');
  }

  // Add recommendation
  if (finding.recommendation) {
    parts.push('**Recommendation:**');
    parts.push(finding.recommendation);
    parts.push('');
  }

  // Add metadata
  const metadata: string[] = [];
  if (finding.labSlug) metadata.push(`Lab: ${finding.labSlug}`);
  if (finding.severity) metadata.push(`Severity: ${finding.severity}`);
  if (finding.location) metadata.push(`Location: ${finding.location}`);
  if (finding.estimatedImpact) metadata.push(`Impact: ${finding.estimatedImpact}`);

  if (metadata.length > 0) {
    parts.push('**Details:**');
    parts.push(metadata.join(' | '));
  }

  // Add source reference
  parts.push('');
  parts.push(`_Source: Diagnostic Finding (${finding.labSlug || 'unknown'} lab)_`);

  return parts.join('\n');
}

/**
 * Convert a finding to a Work Item
 *
 * @param findingId - The finding ID to convert
 * @param finding - The finding data (must be provided)
 * @param opts - Optional options like assignee
 * @returns The updated finding and created work item
 */
export async function convertFindingToWorkItem(
  findingId: string,
  finding: DiagnosticDetailFinding,
  opts?: { assigneeId?: string }
): Promise<ConvertToWorkItemResult> {
  console.log('[companyFindings] convertFindingToWorkItem:', { findingId, finding, opts });

  if (!finding.companyId) {
    throw new Error('Finding must have a companyId');
  }

  // Check if already converted
  if (finding.isConvertedToWorkItem && finding.workItemId) {
    throw new Error('Finding has already been converted to a work item');
  }

  // Create the work item
  const workItemInput: CreateWorkItemInput = {
    companyId: finding.companyId,
    title: generateWorkItemTitle(finding),
    description: generateWorkItemDescription(finding),
    area: mapCategoryToArea(finding.category),
    priority: mapSeverityToPriority(finding.severity),
    status: 'Backlog',
    sourceType: `Diagnostic Finding (${finding.labSlug || 'unknown'})`,
    sourceId: findingId,
  };

  const workItem = await createWorkItem(workItemInput);

  if (!workItem) {
    throw new Error('Failed to create work item');
  }

  // Update the finding to mark it as converted
  const updatedFinding = await updateDiagnosticFinding(findingId, {
    isConvertedToWorkItem: true,
    workItemId: workItem.id,
  });

  if (!updatedFinding) {
    // Work item was created but finding update failed
    // This is a partial failure - log it but return success
    console.error('[companyFindings] Warning: Work item created but finding update failed');
    return {
      finding: {
        ...finding,
        isConvertedToWorkItem: true,
        workItemId: workItem.id,
      },
      workItem,
    };
  }

  console.log('[companyFindings] Successfully converted finding to work item:', {
    findingId,
    workItemId: workItem.id,
  });

  return {
    finding: updatedFinding,
    workItem,
  };
}

// ============================================================================
// Lab Slug Helpers
// ============================================================================

/**
 * Get all known lab slugs for filtering UI
 */
export function getKnownLabSlugs(): { value: string; label: string }[] {
  return [
    { value: 'website', label: 'Website Lab' },
    { value: 'brand', label: 'Brand Lab' },
    { value: 'seo', label: 'SEO Lab' },
    { value: 'content', label: 'Content Lab' },
    { value: 'demand', label: 'Demand Lab' },
    { value: 'ops', label: 'Ops Lab' },
    { value: 'gap', label: 'GAP Assessment' },
  ];
}

/**
 * Get all known severities for filtering UI
 */
export function getKnownSeverities(): { value: string; label: string; color: string }[] {
  return [
    { value: 'critical', label: 'Critical', color: 'red' },
    { value: 'high', label: 'High', color: 'orange' },
    { value: 'medium', label: 'Medium', color: 'yellow' },
    { value: 'low', label: 'Low', color: 'slate' },
  ];
}

/**
 * Get all known categories for filtering UI
 */
export function getKnownCategories(): { value: string; label: string }[] {
  return [
    { value: 'Technical', label: 'Technical' },
    { value: 'UX', label: 'UX' },
    { value: 'Brand', label: 'Brand' },
    { value: 'Content', label: 'Content' },
    { value: 'SEO', label: 'SEO' },
    { value: 'Analytics', label: 'Analytics' },
    { value: 'Media', label: 'Media' },
    { value: 'Demand', label: 'Demand' },
    { value: 'Ops', label: 'Operations' },
  ];
}
