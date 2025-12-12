// lib/types/mediaAnalytics.ts
// Media Analytics types for the unified Analytics layer
//
// These types support the Media Lab and reporting features for companies
// with active media programs (like Car Toys).

/**
 * Media program health status
 */
export type MediaProgramHealth = 'good' | 'neutral' | 'at_risk';

/**
 * Media campaign status
 */
export type MediaCampaignStatus = 'enabled' | 'paused' | 'removed';

/**
 * Media network/platform
 */
export type MediaNetwork = 'google' | 'meta' | 'microsoft' | 'tiktok' | 'other';

/**
 * Company Media Program Summary - high-level view of a company's media program
 *
 * This is used by Company Overview and QBR reports to show a quick snapshot
 * of media program status without loading all campaign details.
 */
export interface CompanyMediaProgramSummary {
  companyId: string;

  /** Whether the company has an active media program with Hive */
  hasMediaProgram: boolean;

  /** Primary KPIs for the media program */
  primaryKpis?: {
    /** Total media spend (typically last 30 days) */
    mediaSpend?: number;
    /** Cost per lead */
    cpl?: number;
    /** Return on ad spend */
    roas?: number;
    /** Total installs or leads generated */
    installsOrLeads?: number;
    /** Total calls */
    calls?: number;
    /** Total impressions */
    impressions?: number;
  };

  /** Overall program health assessment */
  programHealth?: MediaProgramHealth;

  /** Human-readable status message */
  programStatusMessage?: string;

  /** Number of active campaigns */
  activeCampaignCount?: number;

  /** Number of markets covered */
  marketCount?: number;

  /** Number of stores covered */
  storeCount?: number;

  /** Total monthly budget */
  totalMonthlyBudget?: number;

  /** Primary channels in use */
  primaryChannels?: string[];

  /** When this summary was computed (ISO) */
  updatedAt: string;
}

/**
 * Media Campaign Performance - individual campaign metrics
 *
 * Used by Media Lab to show detailed campaign-level reporting.
 */
export interface MediaCampaignPerformance {
  /** Campaign ID (from ad platform or internal) */
  campaignId: string;

  /** Ad network/platform */
  network: MediaNetwork;

  /** Campaign name */
  name: string;

  /** Campaign status */
  status: MediaCampaignStatus;

  /** Market or region this campaign targets */
  market?: string;

  // =========================================================================
  // Spend & Volume Metrics
  // =========================================================================

  /** Total spend in the period */
  spend?: number;

  /** Total impressions */
  impressions?: number;

  /** Total clicks */
  clicks?: number;

  /** Total conversions (leads, installs, etc.) */
  conversions?: number;

  /** Total calls */
  calls?: number;

  // =========================================================================
  // Derived Metrics
  // =========================================================================

  /** Click-through rate (clicks / impressions) */
  ctr?: number;

  /** Cost per click */
  cpc?: number;

  /** Cost per lead/conversion */
  cpl?: number;

  /** Return on ad spend */
  roas?: number;

  /** Conversion rate (conversions / clicks) */
  conversionRate?: number;
}

/**
 * Get display label for program health
 */
export function getProgramHealthLabel(health: MediaProgramHealth | undefined): string {
  if (!health) return 'Unknown';
  const labels: Record<MediaProgramHealth, string> = {
    good: 'Performing Well',
    neutral: 'Stable',
    at_risk: 'Needs Attention',
  };
  return labels[health] || 'Unknown';
}

/**
 * Get color classes for program health badge
 */
export function getProgramHealthColorClasses(health: MediaProgramHealth | undefined): string {
  if (!health) return 'bg-slate-500/10 text-slate-400 border-slate-500/30';
  const colors: Record<MediaProgramHealth, string> = {
    good: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    neutral: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    at_risk: 'bg-red-500/10 text-red-400 border-red-500/30',
  };
  return colors[health] || 'bg-slate-500/10 text-slate-400 border-slate-500/30';
}

/**
 * Get display label for media network
 */
export function getMediaNetworkLabel(network: MediaNetwork): string {
  const labels: Record<MediaNetwork, string> = {
    google: 'Google Ads',
    meta: 'Meta Ads',
    microsoft: 'Microsoft Ads',
    tiktok: 'TikTok Ads',
    other: 'Other',
  };
  return labels[network] || network;
}

/**
 * Get display label for campaign status
 */
export function getCampaignStatusLabel(status: MediaCampaignStatus): string {
  const labels: Record<MediaCampaignStatus, string> = {
    enabled: 'Active',
    paused: 'Paused',
    removed: 'Removed',
  };
  return labels[status] || status;
}

/**
 * Get color classes for campaign status badge
 */
export function getCampaignStatusColorClasses(status: MediaCampaignStatus): string {
  const colors: Record<MediaCampaignStatus, string> = {
    enabled: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    paused: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    removed: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
  };
  return colors[status] || 'bg-slate-500/10 text-slate-400 border-slate-500/30';
}
