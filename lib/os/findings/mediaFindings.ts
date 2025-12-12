// lib/os/findings/mediaFindings.ts
// Media Findings Service
//
// Provides functions to query media and analytics-related findings for Media Lab.
// This surfaces AI-generated insights about media performance.

import { getCompanyFindings, type FindingsFilter } from './companyFindings';
import type { DiagnosticDetailFinding } from '@/lib/airtable/diagnosticDetails';

// ============================================================================
// Types
// ============================================================================

export interface MediaFinding {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  recommendation?: string;
  labSlug: string;
  category?: string;
  isAiGenerated?: boolean;
  estimatedImpact?: string;
  location?: string;
  createdAt?: string;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Map a DiagnosticDetailFinding to a simplified MediaFinding
 */
function mapToMediaFinding(finding: DiagnosticDetailFinding): MediaFinding {
  // Extract title from description (first sentence or truncated)
  const description = finding.description || '';
  const title = description.split('.')[0]?.slice(0, 80) || 'Finding';

  // Check if AI-generated based on issueKey pattern
  const isAiGenerated = finding.issueKey?.startsWith('analytics_ai_') || false;

  // Normalize estimatedImpact to string
  const impact =
    finding.estimatedImpact !== undefined
      ? String(finding.estimatedImpact)
      : undefined;

  return {
    id: finding.id || '',
    severity: (finding.severity as MediaFinding['severity']) || 'medium',
    title,
    description,
    recommendation: finding.recommendation,
    labSlug: finding.labSlug || 'unknown',
    category: finding.category,
    isAiGenerated,
    estimatedImpact: impact,
    location: finding.location,
    createdAt: finding.createdAt,
  };
}

/**
 * Sort findings by severity (critical > high > medium > low)
 */
function sortBySeverity(findings: MediaFinding[]): MediaFinding[] {
  const severityOrder: Record<string, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  };
  return [...findings].sort((a, b) => {
    const aOrder = severityOrder[a.severity] ?? 99;
    const bOrder = severityOrder[b.severity] ?? 99;
    return aOrder - bOrder;
  });
}

// ============================================================================
// Main Functions
// ============================================================================

/**
 * Get top media-related findings for a company
 *
 * Filters findings by analytics and media lab slugs, sorts by severity,
 * and returns the top N findings for the Issues & Opportunities panel.
 *
 * @param companyId - Company ID
 * @param limit - Max number of findings to return (default 10)
 * @returns Array of MediaFinding
 */
export async function getTopMediaFindingsForCompany(
  companyId: string,
  limit: number = 10
): Promise<MediaFinding[]> {
  console.log('[mediaFindings] getTopMediaFindingsForCompany:', { companyId, limit });

  try {
    // Fetch findings filtered by media-related lab slugs
    const filter: FindingsFilter = {
      labs: ['analytics', 'media', 'demand'],
      includeConverted: false,
    };

    const findings = await getCompanyFindings(companyId, filter);

    // Map to MediaFinding type
    const mediaFindings = findings.map(mapToMediaFinding);

    // Sort by severity and limit
    const sorted = sortBySeverity(mediaFindings);
    const limited = sorted.slice(0, limit);

    console.log('[mediaFindings] Returning', limited.length, 'findings for Media Lab');
    return limited;
  } catch (error) {
    console.error('[mediaFindings] Error fetching media findings:', error);
    return [];
  }
}

/**
 * Get all media-related findings for a company (no limit)
 *
 * @param companyId - Company ID
 * @returns Array of MediaFinding
 */
export async function getAllMediaFindingsForCompany(
  companyId: string
): Promise<MediaFinding[]> {
  console.log('[mediaFindings] getAllMediaFindingsForCompany:', companyId);

  try {
    const filter: FindingsFilter = {
      labs: ['analytics', 'media', 'demand'],
      includeConverted: true,
    };

    const findings = await getCompanyFindings(companyId, filter);
    const mediaFindings = findings.map(mapToMediaFinding);
    return sortBySeverity(mediaFindings);
  } catch (error) {
    console.error('[mediaFindings] Error fetching all media findings:', error);
    return [];
  }
}

/**
 * Get severity color classes for a finding
 */
export function getSeverityColorClasses(severity: MediaFinding['severity']): string {
  const colors: Record<MediaFinding['severity'], string> = {
    critical: 'bg-red-500/10 text-red-400 border-red-500/30',
    high: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
    medium: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    low: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
  };
  return colors[severity] || colors.medium;
}

/**
 * Get severity label
 */
export function getSeverityLabel(severity: MediaFinding['severity']): string {
  const labels: Record<MediaFinding['severity'], string> = {
    critical: 'Critical',
    high: 'High',
    medium: 'Medium',
    low: 'Low',
  };
  return labels[severity] || 'Unknown';
}
