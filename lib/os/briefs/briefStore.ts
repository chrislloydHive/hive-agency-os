// lib/os/briefs/briefStore.ts
// Weekly Brief Storage - In-memory store for weekly briefs
//
// Provides CRUD operations for weekly briefs with:
// - Idempotent upsert by companyId + weekKey
// - Historical retrieval
// - Debug ID tracking
//
// In production, this would be persisted to Airtable or a database.

import type { WeeklyBrief } from '@/lib/types/weeklyBrief';

// ============================================================================
// In-Memory Store
// ============================================================================

// Primary store: id -> brief
const briefStore = new Map<string, WeeklyBrief>();

// Index: companyId -> Set<briefId>
const briefsByCompany = new Map<string, Set<string>>();

// Index: companyId:weekKey -> briefId (for idempotent upsert)
const briefByCompanyWeek = new Map<string, string>();

// ============================================================================
// Helper Functions
// ============================================================================

function getCompanyWeekKey(companyId: string, weekKey: string): string {
  return `${companyId}:${weekKey}`;
}

// ============================================================================
// CRUD Operations
// ============================================================================

/**
 * Save or update a weekly brief (idempotent by companyId + weekKey)
 */
export function upsertWeeklyBrief(brief: WeeklyBrief): WeeklyBrief {
  const companyWeekKey = getCompanyWeekKey(brief.companyId, brief.weekKey);
  const existingId = briefByCompanyWeek.get(companyWeekKey);

  // If there's an existing brief for this company/week, remove it first
  if (existingId && existingId !== brief.id) {
    briefStore.delete(existingId);
    const companyBriefs = briefsByCompany.get(brief.companyId);
    if (companyBriefs) {
      companyBriefs.delete(existingId);
    }
  }

  // Store the brief
  briefStore.set(brief.id, brief);

  // Index by company
  if (!briefsByCompany.has(brief.companyId)) {
    briefsByCompany.set(brief.companyId, new Set());
  }
  briefsByCompany.get(brief.companyId)!.add(brief.id);

  // Index by company + weekKey
  briefByCompanyWeek.set(companyWeekKey, brief.id);

  return brief;
}

/**
 * Get a brief by ID
 */
export function getBriefById(id: string): WeeklyBrief | null {
  return briefStore.get(id) || null;
}

/**
 * Get brief for a specific company and week
 */
export function getBriefByCompanyWeek(
  companyId: string,
  weekKey: string
): WeeklyBrief | null {
  const companyWeekKey = getCompanyWeekKey(companyId, weekKey);
  const briefId = briefByCompanyWeek.get(companyWeekKey);
  if (!briefId) return null;
  return briefStore.get(briefId) || null;
}

/**
 * Get the latest brief for a company
 */
export function getLatestBrief(companyId: string): WeeklyBrief | null {
  const briefIds = briefsByCompany.get(companyId);
  if (!briefIds || briefIds.size === 0) return null;

  // Get all briefs and sort by weekKey descending
  const briefs = Array.from(briefIds)
    .map(id => briefStore.get(id))
    .filter((b): b is WeeklyBrief => b !== undefined)
    .sort((a, b) => b.weekKey.localeCompare(a.weekKey));

  return briefs[0] || null;
}

/**
 * Get all briefs for a company (historical)
 */
export function getCompanyBriefs(
  companyId: string,
  options: { limit?: number } = {}
): WeeklyBrief[] {
  const { limit = 10 } = options;
  const briefIds = briefsByCompany.get(companyId);
  if (!briefIds || briefIds.size === 0) return [];

  const briefs = Array.from(briefIds)
    .map(id => briefStore.get(id))
    .filter((b): b is WeeklyBrief => b !== undefined)
    .sort((a, b) => b.weekKey.localeCompare(a.weekKey));

  return limit > 0 ? briefs.slice(0, limit) : briefs;
}

/**
 * Check if a brief exists for a company/week
 */
export function briefExists(companyId: string, weekKey: string): boolean {
  const companyWeekKey = getCompanyWeekKey(companyId, weekKey);
  return briefByCompanyWeek.has(companyWeekKey);
}

/**
 * Check if a company has any briefs
 */
export function hasHistory(companyId: string): boolean {
  const briefIds = briefsByCompany.get(companyId);
  return briefIds !== undefined && briefIds.size > 0;
}

/**
 * Delete a brief by ID
 */
export function deleteBrief(id: string): boolean {
  const brief = briefStore.get(id);
  if (!brief) return false;

  // Remove from primary store
  briefStore.delete(id);

  // Remove from company index
  const companyBriefs = briefsByCompany.get(brief.companyId);
  if (companyBriefs) {
    companyBriefs.delete(id);
    if (companyBriefs.size === 0) {
      briefsByCompany.delete(brief.companyId);
    }
  }

  // Remove from company/week index
  const companyWeekKey = getCompanyWeekKey(brief.companyId, brief.weekKey);
  if (briefByCompanyWeek.get(companyWeekKey) === id) {
    briefByCompanyWeek.delete(companyWeekKey);
  }

  return true;
}

/**
 * Clear all briefs (for testing)
 */
export function clearBriefStore(): void {
  briefStore.clear();
  briefsByCompany.clear();
  briefByCompanyWeek.clear();
}

// ============================================================================
// Statistics
// ============================================================================

/**
 * Get store statistics
 */
export function getBriefStoreStats(): {
  totalBriefs: number;
  companiesWithBriefs: number;
} {
  return {
    totalBriefs: briefStore.size,
    companiesWithBriefs: briefsByCompany.size,
  };
}
