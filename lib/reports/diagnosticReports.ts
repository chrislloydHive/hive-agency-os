// lib/reports/diagnosticReports.ts
// Diagnostic Reports abstraction layer (SERVER-SIDE)
//
// Provides a unified interface for viewing Lab and GAP diagnostic reports.
// Sources data from Diagnostic Runs table (and legacy GAP-IA Runs for backwards compat).
//
// NOTE: This file contains server-side code (Airtable access).
// For client components, import from '@/lib/reports/diagnosticReports.shared' instead.

import {
  listDiagnosticRunsForCompany,
  getDiagnosticRun,
  getToolLabel,
  type DiagnosticRun,
  type DiagnosticRunStatus,
  type DiagnosticToolId,
} from '@/lib/os/diagnostics/runs';

// Import types for internal use
import {
  type ReportKind,
  type ReportStatus,
  type ReportListItem,
  type ReportDetail,
  type ReportListOptions,
} from './diagnosticReports.shared';

// Re-export types and display helpers from shared module
export {
  type ReportKind,
  type ReportStatus,
  type ReportListItem,
  type ReportDetail,
  type ReportListOptions,
  getKindLabel,
  getStatusColor,
  getKindColor,
  formatDuration,
  formatScore,
} from './diagnosticReports.shared';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Map DiagnosticToolId to ReportKind
 */
function getReportKind(toolId: DiagnosticToolId): ReportKind {
  switch (toolId) {
    case 'gapSnapshot':
      return 'gap_ia';
    case 'gapPlan':
    case 'gapHeavy':
      return 'gap_full';
    default:
      return 'lab';
  }
}

/**
 * Map DiagnosticToolId to labKey (for filtering)
 */
function getLabKey(toolId: DiagnosticToolId): string | undefined {
  const mapping: Partial<Record<DiagnosticToolId, string>> = {
    websiteLab: 'website',
    brandLab: 'brand',
    audienceLab: 'audience',
    mediaLab: 'media',
    contentLab: 'content',
    seoLab: 'seo',
    demandLab: 'demand',
    opsLab: 'ops',
    creativeLab: 'creative',
    competitorLab: 'competitor',
    competitionLab: 'competition',
    gapSnapshot: 'gap_ia',
    gapPlan: 'gap_full',
    gapHeavy: 'gap_full',
  };
  return mapping[toolId];
}

/**
 * Map DiagnosticRunStatus to ReportStatus
 */
function mapStatus(status: DiagnosticRunStatus): ReportStatus {
  return status as ReportStatus;
}

/**
 * Extract duration from metadata or rawJson if available
 */
function extractDuration(run: DiagnosticRun): number | null {
  // Check metadata first
  if (run.metadata?.durationMs && typeof run.metadata.durationMs === 'number') {
    return run.metadata.durationMs;
  }

  // Try to extract from rawJson if it follows LabOutput contract
  if (run.rawJson && typeof run.rawJson === 'object') {
    const raw = run.rawJson as Record<string, unknown>;

    // Check meta.durationMs (LabOutput contract)
    if (raw.meta && typeof raw.meta === 'object') {
      const meta = raw.meta as Record<string, unknown>;
      if (typeof meta.durationMs === 'number') {
        return meta.durationMs;
      }
    }

    // Check durationMs at root level
    if (typeof raw.durationMs === 'number') {
      return raw.durationMs;
    }
  }

  return null;
}

/**
 * Convert DiagnosticRun to ReportListItem
 */
function toReportListItem(run: DiagnosticRun): ReportListItem {
  return {
    id: run.id,
    kind: getReportKind(run.toolId),
    title: getToolLabel(run.toolId),
    labKey: getLabKey(run.toolId),
    toolId: run.toolId,
    createdAt: run.createdAt,
    status: mapStatus(run.status),
    score: run.score,
    summary: run.summary,
    durationMs: extractDuration(run),
  };
}

/**
 * Convert DiagnosticRun to ReportDetail
 */
function toReportDetail(run: DiagnosticRun): ReportDetail {
  return {
    ...toReportListItem(run),
    data: run.rawJson ?? {},
    metadata: run.metadata,
    updatedAt: run.updatedAt,
  };
}

// ============================================================================
// Public API
// ============================================================================

/**
 * List all reports for a company
 *
 * @param companyId - Company ID
 * @param options - Filter options
 * @returns List of report items, sorted by createdAt desc
 */
export async function listCompanyReports(
  companyId: string,
  options?: ReportListOptions
): Promise<ReportListItem[]> {
  console.log('[DiagnosticReports] Listing reports for company:', { companyId, options });

  // Fetch all diagnostic runs
  const runs = await listDiagnosticRunsForCompany(companyId, {
    limit: options?.limit || 100,
    status: options?.status as DiagnosticRunStatus | undefined,
  });

  // Convert to report items
  let items = runs.map(toReportListItem);

  // Apply filters
  if (options?.kind) {
    items = items.filter((item) => item.kind === options.kind);
  }

  if (options?.labKey) {
    items = items.filter((item) => item.labKey === options.labKey);
  }

  // Sort by createdAt desc (most recent first)
  items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  console.log('[DiagnosticReports] Found reports:', {
    count: items.length,
    companyId,
  });

  return items;
}

/**
 * Get a single report by ID
 *
 * @param companyId - Company ID (for validation)
 * @param reportId - Report/Run ID
 * @returns Full report detail or null if not found
 */
export async function getCompanyReport(
  companyId: string,
  reportId: string
): Promise<ReportDetail | null> {
  console.log('[DiagnosticReports] Getting report:', { companyId, reportId });

  const run = await getDiagnosticRun(reportId);

  if (!run) {
    console.log('[DiagnosticReports] Report not found:', reportId);
    return null;
  }

  // Validate company ID matches
  if (run.companyId !== companyId) {
    console.warn('[DiagnosticReports] Company ID mismatch:', {
      expected: companyId,
      actual: run.companyId,
    });
    return null;
  }

  return toReportDetail(run);
}

/**
 * Get the latest report for a specific lab/tool
 *
 * @param companyId - Company ID
 * @param toolId - Tool ID (e.g., 'brandLab', 'websiteLab')
 * @returns Latest report or null
 */
export async function getLatestReportForTool(
  companyId: string,
  toolId: DiagnosticToolId
): Promise<ReportDetail | null> {
  console.log('[DiagnosticReports] Getting latest report for tool:', { companyId, toolId });

  const runs = await listDiagnosticRunsForCompany(companyId, {
    toolId,
    limit: 1,
  });

  if (runs.length === 0) {
    return null;
  }

  return toReportDetail(runs[0]);
}

/**
 * Get reports grouped by kind
 *
 * @param companyId - Company ID
 * @returns Reports grouped by kind (lab, gap_ia, gap_full)
 */
export async function getReportsGroupedByKind(
  companyId: string
): Promise<Record<ReportKind, ReportListItem[]>> {
  const items = await listCompanyReports(companyId);

  const grouped: Record<ReportKind, ReportListItem[]> = {
    lab: [],
    gap_ia: [],
    gap_full: [],
  };

  for (const item of items) {
    grouped[item.kind].push(item);
  }

  return grouped;
}

// Display helpers are exported from './diagnosticReports.shared'
