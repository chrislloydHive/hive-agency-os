// lib/reports/diagnosticReports.shared.ts
// Client-safe types and display helpers for diagnostic reports
//
// This module can be safely imported from client components.
// Server-side data fetching functions are in diagnosticReports.ts

// ============================================================================
// Types
// ============================================================================

/**
 * Report kind classification
 */
export type ReportKind = 'lab' | 'gap_ia' | 'gap_full';

/**
 * Report status (mirrors DiagnosticRunStatus)
 */
export type ReportStatus = 'running' | 'complete' | 'failed' | 'pending';

/**
 * List item for reports table/list
 */
export interface ReportListItem {
  id: string;
  kind: ReportKind;
  title: string;
  labKey?: string;
  toolId: string; // DiagnosticToolId but as string for client compatibility
  createdAt: string;
  status: ReportStatus;
  score?: number | null;
  summary?: string | null;
  durationMs?: number | null;
}

/**
 * Full report detail (includes raw data)
 */
export interface ReportDetail extends ReportListItem {
  data: unknown; // Raw JSON payload from Diagnostic Run
  metadata?: Record<string, unknown> | null;
  updatedAt: string;
}

/**
 * Filter options for listing reports
 */
export interface ReportListOptions {
  kind?: ReportKind;
  status?: ReportStatus;
  labKey?: string;
  limit?: number;
}

// ============================================================================
// Display Helpers
// ============================================================================

/**
 * Get human-readable kind label
 */
export function getKindLabel(kind: ReportKind): string {
  const labels: Record<ReportKind, string> = {
    lab: 'Lab',
    gap_ia: 'GAP IA',
    gap_full: 'GAP Full',
  };
  return labels[kind];
}

/**
 * Get status badge color
 */
export function getStatusColor(status: ReportStatus): string {
  const colors: Record<ReportStatus, string> = {
    pending: 'bg-slate-600/20 text-slate-400',
    running: 'bg-amber-600/20 text-amber-400',
    complete: 'bg-emerald-600/20 text-emerald-400',
    failed: 'bg-red-600/20 text-red-400',
  };
  return colors[status];
}

/**
 * Get kind badge color
 */
export function getKindColor(kind: ReportKind): string {
  const colors: Record<ReportKind, string> = {
    lab: 'bg-blue-600/20 text-blue-400',
    gap_ia: 'bg-purple-600/20 text-purple-400',
    gap_full: 'bg-purple-600/20 text-purple-400',
  };
  return colors[kind];
}

/**
 * Format duration for display
 */
export function formatDuration(durationMs: number | null | undefined): string {
  if (!durationMs) return '-';

  const seconds = Math.round(durationMs / 1000);
  if (seconds < 60) {
    return `${seconds}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

/**
 * Format score for display
 */
export function formatScore(score: number | null | undefined): string {
  if (score === null || score === undefined) return '-';
  return `${Math.round(score)}`;
}
