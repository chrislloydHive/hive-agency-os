// lib/media-lab/types.ts
// Media Lab V1 - Type definitions for media planning and channel management

// ============================================================================
// Channel & Objective Types
// ============================================================================

export type MediaChannelKey =
  | 'google_search'
  | 'google_lsas'
  | 'google_maps_gbp'
  | 'paid_social_meta'
  | 'display_retarg'
  | 'radio'
  | 'other';

export type MediaPlanStatus =
  | 'draft'
  | 'proposed'
  | 'active'
  | 'paused'
  | 'archived';

export type MediaObjective =
  | 'installs'
  | 'leads'
  | 'store_visits'
  | 'calls'
  | 'awareness';

export type MediaSeason =
  | 'remote_start'
  | 'holiday'
  | 'carplay_season'
  | 'summer_audio'
  | 'other';

export type MediaStatus = 'none' | 'planning' | 'running' | 'paused';

export type MediaChannelPriority = 'core' | 'supporting' | 'experimental';

// ============================================================================
// Core Domain Models
// ============================================================================

/**
 * Media Plan - Top-level strategic plan for a company's media program
 */
export interface MediaPlan {
  id: string;
  companyId: string;
  name: string;
  status: MediaPlanStatus;
  objective: MediaObjective;
  timeframeStart: string | null;
  timeframeEnd: string | null;
  totalBudget: number | null;
  primaryMarkets: string | null;
  hasSeasonalFlights: boolean;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Media Plan Channel - Channel-specific budget and targeting within a plan
 */
export interface MediaPlanChannel {
  id: string;
  mediaPlanId: string;
  channel: MediaChannelKey;
  budgetSharePct: number | null;
  budgetAmount: number | null;
  expectedVolume: number | null; // installs / leads
  expectedCpl: number | null; // expected cost per lead/install
  priority: MediaChannelPriority | null;
  notes?: string | null;
}

/**
 * Media Plan Flight - Seasonal/promotional campaign periods within a plan
 */
export interface MediaPlanFlight {
  id: string;
  mediaPlanId: string;
  name: string;
  season: MediaSeason | null;
  startDate: string | null;
  endDate: string | null;
  budget: number | null;
  primaryChannels: MediaChannelKey[];
  marketsStores?: string | null;
  notes?: string | null;
}

// ============================================================================
// Summary & Aggregate Types
// ============================================================================

/**
 * Media Lab Summary - High-level overview of a company's media program
 */
export interface MediaLabSummary {
  hasMediaProgram: boolean;
  mediaStatus: MediaStatus;
  primaryObjective?: MediaObjective | null;
  primaryMarkets?: string | null;
  totalActiveBudget?: number | null;
  activePlanCount: number;
}

/**
 * Full Media Lab data for a company
 */
export interface MediaLabData {
  summary: MediaLabSummary;
  plans: Array<{
    plan: MediaPlan;
    channels: MediaPlanChannel[];
    flights: MediaPlanFlight[];
  }>;
}

// ============================================================================
// Display Helpers
// ============================================================================

export const MEDIA_CHANNEL_LABELS: Record<MediaChannelKey, string> = {
  google_search: 'Google Search',
  google_lsas: 'Google LSAs',
  google_maps_gbp: 'Google Maps / GBP',
  paid_social_meta: 'Paid Social (Meta)',
  display_retarg: 'Display Retargeting',
  radio: 'Radio',
  other: 'Other',
};

export const MEDIA_OBJECTIVE_LABELS: Record<MediaObjective, string> = {
  installs: 'Installs',
  leads: 'Leads',
  store_visits: 'Store Visits',
  calls: 'Calls',
  awareness: 'Awareness',
};

export const MEDIA_SEASON_LABELS: Record<MediaSeason, string> = {
  remote_start: 'Remote Start Season',
  holiday: 'Holiday',
  carplay_season: 'CarPlay Season',
  summer_audio: 'Summer Audio',
  other: 'Other',
};

export const MEDIA_STATUS_LABELS: Record<MediaStatus, string> = {
  none: 'None',
  planning: 'Planning',
  running: 'Running',
  paused: 'Paused',
};

export const MEDIA_PLAN_STATUS_LABELS: Record<MediaPlanStatus, string> = {
  draft: 'Draft',
  proposed: 'Proposed',
  active: 'Active',
  paused: 'Paused',
  archived: 'Archived',
};
