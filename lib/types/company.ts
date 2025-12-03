// lib/types/company.ts
// Shared Company types and constants for client and server use
// This file should NOT import any server-only code (Airtable, etc.)

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

