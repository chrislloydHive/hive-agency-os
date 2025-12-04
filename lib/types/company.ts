// lib/types/company.ts
// Shared Company types and constants for client and server use
// This file should NOT import any server-only code (Airtable, etc.)

// ============================================================================
// Setup & QBR Status Types
// ============================================================================

/**
 * Setup Status - tracks the state of Strategic Setup Mode for a company
 * - "not_started": Company has never completed setup (default)
 * - "in_progress": Company has started but not finalized setup
 * - "completed": Company has completed the full setup wizard
 */
export type SetupStatus = 'not_started' | 'in_progress' | 'completed';

/**
 * Get display configuration for SetupStatus
 */
export const SETUP_STATUS_CONFIG: Record<SetupStatus, { label: string; color: string }> = {
  not_started: { label: 'Not started', color: 'gray' },
  in_progress: { label: 'In progress', color: 'yellow' },
  completed: { label: 'Completed', color: 'green' },
};

/**
 * Safely parse a setup status value, defaulting to 'not_started'
 */
export function parseSetupStatus(value: string | undefined | null): SetupStatus {
  if (value === 'in_progress' || value === 'completed') {
    return value;
  }
  return 'not_started';
}

/**
 * Get quarter string from a date (e.g., "Q1 2024")
 */
export function getQuarterFromDate(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  try {
    const date = new Date(dateStr);
    const quarter = Math.ceil((date.getMonth() + 1) / 3);
    const year = date.getFullYear();
    return `Q${quarter} ${year}`;
  } catch {
    return null;
  }
}

// ============================================================================
// Media Program Status Types
// ============================================================================

/**
 * Media Program Status - indicates whether a company has an active media program
 * - "none": No media program active (default)
 * - "active": Company has an active performance media program
 */
export type MediaProgramStatus = 'none' | 'active';

/**
 * Check if a MediaProgramStatus indicates an active program
 */
export function isMediaProgramActive(status: MediaProgramStatus | undefined | null): boolean {
  return status === 'active';
}

// ============================================================================
// Company Stage Types & Utilities
// ============================================================================

/**
 * Company stage slug type (lowercase, URL-safe)
 */
export type CompanyStage = 'prospect' | 'client' | 'internal' | 'dormant' | 'lost';

/**
 * Map Airtable stage label to slug
 */
export const stageLabelToSlug: Record<string, CompanyStage> = {
  'Prospect': 'prospect',
  'Client': 'client',
  'Internal': 'internal',
  'Dormant': 'dormant',
  'Lost': 'lost',
};

/**
 * Map slug to Airtable stage label
 */
export const stageSlugToLabel: Record<CompanyStage, string> = {
  'prospect': 'Prospect',
  'client': 'Client',
  'internal': 'Internal',
  'dormant': 'Dormant',
  'lost': 'Lost',
};

/**
 * All stage options for filter UI
 */
export const COMPANY_STAGE_OPTIONS: { slug: CompanyStage; label: string }[] = [
  { slug: 'prospect', label: 'Prospects' },
  { slug: 'client', label: 'Clients' },
  { slug: 'internal', label: 'Internal' },
  { slug: 'dormant', label: 'Dormant' },
  { slug: 'lost', label: 'Lost' },
];

/**
 * Convert Airtable stage label to slug
 */
export function parseCompanyStage(label: string | undefined | null): CompanyStage | undefined {
  if (!label) return undefined;
  return stageLabelToSlug[label] ?? undefined;
}

/**
 * Get display label for a stage
 */
export function getStageLabel(stage: CompanyStage | undefined): string {
  if (!stage) return 'Unknown';
  return stageSlugToLabel[stage] || 'Unknown';
}

