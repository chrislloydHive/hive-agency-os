// lib/types/mediaLab.ts
// TypeScript types for the Media Lab module
//
// Media Lab is for strategic planning of media programs:
// - MediaPlans: High-level plans with objectives, budget, timeframe
// - MediaPlanChannels: Channel mix and budget allocation
// - MediaPlanFlights: Seasonal campaign flights
//
// This is SEPARATE from the operational media module (lib/types/media.ts)
// which tracks active campaigns, stores, and performance data.
//
// INTEGRATION NOTE:
// - MediaChannelKey here maps to combinations of provider+channel from media.ts
// - Use MediaProvider and MediaChannel from media.ts for granular tracking
// - MediaChannelKey is for simplified planning UI, maps to provider+channel pairs

import type { MediaProvider, MediaDataSourceType, AttributionModel } from './media';

// ============================================================================
// Channel Keys (matches Airtable single select)
// Extended to support more providers and traditional media
// ============================================================================

export type MediaChannelKey =
  // Google ecosystem
  | 'google_search'
  | 'google_lsas'
  | 'google_maps_gbp'
  | 'google_youtube'
  | 'google_display'
  // Meta ecosystem
  | 'paid_social_meta'
  // Microsoft
  | 'microsoft_search'
  // Other digital
  | 'tiktok_social'
  | 'display_retarg'
  | 'email_marketing'
  | 'affiliate'
  // Traditional / offline
  | 'radio'
  | 'tv'
  | 'streaming_audio'
  | 'out_of_home'
  | 'print'
  | 'direct_mail'
  // Catch-all
  | 'other';

export const MEDIA_CHANNEL_LABELS: Record<MediaChannelKey, string> = {
  // Google ecosystem
  google_search: 'Google Search',
  google_lsas: 'Google LSAs',
  google_maps_gbp: 'Google Maps/GBP',
  google_youtube: 'YouTube Ads',
  google_display: 'Google Display',
  // Meta ecosystem
  paid_social_meta: 'Paid Social (Meta)',
  // Microsoft
  microsoft_search: 'Microsoft/Bing Search',
  // Other digital
  tiktok_social: 'TikTok Ads',
  display_retarg: 'Display/Retargeting',
  email_marketing: 'Email Marketing',
  affiliate: 'Affiliate',
  // Traditional / offline
  radio: 'Radio',
  tv: 'Television',
  streaming_audio: 'Streaming Audio',
  out_of_home: 'Out-of-Home (OOH)',
  print: 'Print',
  direct_mail: 'Direct Mail',
  // Catch-all
  other: 'Other',
};

export const MEDIA_CHANNEL_COLORS: Record<MediaChannelKey, { text: string; bg: string; border: string }> = {
  // Google ecosystem
  google_search: { text: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/30' },
  google_lsas: { text: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/30' },
  google_maps_gbp: { text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' },
  google_youtube: { text: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30' },
  google_display: { text: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/30' },
  // Meta ecosystem
  paid_social_meta: { text: 'text-pink-400', bg: 'bg-pink-500/10', border: 'border-pink-500/30' },
  // Microsoft
  microsoft_search: { text: 'text-sky-400', bg: 'bg-sky-500/10', border: 'border-sky-500/30' },
  // Other digital
  tiktok_social: { text: 'text-slate-100', bg: 'bg-slate-500/10', border: 'border-slate-500/30' },
  display_retarg: { text: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/30' },
  email_marketing: { text: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30' },
  affiliate: { text: 'text-lime-400', bg: 'bg-lime-500/10', border: 'border-lime-500/30' },
  // Traditional / offline
  radio: { text: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/30' },
  tv: { text: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/30' },
  streaming_audio: { text: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/30' },
  out_of_home: { text: 'text-teal-400', bg: 'bg-teal-500/10', border: 'border-teal-500/30' },
  print: { text: 'text-slate-400', bg: 'bg-slate-500/10', border: 'border-slate-500/30' },
  direct_mail: { text: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30' },
  // Catch-all
  other: { text: 'text-slate-400', bg: 'bg-slate-500/10', border: 'border-slate-500/30' },
};

/**
 * Channel category (digital vs traditional)
 */
export type MediaChannelCategory = 'digital' | 'traditional' | 'other';

/**
 * Get the category for a channel key
 */
export function getChannelCategory(channel: MediaChannelKey): MediaChannelCategory {
  const traditional: MediaChannelKey[] = ['radio', 'tv', 'streaming_audio', 'out_of_home', 'print', 'direct_mail'];
  if (traditional.includes(channel)) return 'traditional';
  if (channel === 'other') return 'other';
  return 'digital';
}

/**
 * Map MediaChannelKey to MediaProvider for granular tracking
 */
export function getProviderForChannelKey(channelKey: MediaChannelKey): MediaProvider {
  switch (channelKey) {
    case 'google_search':
    case 'google_display':
      return 'google_ads';
    case 'google_lsas':
      return 'lsa';
    case 'google_maps_gbp':
      return 'gbp';
    case 'google_youtube':
      return 'youtube_ads';
    case 'paid_social_meta':
      return 'meta_ads';
    case 'microsoft_search':
      return 'microsoft_ads';
    case 'tiktok_social':
      return 'tiktok_ads';
    case 'display_retarg':
      return 'dv360';
    case 'radio':
      return 'radio_vendor';
    case 'tv':
      return 'tv_vendor';
    case 'streaming_audio':
      return 'streaming_audio_vendor';
    case 'out_of_home':
      return 'ooh_vendor';
    case 'print':
      return 'print_vendor';
    case 'direct_mail':
      return 'direct_mail_vendor';
    default:
      return 'other';
  }
}

// ============================================================================
// Status Types
// ============================================================================

export type MediaPlanStatus =
  | 'draft'
  | 'proposed'
  | 'active'
  | 'paused'
  | 'archived';

export const MEDIA_PLAN_STATUS_CONFIG: Record<MediaPlanStatus, { label: string; color: string; bgColor: string; borderColor: string }> = {
  draft: { label: 'Draft', color: 'text-slate-400', bgColor: 'bg-slate-500/10', borderColor: 'border-slate-500/30' },
  proposed: { label: 'Proposed', color: 'text-blue-400', bgColor: 'bg-blue-500/10', borderColor: 'border-blue-500/30' },
  active: { label: 'Active', color: 'text-emerald-400', bgColor: 'bg-emerald-500/10', borderColor: 'border-emerald-500/30' },
  paused: { label: 'Paused', color: 'text-amber-400', bgColor: 'bg-amber-500/10', borderColor: 'border-amber-500/30' },
  archived: { label: 'Archived', color: 'text-slate-500', bgColor: 'bg-slate-600/10', borderColor: 'border-slate-600/30' },
};

// ============================================================================
// Objective Types
// ============================================================================

export type MediaObjective =
  | 'installs'
  | 'leads'
  | 'store_visits'
  | 'calls'
  | 'awareness';

export const MEDIA_OBJECTIVE_CONFIG: Record<MediaObjective, { label: string; color: string; icon: string }> = {
  installs: { label: 'Installs', color: 'text-emerald-400', icon: 'wrench' },
  leads: { label: 'Leads', color: 'text-blue-400', icon: 'user-plus' },
  store_visits: { label: 'Store Visits', color: 'text-purple-400', icon: 'map-pin' },
  calls: { label: 'Calls', color: 'text-amber-400', icon: 'phone' },
  awareness: { label: 'Awareness', color: 'text-cyan-400', icon: 'eye' },
};

// ============================================================================
// Priority Types
// ============================================================================

export type MediaChannelPriority = 'core' | 'supporting' | 'experimental';

export const MEDIA_PRIORITY_CONFIG: Record<MediaChannelPriority, { label: string; color: string }> = {
  core: { label: 'Core', color: 'text-emerald-400' },
  supporting: { label: 'Supporting', color: 'text-blue-400' },
  experimental: { label: 'Experimental', color: 'text-amber-400' },
};

// ============================================================================
// Season Types
// ============================================================================

export type MediaFlightSeason =
  | 'remote_start'
  | 'holiday'
  | 'carplay_season'
  | 'summer_audio'
  | 'other';

export const MEDIA_SEASON_CONFIG: Record<MediaFlightSeason, { label: string; color: string; months: string }> = {
  remote_start: { label: 'Remote Start Season', color: 'text-blue-400', months: 'Oct-Feb' },
  holiday: { label: 'Holiday', color: 'text-red-400', months: 'Nov-Dec' },
  carplay_season: { label: 'CarPlay Season', color: 'text-purple-400', months: 'Apr-Jun' },
  summer_audio: { label: 'Summer Audio', color: 'text-amber-400', months: 'May-Aug' },
  other: { label: 'Other', color: 'text-slate-400', months: 'Varies' },
};

// ============================================================================
// Company Media Status (for Companies table)
// ============================================================================

export type CompanyMediaStatus = 'none' | 'planning' | 'running' | 'paused';

export const COMPANY_MEDIA_STATUS_CONFIG: Record<CompanyMediaStatus, { label: string; color: string }> = {
  none: { label: 'No Media Program', color: 'text-slate-500' },
  planning: { label: 'Planning', color: 'text-blue-400' },
  running: { label: 'Running', color: 'text-emerald-400' },
  paused: { label: 'Paused', color: 'text-amber-400' },
};

// ============================================================================
// Core Data Types
// ============================================================================

/**
 * MediaPlan - Strategic media plan for a company
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
  notes: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

/**
 * MediaPlanChannel - Channel allocation within a media plan
 */
export interface MediaPlanChannel {
  id: string;
  mediaPlanId: string;
  channel: MediaChannelKey;
  // NEW: Provider/Data Source/Attribution fields (derived from channel or specified)
  provider?: MediaProvider;              // Derived from channel if not set
  dataSourceType?: MediaDataSourceType;  // How we'll get actuals data
  attributionModel?: AttributionModel;   // How conversions will be attributed
  // Budget allocation
  budgetSharePct: number | null; // 0-100
  budgetAmount: number | null;
  // Expected outcomes
  expectedVolume: number | null; // installs / leads
  expectedCpl: number | null;
  // Performance targets (NEW)
  targetCtr?: number | null;          // Target CTR (0-1)
  targetConversionRate?: number | null; // Target conversion rate (0-1)
  targetRoas?: number | null;         // Target ROAS
  // Priority and notes
  priority: MediaChannelPriority | null;
  notes: string | null;
}

/**
 * MediaPlanFlight status
 */
export type MediaFlightStatus = 'upcoming' | 'active' | 'completed' | 'paused' | 'cancelled';

export const MEDIA_FLIGHT_STATUS_CONFIG: Record<MediaFlightStatus, { label: string; color: string; bgColor: string }> = {
  upcoming: { label: 'Upcoming', color: 'text-blue-400', bgColor: 'bg-blue-500/10' },
  active: { label: 'Active', color: 'text-emerald-400', bgColor: 'bg-emerald-500/10' },
  completed: { label: 'Completed', color: 'text-slate-400', bgColor: 'bg-slate-500/10' },
  paused: { label: 'Paused', color: 'text-amber-400', bgColor: 'bg-amber-500/10' },
  cancelled: { label: 'Cancelled', color: 'text-red-400', bgColor: 'bg-red-500/10' },
};

/**
 * MediaPlanFlight - Seasonal campaign flight within a media plan
 */
export interface MediaPlanFlight {
  id: string;
  mediaPlanId: string;
  name: string;
  // NEW: Status tracking
  status?: MediaFlightStatus;         // upcoming | active | completed | paused | cancelled
  // Season and timing
  season: MediaFlightSeason | null;
  startDate: string | null;
  endDate: string | null;
  // Budget
  budget: number | null;
  // NEW: Actuals tracking
  actualBudgetSpent?: number | null;  // How much actually spent
  actualLeads?: number | null;        // Actual leads generated
  actualInstalls?: number | null;     // Actual installs
  actualConversions?: number | null;  // Generic conversion count
  // NEW: Performance goals
  impressionGoal?: number | null;
  leadGoal?: number | null;
  installGoal?: number | null;
  // Channels and targeting
  primaryChannels: MediaChannelKey[];
  marketsStores: string | null;
  // Notes
  notes: string | null;
}

// ============================================================================
// Summary / Aggregate Types
// ============================================================================

/**
 * MediaLabSummary - Summary of a company's media lab status
 * Used for Blueprint and Dashboard integration
 */
export interface MediaLabSummary {
  hasMediaProgram: boolean;
  mediaStatus: CompanyMediaStatus;
  primaryObjective: MediaObjective | null;
  primaryMarkets: string | null;
  totalActiveBudget: number | null;
  activePlanCount: number;
}

/**
 * MediaPlanWithDetails - A media plan with its channels and flights
 */
export interface MediaPlanWithDetails extends MediaPlan {
  channels: MediaPlanChannel[];
  flights: MediaPlanFlight[];
}

/**
 * MediaLabData - Complete media lab data for a company
 */
export interface MediaLabData {
  summary: MediaLabSummary;
  plans: MediaPlanWithDetails[];
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get display label for a channel key
 */
export function getChannelLabel(channel: MediaChannelKey): string {
  return MEDIA_CHANNEL_LABELS[channel] || channel;
}

/**
 * Get display label for an objective
 */
export function getObjectiveLabel(objective: MediaObjective): string {
  return MEDIA_OBJECTIVE_CONFIG[objective]?.label || objective;
}

/**
 * Get display label for a status
 */
export function getStatusLabel(status: MediaPlanStatus): string {
  return MEDIA_PLAN_STATUS_CONFIG[status]?.label || status;
}

/**
 * Get display label for a season
 */
export function getSeasonLabel(season: MediaFlightSeason): string {
  return MEDIA_SEASON_CONFIG[season]?.label || season;
}

/**
 * Format budget for display
 */
export function formatMediaBudget(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Format date range for display
 */
export function formatDateRange(start: string | null, end: string | null): string {
  if (!start && !end) return '—';

  const formatDate = (d: string) => {
    const date = new Date(d);
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };

  if (start && end) {
    return `${formatDate(start)} – ${formatDate(end)}`;
  }
  if (start) return `From ${formatDate(start)}`;
  if (end) return `Until ${formatDate(end)}`;
  return '—';
}

/**
 * Calculate total budget from channels
 */
export function calculateTotalChannelBudget(channels: MediaPlanChannel[]): number {
  return channels.reduce((sum, ch) => sum + (ch.budgetAmount || 0), 0);
}

/**
 * Get active plans from a list
 */
export function getActivePlans(plans: MediaPlan[]): MediaPlan[] {
  return plans.filter(p => p.status === 'active');
}

/**
 * Calculate total active budget across plans
 */
export function calculateTotalActiveBudget(plans: MediaPlanWithDetails[]): number {
  return plans
    .filter(p => p.status === 'active')
    .reduce((sum, plan) => sum + (plan.totalBudget || 0), 0);
}

// ============================================================================
// MEDIA PLANNING V2 - Extended Types for Planning Workspace
// ============================================================================

/**
 * Primary goal for the media program
 */
export type MediaPrimaryGoal =
  | 'installs'
  | 'leads'
  | 'awareness'
  | 'calls'
  | 'store_visits';

export const MEDIA_PRIMARY_GOAL_CONFIG: Record<MediaPrimaryGoal, {
  label: string;
  description: string;
  color: string;
  kpi: string;
}> = {
  installs: {
    label: 'Product Installs',
    description: 'Drive in-store product installations',
    color: 'text-emerald-400',
    kpi: 'Cost Per Install',
  },
  leads: {
    label: 'Lead Generation',
    description: 'Capture phone, form, or chat leads',
    color: 'text-blue-400',
    kpi: 'Cost Per Lead',
  },
  awareness: {
    label: 'Brand Awareness',
    description: 'Increase visibility and brand recognition',
    color: 'text-purple-400',
    kpi: 'Impressions & Reach',
  },
  calls: {
    label: 'Phone Calls',
    description: 'Drive inbound phone calls',
    color: 'text-amber-400',
    kpi: 'Cost Per Call',
  },
  store_visits: {
    label: 'Store Visits',
    description: 'Drive foot traffic to physical locations',
    color: 'text-cyan-400',
    kpi: 'Direction Requests',
  },
};

/**
 * Seasonality strategy for the media program
 */
export type MediaSeasonality = 'always_on' | 'seasonal_flight' | 'mixed';

export const MEDIA_SEASONALITY_CONFIG: Record<MediaSeasonality, {
  label: string;
  description: string;
}> = {
  always_on: {
    label: 'Always-On',
    description: 'Consistent spend year-round with stable budgets',
  },
  seasonal_flight: {
    label: 'Seasonal Flights',
    description: 'Concentrated spend during peak seasons only',
  },
  mixed: {
    label: 'Mixed Strategy',
    description: 'Base always-on spend with seasonal boosts',
  },
};

/**
 * Geographic targeting focus
 */
export type GeographicFocus = 'national' | 'state' | 'market' | 'store_level';

export const GEOGRAPHIC_FOCUS_CONFIG: Record<GeographicFocus, {
  label: string;
  description: string;
}> = {
  national: {
    label: 'National',
    description: 'Broad national coverage',
  },
  state: {
    label: 'State-Level',
    description: 'Targeting specific states',
  },
  market: {
    label: 'Market-Level',
    description: 'Targeting specific DMAs or metros',
  },
  store_level: {
    label: 'Store-Level',
    description: 'Hyper-local targeting around store locations',
  },
};

/**
 * Extended media objectives with full planning context
 */
export interface MediaObjectivesInput {
  companyId: string;
  primaryGoal: MediaPrimaryGoal;
  secondaryGoals: string[];
  targetCPL?: number;
  targetCPA?: number;
  targetROAS?: number;
  geographicFocus: GeographicFocus;
  categoryFocus: string[];
  seasonality: MediaSeasonality;
  requiredChannels: MediaChannelKey[];
  excludedChannels: MediaChannelKey[];
  notes?: string;
}

/**
 * Channel allocation with rationale
 */
export interface MediaChannelAllocation {
  channel: MediaChannelKey;
  label: string;
  percentOfBudget: number;
  monthlySpend: number;
  rationale: string;
  priority: MediaChannelPriority;
}

/**
 * Market/geography allocation
 */
export interface MarketAllocation {
  marketId: string;
  label: string;
  weight: number;
  stores?: string[];
}

/**
 * Seasonal burst/flight configuration
 */
export interface MediaSeasonalBurst {
  key: string;
  label: string;
  months: string;
  description: string;
  spendLiftPercent: number;
  primaryChannels: MediaChannelKey[];
}

/**
 * Performance forecast for the plan
 */
export interface MediaPlanForecast {
  totalMonthlySpend: number;
  estimatedImpressions: number;
  estimatedClicks: number;
  estimatedLeads: number;
  estimatedInstalls: number;
  estimatedCTR: number;
  estimatedCPL: number | null;
  estimatedCPI: number | null;
  estimatedROAS?: number;
  byChannel: {
    channel: MediaChannelKey;
    label: string;
    spend: number;
    percentOfBudget: number;
    estimatedImpressions: number;
    estimatedClicks: number;
    estimatedLeads: number;
    estimatedInstalls: number;
    estimatedCPL: number | null;
  }[];
}

/**
 * Channel readiness status
 */
export type ChannelReadinessStatus = 'not_applicable' | 'missing' | 'partial' | 'ready';

export const CHANNEL_READINESS_CONFIG: Record<ChannelReadinessStatus, {
  label: string;
  color: string;
  bgColor: string;
}> = {
  not_applicable: {
    label: 'N/A',
    color: 'text-slate-400',
    bgColor: 'bg-slate-500/10',
  },
  missing: {
    label: 'Missing',
    color: 'text-red-400',
    bgColor: 'bg-red-500/10',
  },
  partial: {
    label: 'Partial',
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
  },
  ready: {
    label: 'Ready',
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
  },
};

/**
 * Individual channel requirement
 */
export interface ChannelRequirement {
  id: string;
  channel: MediaChannelKey;
  label: string;
  description: string;
  status: ChannelReadinessStatus;
  priority: 'required' | 'recommended' | 'optional';
  actionUrl?: string;
  notes?: string;
}

/**
 * Channel requirements by channel
 */
export interface ChannelReadinessChecklist {
  channel: MediaChannelKey;
  channelLabel: string;
  overallStatus: ChannelReadinessStatus;
  requirements: ChannelRequirement[];
  readyCount: number;
  totalCount: number;
}

/**
 * Media playbook - prebuilt strategy template
 */
export interface MediaPlaybook {
  id: string;
  name: string;
  description: string;
  targetGoal: MediaPrimaryGoal;
  seasonality: MediaSeasonality;
  suggestedBudgetRange: { min: number; max: number };
  channelMix: {
    channel: MediaChannelKey;
    percentOfBudget: number;
    priority: MediaChannelPriority;
    rationale: string;
  }[];
  seasonalBursts: MediaSeasonalBurst[];
  expectedOutcomes: string[];
  bestFor: string[];
  requirements: string[];
}

/**
 * Full media plan with all planning data
 */
export interface MediaPlanV2 {
  id: string;
  companyId: string;
  name: string;
  status: MediaPlanStatus;

  // Objectives
  objectives: MediaObjectivesInput;

  // Budget
  monthlyBudget: number;
  annualBudget?: number;

  // Allocations
  channelAllocations: MediaChannelAllocation[];
  marketAllocations: MarketAllocation[];

  // Seasonality
  seasonalBursts: MediaSeasonalBurst[];

  // Forecast
  forecast: MediaPlanForecast;

  // Readiness
  channelRequirements: ChannelRequirement[];
  readinessScore: number;

  // Playbook reference (if created from playbook)
  playbookId?: string;
  playbookName?: string;

  // Meta
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  approvedBy?: string;
  approvedAt?: string;
}

/**
 * Media plan export format
 */
export interface MediaPlanExport {
  plan: MediaPlanV2;
  company: {
    id: string;
    name: string;
    industry?: string;
  };
  exportedAt: string;
  exportedBy?: string;
  version: string;
}

// ============================================================================
// Playbook Definitions
// ============================================================================

export const MEDIA_PLAYBOOKS: MediaPlaybook[] = [
  {
    id: 'remote-start-leader',
    name: 'Remote Start Market Leader',
    description: 'Dominate the remote start season with aggressive search and LSA coverage',
    targetGoal: 'installs',
    seasonality: 'mixed',
    suggestedBudgetRange: { min: 5000, max: 25000 },
    channelMix: [
      { channel: 'google_search', percentOfBudget: 40, priority: 'core', rationale: 'Capture high-intent "remote start near me" searches' },
      { channel: 'google_lsas', percentOfBudget: 30, priority: 'core', rationale: 'Build trust with Google Guaranteed badge' },
      { channel: 'google_maps_gbp', percentOfBudget: 15, priority: 'supporting', rationale: 'Dominate local map pack results' },
      { channel: 'paid_social_meta', percentOfBudget: 15, priority: 'supporting', rationale: 'Retarget website visitors and lookalikes' },
    ],
    seasonalBursts: [
      { key: 'remote_start', label: 'Remote Start Season', months: 'Oct-Feb', description: 'Peak season for remote start installs', spendLiftPercent: 50, primaryChannels: ['google_search', 'google_lsas'] },
    ],
    expectedOutcomes: [
      '20-30 qualified leads per month during peak season',
      '$75-125 cost per install',
      '15-25% lift in branded searches',
    ],
    bestFor: [
      'Established retailers with 3+ locations',
      'Strong remote start service capability',
      'Competitive markets',
    ],
    requirements: [
      'Google Business Profile optimized',
      'Conversion tracking in place',
      'Call tracking enabled',
    ],
  },
  {
    id: 'carplay-growth',
    name: 'CarPlay/Android Auto Growth',
    description: 'Target the growing wireless CarPlay retrofit market',
    targetGoal: 'leads',
    seasonality: 'always_on',
    suggestedBudgetRange: { min: 3000, max: 15000 },
    channelMix: [
      { channel: 'google_search', percentOfBudget: 45, priority: 'core', rationale: 'Capture specific vehicle + CarPlay searches' },
      { channel: 'paid_social_meta', percentOfBudget: 30, priority: 'core', rationale: 'Reach car enthusiasts on Meta platforms' },
      { channel: 'display_retarg', percentOfBudget: 15, priority: 'supporting', rationale: 'Re-engage website visitors' },
      { channel: 'google_maps_gbp', percentOfBudget: 10, priority: 'supporting', rationale: 'Local presence for "CarPlay install near me"' },
    ],
    seasonalBursts: [
      { key: 'carplay_season', label: 'Spring/Summer Push', months: 'Apr-Jun', description: 'Road trip season drives CarPlay interest', spendLiftPercent: 25, primaryChannels: ['google_search', 'paid_social_meta'] },
    ],
    expectedOutcomes: [
      '15-25 qualified leads per month',
      '$50-100 cost per lead',
      'Strong social engagement and shares',
    ],
    bestFor: [
      'Shops with CarPlay/Android Auto expertise',
      'Stores serving newer vehicle owners',
      'Growing markets',
    ],
    requirements: [
      'Vehicle compatibility database',
      'Portfolio of completed installs',
      'Video content assets',
    ],
  },
  {
    id: 'local-dominance',
    name: 'Local Market Dominance',
    description: 'Own your local market with comprehensive Maps and LSA presence',
    targetGoal: 'store_visits',
    seasonality: 'always_on',
    suggestedBudgetRange: { min: 2000, max: 10000 },
    channelMix: [
      { channel: 'google_maps_gbp', percentOfBudget: 35, priority: 'core', rationale: 'Maximize map pack visibility' },
      { channel: 'google_lsas', percentOfBudget: 35, priority: 'core', rationale: 'Google Guaranteed builds trust' },
      { channel: 'google_search', percentOfBudget: 20, priority: 'supporting', rationale: 'Capture branded and service searches' },
      { channel: 'display_retarg', percentOfBudget: 10, priority: 'experimental', rationale: 'Stay top-of-mind with past visitors' },
    ],
    seasonalBursts: [],
    expectedOutcomes: [
      'Top 3 map pack position',
      '25%+ increase in direction requests',
      'Strong review growth',
    ],
    bestFor: [
      'Single-location shops',
      'New market entrants',
      'Shops focused on walk-in traffic',
    ],
    requirements: [
      'Fully optimized Google Business Profile',
      'Regular review management',
      'Updated hours and services',
    ],
  },
  {
    id: 'audio-enthusiast',
    name: 'Audio Enthusiast Focus',
    description: 'Target high-value audio system upgrades and custom builds',
    targetGoal: 'leads',
    seasonality: 'mixed',
    suggestedBudgetRange: { min: 4000, max: 20000 },
    channelMix: [
      { channel: 'paid_social_meta', percentOfBudget: 40, priority: 'core', rationale: 'Reach car audio enthusiasts with visual content' },
      { channel: 'google_search', percentOfBudget: 30, priority: 'core', rationale: 'Capture high-intent system upgrade searches' },
      { channel: 'display_retarg', percentOfBudget: 20, priority: 'supporting', rationale: 'Showcase builds to engaged visitors' },
      { channel: 'google_maps_gbp', percentOfBudget: 10, priority: 'supporting', rationale: 'Local discovery for audio services' },
    ],
    seasonalBursts: [
      { key: 'summer_audio', label: 'Summer Audio Season', months: 'May-Aug', description: 'Peak season for audio upgrades', spendLiftPercent: 30, primaryChannels: ['paid_social_meta', 'google_search'] },
    ],
    expectedOutcomes: [
      '10-20 high-value leads per month',
      'Higher average ticket ($1,500+)',
      'Strong portfolio and social proof',
    ],
    bestFor: [
      'Shops with custom audio expertise',
      'Strong visual portfolio',
      'Higher-end service positioning',
    ],
    requirements: [
      'High-quality build photos/videos',
      'Clear pricing for systems',
      'Customer testimonials',
    ],
  },
];

/**
 * Get playbook by ID
 */
export function getPlaybookById(id: string): MediaPlaybook | undefined {
  return MEDIA_PLAYBOOKS.find(p => p.id === id);
}

/**
 * Get playbooks matching a goal
 */
export function getPlaybooksForGoal(goal: MediaPrimaryGoal): MediaPlaybook[] {
  return MEDIA_PLAYBOOKS.filter(p => p.targetGoal === goal);
}

// ============================================================================
// Default Channel Requirements
// ============================================================================

export const DEFAULT_CHANNEL_REQUIREMENTS: Record<MediaChannelKey, Omit<ChannelRequirement, 'id' | 'status' | 'notes'>[]> = {
  // Google ecosystem
  google_search: [
    { channel: 'google_search', label: 'Google Ads Account', description: 'Active Google Ads account linked', priority: 'required' },
    { channel: 'google_search', label: 'Conversion Tracking', description: 'Phone calls, forms, and chat tracked', priority: 'required' },
    { channel: 'google_search', label: 'Location Extensions', description: 'Store locations linked to campaigns', priority: 'recommended' },
    { channel: 'google_search', label: 'Call Extensions', description: 'Click-to-call enabled', priority: 'recommended' },
    { channel: 'google_search', label: 'Negative Keywords', description: 'Exclusion list in place', priority: 'optional' },
  ],
  google_lsas: [
    { channel: 'google_lsas', label: 'LSA Account Setup', description: 'Local Services Ads account created', priority: 'required' },
    { channel: 'google_lsas', label: 'Background Check', description: 'Business verification complete', priority: 'required' },
    { channel: 'google_lsas', label: 'Service Categories', description: 'All relevant categories selected', priority: 'required' },
    { channel: 'google_lsas', label: 'Budget & Leads', description: 'Weekly budget and lead goals set', priority: 'recommended' },
    { channel: 'google_lsas', label: 'Response Time', description: 'Fast lead response process in place', priority: 'recommended' },
  ],
  google_maps_gbp: [
    { channel: 'google_maps_gbp', label: 'GBP Claimed', description: 'Google Business Profile claimed and verified', priority: 'required' },
    { channel: 'google_maps_gbp', label: 'Complete Profile', description: 'All services, hours, and info filled', priority: 'required' },
    { channel: 'google_maps_gbp', label: 'Photos & Videos', description: 'Recent photos of work and store', priority: 'recommended' },
    { channel: 'google_maps_gbp', label: 'Reviews Strategy', description: 'Active review collection in place', priority: 'recommended' },
    { channel: 'google_maps_gbp', label: 'Posts & Updates', description: 'Regular GBP posts scheduled', priority: 'optional' },
  ],
  google_youtube: [
    { channel: 'google_youtube', label: 'Google Ads Account', description: 'Google Ads account with YouTube access', priority: 'required' },
    { channel: 'google_youtube', label: 'YouTube Channel', description: 'Active YouTube channel linked', priority: 'required' },
    { channel: 'google_youtube', label: 'Video Creative', description: 'Video ads in required formats (6s, 15s, etc.)', priority: 'required' },
    { channel: 'google_youtube', label: 'Audience Targeting', description: 'Custom intent and affinity audiences', priority: 'recommended' },
  ],
  google_display: [
    { channel: 'google_display', label: 'Google Ads Account', description: 'Google Ads account active', priority: 'required' },
    { channel: 'google_display', label: 'Display Creative', description: 'Responsive display ads or image ads', priority: 'required' },
    { channel: 'google_display', label: 'Conversion Tracking', description: 'Conversions configured', priority: 'required' },
    { channel: 'google_display', label: 'Placement Targeting', description: 'Relevant placements identified', priority: 'recommended' },
  ],
  // Meta ecosystem
  paid_social_meta: [
    { channel: 'paid_social_meta', label: 'Meta Business Suite', description: 'Business account set up', priority: 'required' },
    { channel: 'paid_social_meta', label: 'Pixel Installed', description: 'Meta Pixel on website', priority: 'required' },
    { channel: 'paid_social_meta', label: 'Ad Creative', description: 'Photos/videos of work', priority: 'required' },
    { channel: 'paid_social_meta', label: 'Audience Targeting', description: 'Custom audiences defined', priority: 'recommended' },
    { channel: 'paid_social_meta', label: 'Catalog Setup', description: 'Services catalog for dynamic ads', priority: 'optional' },
  ],
  // Microsoft
  microsoft_search: [
    { channel: 'microsoft_search', label: 'Microsoft Ads Account', description: 'Microsoft Advertising account active', priority: 'required' },
    { channel: 'microsoft_search', label: 'Conversion Tracking', description: 'UET tag installed', priority: 'required' },
    { channel: 'microsoft_search', label: 'Import from Google', description: 'Campaigns synced from Google Ads', priority: 'recommended' },
  ],
  // Other digital
  tiktok_social: [
    { channel: 'tiktok_social', label: 'TikTok Ads Manager', description: 'Business account created', priority: 'required' },
    { channel: 'tiktok_social', label: 'TikTok Pixel', description: 'Pixel installed on website', priority: 'required' },
    { channel: 'tiktok_social', label: 'Video Creative', description: 'Vertical video ads (9:16)', priority: 'required' },
    { channel: 'tiktok_social', label: 'Audience Strategy', description: 'Target audience defined', priority: 'recommended' },
  ],
  display_retarg: [
    { channel: 'display_retarg', label: 'Retargeting Tags', description: 'Google/Meta pixels installed', priority: 'required' },
    { channel: 'display_retarg', label: 'Audience Segments', description: 'Website visitors segmented', priority: 'required' },
    { channel: 'display_retarg', label: 'Display Creative', description: 'Banner ads in multiple sizes', priority: 'required' },
    { channel: 'display_retarg', label: 'Frequency Caps', description: 'Impression limits set', priority: 'recommended' },
  ],
  email_marketing: [
    { channel: 'email_marketing', label: 'Email Platform', description: 'ESP configured (Klaviyo, Mailchimp, etc.)', priority: 'required' },
    { channel: 'email_marketing', label: 'Email List', description: 'Subscriber list with consent', priority: 'required' },
    { channel: 'email_marketing', label: 'Email Templates', description: 'Branded email templates', priority: 'required' },
    { channel: 'email_marketing', label: 'Automation Flows', description: 'Welcome, abandoned cart flows', priority: 'recommended' },
  ],
  affiliate: [
    { channel: 'affiliate', label: 'Affiliate Program', description: 'Affiliate network or program set up', priority: 'required' },
    { channel: 'affiliate', label: 'Commission Structure', description: 'Payout terms defined', priority: 'required' },
    { channel: 'affiliate', label: 'Tracking Setup', description: 'Affiliate links and tracking active', priority: 'required' },
  ],
  // Traditional / offline
  radio: [
    { channel: 'radio', label: 'Radio Script', description: 'Approved ad script', priority: 'required' },
    { channel: 'radio', label: 'Station Selection', description: 'Target stations identified', priority: 'required' },
    { channel: 'radio', label: 'Tracking Number', description: 'Dedicated phone number for attribution', priority: 'recommended' },
    { channel: 'radio', label: 'Flight Schedule', description: 'Daypart and frequency plan', priority: 'recommended' },
  ],
  tv: [
    { channel: 'tv', label: 'TV Creative', description: 'Video spot produced (15s, 30s, 60s)', priority: 'required' },
    { channel: 'tv', label: 'Station/Network Selection', description: 'Target networks identified', priority: 'required' },
    { channel: 'tv', label: 'Tracking Method', description: 'Lift study or tracking number', priority: 'recommended' },
    { channel: 'tv', label: 'Media Buy', description: 'Placement and flight schedule', priority: 'required' },
  ],
  streaming_audio: [
    { channel: 'streaming_audio', label: 'Audio Creative', description: 'Audio ad produced (15s, 30s)', priority: 'required' },
    { channel: 'streaming_audio', label: 'Platform Selection', description: 'Spotify, Pandora, iHeartRadio, etc.', priority: 'required' },
    { channel: 'streaming_audio', label: 'Targeting Setup', description: 'Demographics and interests defined', priority: 'recommended' },
    { channel: 'streaming_audio', label: 'Companion Banner', description: 'Display companion if supported', priority: 'optional' },
  ],
  out_of_home: [
    { channel: 'out_of_home', label: 'OOH Creative', description: 'Billboard or transit ad designed', priority: 'required' },
    { channel: 'out_of_home', label: 'Location Selection', description: 'Target locations/routes identified', priority: 'required' },
    { channel: 'out_of_home', label: 'Vendor Contract', description: 'OOH vendor agreement', priority: 'required' },
    { channel: 'out_of_home', label: 'Tracking Method', description: 'Lift study or geo-tracking', priority: 'recommended' },
  ],
  print: [
    { channel: 'print', label: 'Print Creative', description: 'Ad design in required specs', priority: 'required' },
    { channel: 'print', label: 'Publication Selection', description: 'Target newspapers/magazines', priority: 'required' },
    { channel: 'print', label: 'Tracking Method', description: 'Promo code or tracking number', priority: 'recommended' },
  ],
  direct_mail: [
    { channel: 'direct_mail', label: 'Mail Creative', description: 'Postcard or letter designed', priority: 'required' },
    { channel: 'direct_mail', label: 'Mailing List', description: 'Target addresses compiled', priority: 'required' },
    { channel: 'direct_mail', label: 'Print Vendor', description: 'Printing and mailing vendor', priority: 'required' },
    { channel: 'direct_mail', label: 'Tracking Method', description: 'Promo code or unique URL', priority: 'recommended' },
  ],
  // Catch-all
  other: [
    { channel: 'other', label: 'Channel Defined', description: 'Specific channel requirements identified', priority: 'required' },
  ],
};
