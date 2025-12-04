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
  COMPANY_AI_CONTEXT: 'Company AI Context', // Client Brain - AI memory per company
  DIAGNOSTIC_RUNS: 'Diagnostic Runs', // Tool runs for diagnostics suite

  // Client Brain Tables
  CLIENT_INSIGHTS: 'Client Insights', // Strategic insights per company
  CLIENT_DOCUMENTS: 'Client Documents', // Uploaded documents per company
  COMPANY_STRATEGY_SNAPSHOTS: 'Company Strategy Snapshots', // Strategic snapshot per company

  // Workspace Settings
  WORKSPACE_SETTINGS: 'WorkspaceSettings', // OAuth tokens and workspace config

  // Media System Tables
  MEDIA_PROGRAMS: 'Media Programs',
  MEDIA_CAMPAIGNS: 'Media Campaigns',
  MEDIA_MARKETS: 'Media Markets',
  MEDIA_STORES: 'Media Stores',
  MEDIA_PERFORMANCE: 'Media Performance',

  // Media Lab Tables (Strategic Planning)
  MEDIA_PLANS: 'MediaPlans',
  MEDIA_PLAN_CHANNELS: 'MediaPlanChannels',
  MEDIA_PLAN_FLIGHTS: 'MediaPlanFlights',
  MEDIA_SCENARIOS: 'MediaScenarios',
  MEDIA_PROFILES: 'MediaProfiles', // Company-specific media configuration

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
