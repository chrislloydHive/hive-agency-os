// lib/reports/store.ts
// Report Storage - In-memory store for reports (can be extended to Airtable/Postgres)
//
// For now, uses a simple in-memory cache. Reports are also stored in the QBR system
// for backwards compatibility.

import type { CompanyReport, ReportType, ReportListItem, ReportMeta } from './types';
import { createEmptyReport } from './types';

// ============================================================================
// In-Memory Store (temporary - will be replaced with Airtable)
// ============================================================================

const reportStore = new Map<string, CompanyReport>();

function getStoreKey(companyId: string, type: ReportType, period?: string): string {
  return `${companyId}:${type}:${period || 'latest'}`;
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Get the latest report of a given type for a company
 */
export async function getLatestReportByType(
  companyId: string,
  type: ReportType
): Promise<ReportListItem | null> {
  // For now, check the in-memory store
  const stored = Array.from(reportStore.values())
    .filter(r => r.meta.companyId === companyId && r.meta.type === type)
    .sort((a, b) => new Date(b.meta.createdAt).getTime() - new Date(a.meta.createdAt).getTime());

  const latest = stored[0];
  if (!latest) return null;

  return {
    id: latest.meta.id,
    companyId: latest.meta.companyId,
    type: latest.meta.type,
    title: latest.meta.title,
    period: latest.meta.period,
    createdAt: latest.meta.createdAt,
    status: latest.meta.status,
    version: latest.meta.version,
  };
}

/**
 * Get a report by ID
 */
export async function getReportById(reportId: string): Promise<CompanyReport | null> {
  for (const report of reportStore.values()) {
    if (report.meta.id === reportId) {
      return report;
    }
  }
  return null;
}

/**
 * Get a report by company, type, and period
 */
export async function getReport(
  companyId: string,
  type: ReportType,
  period?: string
): Promise<CompanyReport | null> {
  const key = getStoreKey(companyId, type, period);
  return reportStore.get(key) || null;
}

/**
 * Save a report
 */
export async function saveReport(report: CompanyReport): Promise<void> {
  const key = getStoreKey(report.meta.companyId, report.meta.type, report.meta.period);
  reportStore.set(key, report);
}

/**
 * List all reports for a company
 */
export async function listReports(companyId: string): Promise<ReportListItem[]> {
  return Array.from(reportStore.values())
    .filter(r => r.meta.companyId === companyId)
    .sort((a, b) => new Date(b.meta.createdAt).getTime() - new Date(a.meta.createdAt).getTime())
    .map(r => ({
      id: r.meta.id,
      companyId: r.meta.companyId,
      type: r.meta.type,
      title: r.meta.title,
      period: r.meta.period,
      createdAt: r.meta.createdAt,
      status: r.meta.status,
      version: r.meta.version,
    }));
}

/**
 * Delete a report
 */
export async function deleteReport(reportId: string): Promise<boolean> {
  for (const [key, report] of reportStore.entries()) {
    if (report.meta.id === reportId) {
      reportStore.delete(key);
      return true;
    }
  }
  return false;
}
