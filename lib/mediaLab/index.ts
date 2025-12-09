// lib/mediaLab/index.ts
// Media Lab Service
//
// High-level service functions for Media Lab that aggregate data
// from Airtable helpers and company records.

import { getCompanyById, type CompanyRecord } from '@/lib/airtable/companies';
import {
  getMediaPlansWithDetailsForCompany,
  getActiveMediaPlansForCompany,
  createDraftMediaPlan,
} from '@/lib/airtable/mediaLab';
import {
  type MediaLabData,
  type MediaLabSummary,
  type MediaPlanWithDetails,
  type CompanyMediaStatus,
  type MediaObjective,
  calculateTotalActiveBudget,
} from '@/lib/types/mediaLab';

// Re-export types for convenience
export type { MediaLabSummary, MediaLabData, MediaPlanWithDetails };

// ============================================================================
// Main Service Functions
// ============================================================================

/**
 * Get complete Media Lab data for a company
 *
 * Returns:
 * - summary: MediaLabSummary for Blueprint/Dashboard integration
 * - plans: All MediaPlans with their channels and flights
 */
export async function getMediaLabForCompany(companyId: string): Promise<MediaLabData> {
  // Fetch plans with all details
  const plans = await getMediaPlansWithDetailsForCompany(companyId);

  // Build summary
  const activePlans = plans.filter(p => p.status === 'active');
  const totalActiveBudget = calculateTotalActiveBudget(plans as any);

  // Determine primary objective (from first active plan, or first plan)
  const representativePlan = activePlans[0] || plans[0];
  const primaryObjective: MediaObjective | null = representativePlan?.objective || null;
  const primaryMarkets: string | null = representativePlan?.primaryMarkets || null;

  // Determine media status
  let mediaStatus: CompanyMediaStatus = 'none';
  if (activePlans.length > 0) {
    mediaStatus = 'running';
  } else if (plans.some(p => p.status === 'proposed' || p.status === 'draft')) {
    mediaStatus = 'planning';
  } else if (plans.some(p => p.status === 'paused')) {
    mediaStatus = 'paused';
  }

  const summary: MediaLabSummary = {
    hasMediaProgram: plans.length > 0 || mediaStatus !== 'none',
    mediaStatus,
    primaryObjective,
    primaryMarkets,
    totalActiveBudget: totalActiveBudget > 0 ? totalActiveBudget : null,
    activePlanCount: activePlans.length,
  };

  return {
    summary,
    plans: plans as any,
  };
}

/**
 * Get just the Media Lab summary for a company
 * (lighter weight for Blueprint/Dashboard)
 */
export async function getMediaLabSummary(companyId: string): Promise<MediaLabSummary> {
  const { summary } = await getMediaLabForCompany(companyId);
  return summary;
}

/**
 * Check if a company has any media lab data
 */
export async function companyHasMediaLab(companyId: string): Promise<boolean> {
  const plans = await getActiveMediaPlansForCompany(companyId);
  return plans.length > 0;
}

/**
 * Initialize Media Lab for a company
 * Creates a draft plan and updates company media status
 *
 * @returns The created draft plan, or null if creation failed
 */
export async function initializeMediaLabForCompany(
  companyId: string,
  planName?: string
): Promise<MediaPlanWithDetails | null> {
  // Create a draft plan
  const plan = await createDraftMediaPlan(
    companyId,
    { name: planName || 'Initial Media Plan' }
  );

  if (!plan) {
    console.error(`[MediaLab] Failed to initialize media lab for company ${companyId}`);
    return null;
  }

  // Return plan with empty channels/flights
  return {
    ...plan,
    channels: [],
    flights: [],
  } as any;
}

// ============================================================================
// Helper Functions for UI
// ============================================================================

/**
 * Get the "active" or "primary" plan for display
 * Prefers active plans, then proposed, then most recent
 */
export function getPrimaryPlan(plans: MediaPlanWithDetails[]): MediaPlanWithDetails | null {
  if (plans.length === 0) return null;

  // Priority order: active > proposed > draft > paused > archived
  const statusPriority: Record<string, number> = {
    active: 1,
    proposed: 2,
    draft: 3,
    paused: 4,
    archived: 5,
  };

  const sorted = [...plans].sort((a, b) => {
    const priorityDiff = (statusPriority[a.status] || 99) - (statusPriority[b.status] || 99);
    if (priorityDiff !== 0) return priorityDiff;
    // If same priority, sort by created date (most recent first)
    return (b.createdAt || '').localeCompare(a.createdAt || '');
  });

  return sorted[0];
}

/**
 * Calculate channel budget summary for a plan
 */
export function getChannelBudgetSummary(plan: MediaPlanWithDetails): {
  totalAllocated: number;
  remainingBudget: number;
  allocationPercent: number;
} {
  const totalBudget = plan.totalBudget || 0;
  const totalAllocated = plan.channels.reduce(
    (sum, ch) => sum + (ch.budgetAmount || 0),
    0
  );

  return {
    totalAllocated,
    remainingBudget: Math.max(0, totalBudget - totalAllocated),
    allocationPercent: totalBudget > 0 ? Math.round((totalAllocated / totalBudget) * 100) : 0,
  };
}

/**
 * Get upcoming flights (starts in the future or currently active)
 */
export function getUpcomingFlights(plan: MediaPlanWithDetails): MediaPlanWithDetails['flights'] {
  const now = new Date();
  return plan.flights.filter(flight => {
    if (!flight.endDate) return true; // No end date = still relevant
    return new Date(flight.endDate) >= now;
  });
}

/**
 * Get the current/next flight based on dates
 */
export function getCurrentOrNextFlight(plan: MediaPlanWithDetails): MediaPlanWithDetails['flights'][0] | null {
  const now = new Date();
  const upcoming = getUpcomingFlights(plan);

  // Find currently active flight
  const active = upcoming.find(f => {
    if (!f.startDate) return false;
    const start = new Date(f.startDate);
    const end = f.endDate ? new Date(f.endDate) : new Date(9999, 11, 31);
    return start <= now && now <= end;
  });

  if (active) return active;

  // Find next upcoming flight
  const future = upcoming
    .filter(f => f.startDate && new Date(f.startDate) > now)
    .sort((a, b) => (a.startDate || '').localeCompare(b.startDate || ''));

  return future[0] || null;
}
