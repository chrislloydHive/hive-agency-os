// lib/os/diagnostics/navigation.ts
// Canonical navigation helpers for diagnostic runs
//
// Provides consistent routing to run detail views across all UI surfaces:
// - Discover View buttons
// - Run History links
// - Documents artifact links
// - Notification deep links

import type { DiagnosticToolId } from './runs';

// ============================================================================
// Types
// ============================================================================

export interface RunViewHrefParams {
  companyId: string;
  toolId: DiagnosticToolId | string; // Accept string for aliases like 'website', 'website-lab'
  runId?: string;
}

// ============================================================================
// Tool ID Normalization
// ============================================================================

/**
 * Normalize tool ID variants to canonical DiagnosticToolId.
 *
 * Handles aliases:
 * - 'website', 'website-lab', 'websiteLab', 'websiteLabV5' → 'websiteLab'
 * - 'brand', 'brand-lab', 'brandLab' → 'brandLab'
 * - etc.
 */
export function normalizeToolId(toolId: string): DiagnosticToolId {
  const lowerToolId = toolId.toLowerCase().replace(/-/g, '');

  // Website Lab aliases
  if (lowerToolId === 'website' || lowerToolId === 'websitelab' || lowerToolId === 'websitelabv5') {
    return 'websiteLab';
  }

  // Brand Lab aliases
  if (lowerToolId === 'brand' || lowerToolId === 'brandlab') {
    return 'brandLab';
  }

  // Competition Lab aliases
  if (lowerToolId === 'competition' || lowerToolId === 'competitionlab') {
    return 'competitionLab';
  }

  // Competitor Lab aliases
  if (lowerToolId === 'competitor' || lowerToolId === 'competitorlab') {
    return 'competitorLab';
  }

  // SEO Lab aliases
  if (lowerToolId === 'seo' || lowerToolId === 'seolab') {
    return 'seoLab';
  }

  // Content Lab aliases
  if (lowerToolId === 'content' || lowerToolId === 'contentlab') {
    return 'contentLab';
  }

  // Demand Lab aliases
  if (lowerToolId === 'demand' || lowerToolId === 'demandlab') {
    return 'demandLab';
  }

  // Ops Lab aliases
  if (lowerToolId === 'ops' || lowerToolId === 'opslab') {
    return 'opsLab';
  }

  // Creative Lab aliases
  if (lowerToolId === 'creative' || lowerToolId === 'creativelab') {
    return 'creativeLab';
  }

  // Media Lab aliases
  if (lowerToolId === 'media' || lowerToolId === 'medialab') {
    return 'mediaLab';
  }

  // Audience Lab aliases
  if (lowerToolId === 'audience' || lowerToolId === 'audiencelab') {
    return 'audienceLab';
  }

  // GAP aliases
  if (lowerToolId === 'gap' || lowerToolId === 'gapsnapshot') {
    return 'gapSnapshot';
  }

  // Return as-is (assume it's already canonical)
  return toolId as DiagnosticToolId;
}

// ============================================================================
// Tool-Specific View Routes
// ============================================================================

/**
 * Tool-specific dedicated view pages
 *
 * These tools have rich, custom UI pages instead of the generic report renderer.
 * All other tools use the generic diagnostics/[slug] page.
 */
const DEDICATED_VIEW_ROUTES: Partial<Record<DiagnosticToolId, (companyId: string, runId?: string) => string>> = {
  // Website Lab uses the dedicated V5 results page
  // CANONICAL: /c/{companyId}/diagnostics/website?runId={runId}
  websiteLab: (companyId, runId) =>
    runId
      ? `/c/${companyId}/diagnostics/website?runId=${runId}`
      : `/c/${companyId}/diagnostics/website`,
};

/**
 * Generic report route pattern for tools without dedicated views
 */
function getGenericReportRoute(companyId: string, toolId: DiagnosticToolId, runId?: string): string {
  // Convert toolId to slug (e.g., 'websiteLab' -> 'website', 'brandLab' -> 'brand')
  const slug = toolId.replace(/Lab$/, '').toLowerCase();

  if (runId) {
    return `/c/${companyId}/reports/${slug}/${runId}`;
  }
  return `/c/${companyId}/diagnostics/${slug}`;
}

// ============================================================================
// Main Helper
// ============================================================================

/**
 * Get the canonical view URL for a diagnostic run
 *
 * This is the single source of truth for where to navigate when viewing
 * a diagnostic run. Use this everywhere:
 * - Discover "View" buttons
 * - Run History "View" links
 * - Documents artifact links
 * - Quick Diagnostics "View Details" links
 *
 * Handles tool ID aliases:
 * - 'website', 'website-lab', 'websiteLab' → websiteLab canonical route
 * - 'brand', 'brand-lab', 'brandLab' → brandLab canonical route
 *
 * @param params.companyId - Company ID
 * @param params.toolId - Diagnostic tool ID or alias (e.g., 'websiteLab', 'website', 'website-lab')
 * @param params.runId - Optional run ID for specific run view
 * @returns Canonical URL path for viewing the run
 */
export function getPrimaryRunViewHref(params: RunViewHrefParams): string {
  const { companyId, toolId, runId } = params;

  // Normalize tool ID to handle aliases
  const normalizedToolId = normalizeToolId(toolId);

  // Check for dedicated view route
  const dedicatedRoute = DEDICATED_VIEW_ROUTES[normalizedToolId];
  if (dedicatedRoute) {
    return dedicatedRoute(companyId, runId);
  }

  // Fall back to generic report route
  return getGenericReportRoute(companyId, normalizedToolId, runId);
}

/**
 * Alias for getPrimaryRunViewHref for backwards compatibility
 * @deprecated Use getPrimaryRunViewHref instead
 */
export const getRunViewHref = getPrimaryRunViewHref;

/**
 * Get the hub/launcher URL for a diagnostic tool (not a specific run)
 *
 * This is where users go to run a new diagnostic, not view results.
 */
export function getToolHubHref(companyId: string, toolId: DiagnosticToolId): string {
  const slug = toolId.replace(/Lab$/, '').toLowerCase();
  return `/c/${companyId}/diagnostics/${slug}`;
}

/**
 * Check if a tool has a dedicated view page
 */
export function hasDedicatedViewPage(toolId: DiagnosticToolId): boolean {
  return toolId in DEDICATED_VIEW_ROUTES;
}
