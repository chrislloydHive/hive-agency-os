// lib/airtable/tables.ts
// Central Airtable table name constants

/**
 * Canonical Airtable table names for the Hive OS / GAP Engine system
 */
export const AIRTABLE_TABLES = {
  // GAP System Tables
  GAP_IA_RUN: 'GAP-IA Run', // Initial Assessment Run (lead magnet)
  GAP_PLAN_RUN: 'GAP-Plan Run', // Execution run of the full GAP engine
  GAP_FULL_REPORT: 'GAP-Full Report', // Final structured GAP report
  GAP_HEAVY_RUN: 'GAP-Heavy Run', // Background worker runs

  // OS System Tables
  COMPANIES: 'Companies',
  WORK_ITEMS: 'Work Items',

  // Legacy/deprecated (for migration reference)
  // GAP_RUNS_OLD: 'GAP Runs',
  // FULL_REPORTS_OLD: 'Full Reports',
} as const;

/**
 * Get table name from environment variable or use default
 */
export function getTableName(
  key: keyof typeof AIRTABLE_TABLES,
  envVar?: string
): string {
  if (envVar && process.env[envVar]) {
    return process.env[envVar];
  }
  return AIRTABLE_TABLES[key];
}
