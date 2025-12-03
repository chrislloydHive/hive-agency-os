// lib/mediaLab/planning.ts
// Media Planning Engine - Recommendation, Forecast, and Readiness Services
//
// This module provides:
// - Media mix recommendations based on objectives
// - Performance forecasting based on budget and channels
// - Channel readiness assessment
// - Playbook-to-plan conversion

import {
  type MediaChannelKey,
  type MediaPrimaryGoal,
  type MediaSeasonality,
  type GeographicFocus,
  type MediaChannelPriority,
  type MediaObjectivesInput,
  type MediaChannelAllocation,
  type MediaPlanForecast,
  type ChannelRequirement,
  type ChannelReadinessStatus,
  type ChannelReadinessChecklist,
  type MediaPlaybook,
  type MediaPlanV2,
  type MediaSeasonalBurst,
  MEDIA_CHANNEL_LABELS,
  MEDIA_PLAYBOOKS,
  DEFAULT_CHANNEL_REQUIREMENTS,
  getPlaybookById,
} from '@/lib/types/mediaLab';

// ============================================================================
// Channel Performance Benchmarks
// ============================================================================

interface ChannelBenchmark {
  channel: MediaChannelKey;
  cpm: number; // Cost per 1000 impressions
  ctr: number; // Click-through rate (0-1)
  conversionRate: number; // Lead/install conversion rate (0-1)
  avgCpc: number; // Average cost per click
  installRate: number; // Rate of leads that convert to installs (0-1)
}

const CHANNEL_BENCHMARKS: Record<MediaChannelKey, ChannelBenchmark> = {
  google_search: {
    channel: 'google_search',
    cpm: 25,
    ctr: 0.045, // 4.5% CTR for search
    conversionRate: 0.06, // 6% conversion rate
    avgCpc: 3.5,
    installRate: 0.4, // 40% of leads become installs
  },
  google_lsas: {
    channel: 'google_lsas',
    cpm: 0, // Pay per lead model
    ctr: 0.08, // 8% effective "CTR"
    conversionRate: 0.15, // 15% - leads are higher intent
    avgCpc: 25, // Cost per lead really
    installRate: 0.5, // 50% install rate
  },
  google_maps_gbp: {
    channel: 'google_maps_gbp',
    cpm: 8,
    ctr: 0.025, // 2.5% for maps
    conversionRate: 0.08, // 8% conversion
    avgCpc: 1.5,
    installRate: 0.35,
  },
  paid_social_meta: {
    channel: 'paid_social_meta',
    cpm: 12,
    ctr: 0.012, // 1.2% CTR for social
    conversionRate: 0.025, // 2.5% conversion
    avgCpc: 1.8,
    installRate: 0.3,
  },
  display_retarg: {
    channel: 'display_retarg',
    cpm: 5,
    ctr: 0.008, // 0.8% CTR for display
    conversionRate: 0.015, // 1.5% conversion
    avgCpc: 0.8,
    installRate: 0.25,
  },
  radio: {
    channel: 'radio',
    cpm: 3,
    ctr: 0.002, // Very low direct response
    conversionRate: 0.005,
    avgCpc: 0,
    installRate: 0.2,
  },
  other: {
    channel: 'other',
    cpm: 10,
    ctr: 0.02,
    conversionRate: 0.03,
    avgCpc: 2,
    installRate: 0.3,
  },
};

// ============================================================================
// Media Mix Recommendation Engine
// ============================================================================

interface RecommendationInput {
  primaryGoal: MediaPrimaryGoal;
  monthlyBudget: number;
  seasonality: MediaSeasonality;
  geographicFocus: GeographicFocus;
  categoryFocus: string[];
  requiredChannels: MediaChannelKey[];
  excludedChannels: MediaChannelKey[];
}

/**
 * Generate recommended media mix based on objectives
 */
export function generateMediaMixRecommendation(
  input: RecommendationInput
): MediaChannelAllocation[] {
  const { primaryGoal, monthlyBudget, seasonality, geographicFocus, requiredChannels, excludedChannels } = input;

  // Get base allocation percentages by goal
  const baseAllocations = getBaseAllocationsByGoal(primaryGoal);

  // Filter out excluded channels
  let allocations = baseAllocations.filter(a => !excludedChannels.includes(a.channel));

  // Ensure required channels are included
  for (const reqChannel of requiredChannels) {
    if (!allocations.find(a => a.channel === reqChannel)) {
      allocations.push({
        channel: reqChannel,
        label: MEDIA_CHANNEL_LABELS[reqChannel],
        percentOfBudget: 10,
        monthlySpend: monthlyBudget * 0.1,
        rationale: 'Required channel per objectives',
        priority: 'supporting',
      });
    }
  }

  // Adjust for geographic focus
  allocations = adjustForGeography(allocations, geographicFocus);

  // Adjust for seasonality
  allocations = adjustForSeasonality(allocations, seasonality);

  // Normalize percentages to 100%
  const totalPct = allocations.reduce((sum, a) => sum + a.percentOfBudget, 0);
  allocations = allocations.map(a => ({
    ...a,
    percentOfBudget: Math.round((a.percentOfBudget / totalPct) * 100),
    monthlySpend: Math.round((a.percentOfBudget / totalPct) * monthlyBudget),
  }));

  // Sort by percentage descending
  return allocations.sort((a, b) => b.percentOfBudget - a.percentOfBudget);
}

function getBaseAllocationsByGoal(goal: MediaPrimaryGoal): MediaChannelAllocation[] {
  const allocations: Record<MediaPrimaryGoal, MediaChannelAllocation[]> = {
    installs: [
      { channel: 'google_search', label: 'Google Search', percentOfBudget: 40, monthlySpend: 0, rationale: 'Capture high-intent service searches', priority: 'core' },
      { channel: 'google_lsas', label: 'Google LSAs', percentOfBudget: 30, monthlySpend: 0, rationale: 'Google Guaranteed builds trust for installations', priority: 'core' },
      { channel: 'google_maps_gbp', label: 'Google Maps/GBP', percentOfBudget: 15, monthlySpend: 0, rationale: 'Drive local discovery and store visits', priority: 'supporting' },
      { channel: 'paid_social_meta', label: 'Paid Social (Meta)', percentOfBudget: 15, monthlySpend: 0, rationale: 'Retarget and reach car enthusiasts', priority: 'supporting' },
    ],
    leads: [
      { channel: 'google_search', label: 'Google Search', percentOfBudget: 45, monthlySpend: 0, rationale: 'Primary lead capture from search intent', priority: 'core' },
      { channel: 'paid_social_meta', label: 'Paid Social (Meta)', percentOfBudget: 25, monthlySpend: 0, rationale: 'Reach and retarget potential customers', priority: 'core' },
      { channel: 'google_lsas', label: 'Google LSAs', percentOfBudget: 20, monthlySpend: 0, rationale: 'High-quality leads with Google Guaranteed', priority: 'supporting' },
      { channel: 'display_retarg', label: 'Display/Retargeting', percentOfBudget: 10, monthlySpend: 0, rationale: 'Re-engage website visitors', priority: 'experimental' },
    ],
    awareness: [
      { channel: 'paid_social_meta', label: 'Paid Social (Meta)', percentOfBudget: 40, monthlySpend: 0, rationale: 'Maximize reach and brand impressions', priority: 'core' },
      { channel: 'display_retarg', label: 'Display/Retargeting', percentOfBudget: 25, monthlySpend: 0, rationale: 'Broad display coverage', priority: 'core' },
      { channel: 'google_search', label: 'Google Search', percentOfBudget: 20, monthlySpend: 0, rationale: 'Capture branded and category searches', priority: 'supporting' },
      { channel: 'google_maps_gbp', label: 'Google Maps/GBP', percentOfBudget: 15, monthlySpend: 0, rationale: 'Local brand presence', priority: 'supporting' },
    ],
    calls: [
      { channel: 'google_lsas', label: 'Google LSAs', percentOfBudget: 40, monthlySpend: 0, rationale: 'Direct phone call generation', priority: 'core' },
      { channel: 'google_search', label: 'Google Search', percentOfBudget: 35, monthlySpend: 0, rationale: 'Call extensions and click-to-call', priority: 'core' },
      { channel: 'google_maps_gbp', label: 'Google Maps/GBP', percentOfBudget: 25, monthlySpend: 0, rationale: 'GBP calls and direction requests', priority: 'supporting' },
    ],
    store_visits: [
      { channel: 'google_maps_gbp', label: 'Google Maps/GBP', percentOfBudget: 40, monthlySpend: 0, rationale: 'Maximize map pack visibility', priority: 'core' },
      { channel: 'google_lsas', label: 'Google LSAs', percentOfBudget: 30, monthlySpend: 0, rationale: 'Drive local service inquiries', priority: 'core' },
      { channel: 'google_search', label: 'Google Search', percentOfBudget: 20, monthlySpend: 0, rationale: 'Local search presence', priority: 'supporting' },
      { channel: 'paid_social_meta', label: 'Paid Social (Meta)', percentOfBudget: 10, monthlySpend: 0, rationale: 'Local awareness and store promos', priority: 'experimental' },
    ],
  };

  return allocations[goal] || allocations.leads;
}

function adjustForGeography(
  allocations: MediaChannelAllocation[],
  focus: GeographicFocus
): MediaChannelAllocation[] {
  // For store-level focus, boost local channels
  if (focus === 'store_level') {
    return allocations.map(a => {
      if (a.channel === 'google_maps_gbp' || a.channel === 'google_lsas') {
        return { ...a, percentOfBudget: a.percentOfBudget * 1.2 };
      }
      return a;
    });
  }

  // For national focus, boost broad reach channels
  if (focus === 'national') {
    return allocations.map(a => {
      if (a.channel === 'paid_social_meta' || a.channel === 'display_retarg') {
        return { ...a, percentOfBudget: a.percentOfBudget * 1.15 };
      }
      if (a.channel === 'google_lsas') {
        return { ...a, percentOfBudget: a.percentOfBudget * 0.8 }; // LSAs are more local
      }
      return a;
    });
  }

  return allocations;
}

function adjustForSeasonality(
  allocations: MediaChannelAllocation[],
  seasonality: MediaSeasonality
): MediaChannelAllocation[] {
  // For seasonal flights, emphasize high-impact channels
  if (seasonality === 'seasonal_flight') {
    return allocations.map(a => {
      if (a.channel === 'google_search' || a.channel === 'google_lsas') {
        return { ...a, percentOfBudget: a.percentOfBudget * 1.1 };
      }
      if (a.channel === 'display_retarg') {
        return { ...a, percentOfBudget: a.percentOfBudget * 0.7 };
      }
      return a;
    });
  }

  return allocations;
}

// ============================================================================
// Performance Forecast Engine
// ============================================================================

interface ForecastInput {
  monthlyBudget: number;
  allocations: MediaChannelAllocation[];
  primaryGoal: MediaPrimaryGoal;
}

/**
 * Generate performance forecast based on budget and allocations
 */
export function generateForecast(input: ForecastInput): MediaPlanForecast {
  const { monthlyBudget, allocations, primaryGoal } = input;

  let totalImpressions = 0;
  let totalClicks = 0;
  let totalLeads = 0;
  let totalInstalls = 0;

  const byChannel = allocations.map(allocation => {
    const benchmark = CHANNEL_BENCHMARKS[allocation.channel];
    const spend = allocation.monthlySpend;

    // Calculate impressions based on CPM
    let impressions = 0;
    let clicks = 0;
    let leads = 0;
    let installs = 0;

    if (allocation.channel === 'google_lsas') {
      // LSAs are pay-per-lead, not CPM
      leads = Math.floor(spend / benchmark.avgCpc);
      installs = Math.floor(leads * benchmark.installRate);
      impressions = leads * 50; // Estimate 50 impressions per lead
      clicks = leads * 3; // Estimate 3 clicks per lead
    } else if (benchmark.cpm > 0) {
      impressions = Math.floor((spend / benchmark.cpm) * 1000);
      clicks = Math.floor(impressions * benchmark.ctr);
      leads = Math.floor(clicks * benchmark.conversionRate);
      installs = Math.floor(leads * benchmark.installRate);
    }

    totalImpressions += impressions;
    totalClicks += clicks;
    totalLeads += leads;
    totalInstalls += installs;

    return {
      channel: allocation.channel,
      label: allocation.label,
      spend,
      percentOfBudget: allocation.percentOfBudget,
      estimatedImpressions: impressions,
      estimatedClicks: clicks,
      estimatedLeads: leads,
      estimatedInstalls: installs,
      estimatedCPL: leads > 0 ? Math.round(spend / leads) : null,
    };
  });

  const estimatedCTR = totalImpressions > 0 ? totalClicks / totalImpressions : 0;
  const estimatedCPL = totalLeads > 0 ? Math.round(monthlyBudget / totalLeads) : null;
  const estimatedCPI = totalInstalls > 0 ? Math.round(monthlyBudget / totalInstalls) : null;

  return {
    totalMonthlySpend: monthlyBudget,
    estimatedImpressions: totalImpressions,
    estimatedClicks: totalClicks,
    estimatedLeads: totalLeads,
    estimatedInstalls: totalInstalls,
    estimatedCTR,
    estimatedCPL,
    estimatedCPI,
    byChannel,
  };
}

// ============================================================================
// Channel Readiness Assessment
// ============================================================================

/**
 * Generate channel readiness checklist for selected channels
 */
export function generateChannelReadinessChecklist(
  channels: MediaChannelKey[],
  existingStatuses?: Record<string, ChannelReadinessStatus>
): ChannelReadinessChecklist[] {
  return channels.map(channel => {
    const requirements = DEFAULT_CHANNEL_REQUIREMENTS[channel] || [];

    const fullRequirements: ChannelRequirement[] = requirements.map((req, index) => ({
      ...req,
      id: `${channel}-${index}`,
      status: existingStatuses?.[`${channel}-${index}`] || 'missing',
    }));

    const readyCount = fullRequirements.filter(r => r.status === 'ready').length;
    const totalCount = fullRequirements.length;

    let overallStatus: ChannelReadinessStatus = 'missing';
    if (readyCount === totalCount && totalCount > 0) {
      overallStatus = 'ready';
    } else if (readyCount > 0) {
      overallStatus = 'partial';
    }

    return {
      channel,
      channelLabel: MEDIA_CHANNEL_LABELS[channel],
      overallStatus,
      requirements: fullRequirements,
      readyCount,
      totalCount,
    };
  });
}

/**
 * Calculate overall readiness score (0-100)
 */
export function calculateReadinessScore(checklists: ChannelReadinessChecklist[]): number {
  if (checklists.length === 0) return 0;

  const totalRequired = checklists.reduce((sum, c) => {
    return sum + c.requirements.filter(r => r.priority === 'required').length;
  }, 0);

  const readyRequired = checklists.reduce((sum, c) => {
    return sum + c.requirements.filter(r => r.priority === 'required' && r.status === 'ready').length;
  }, 0);

  if (totalRequired === 0) return 100;
  return Math.round((readyRequired / totalRequired) * 100);
}

// ============================================================================
// Playbook to Plan Conversion
// ============================================================================

/**
 * Create a new plan from a playbook
 */
export function createPlanFromPlaybook(
  companyId: string,
  playbook: MediaPlaybook,
  monthlyBudget: number,
  planName?: string
): Omit<MediaPlanV2, 'id' | 'createdAt' | 'updatedAt'> {
  // Convert playbook channel mix to allocations
  const channelAllocations: MediaChannelAllocation[] = playbook.channelMix.map(ch => ({
    channel: ch.channel,
    label: MEDIA_CHANNEL_LABELS[ch.channel],
    percentOfBudget: ch.percentOfBudget,
    monthlySpend: Math.round(monthlyBudget * (ch.percentOfBudget / 100)),
    rationale: ch.rationale,
    priority: ch.priority,
  }));

  // Create objectives from playbook
  const objectives: MediaObjectivesInput = {
    companyId,
    primaryGoal: playbook.targetGoal,
    secondaryGoals: [],
    geographicFocus: 'market',
    categoryFocus: [],
    seasonality: playbook.seasonality,
    requiredChannels: playbook.channelMix.filter(c => c.priority === 'core').map(c => c.channel),
    excludedChannels: [],
  };

  // Generate forecast
  const forecast = generateForecast({
    monthlyBudget,
    allocations: channelAllocations,
    primaryGoal: playbook.targetGoal,
  });

  // Generate channel readiness
  const channels = playbook.channelMix.map(c => c.channel);
  const checklists = generateChannelReadinessChecklist(channels);
  const channelRequirements = checklists.flatMap(c => c.requirements);
  const readinessScore = calculateReadinessScore(checklists);

  return {
    companyId,
    name: planName || `${playbook.name} Plan`,
    status: 'draft',
    objectives,
    monthlyBudget,
    annualBudget: monthlyBudget * 12,
    channelAllocations,
    marketAllocations: [],
    seasonalBursts: playbook.seasonalBursts,
    forecast,
    channelRequirements,
    readinessScore,
    playbookId: playbook.id,
    playbookName: playbook.name,
  };
}

// ============================================================================
// Plan Generation from Objectives
// ============================================================================

/**
 * Generate a complete plan from objectives input
 */
export function generatePlanFromObjectives(
  objectives: MediaObjectivesInput,
  monthlyBudget: number,
  planName?: string
): Omit<MediaPlanV2, 'id' | 'createdAt' | 'updatedAt'> {
  // Generate recommended allocations
  const channelAllocations = generateMediaMixRecommendation({
    primaryGoal: objectives.primaryGoal,
    monthlyBudget,
    seasonality: objectives.seasonality,
    geographicFocus: objectives.geographicFocus,
    categoryFocus: objectives.categoryFocus,
    requiredChannels: objectives.requiredChannels,
    excludedChannels: objectives.excludedChannels,
  });

  // Generate forecast
  const forecast = generateForecast({
    monthlyBudget,
    allocations: channelAllocations,
    primaryGoal: objectives.primaryGoal,
  });

  // Generate seasonal bursts based on category focus
  const seasonalBursts = generateSeasonalBursts(objectives);

  // Generate channel readiness
  const channels = channelAllocations.map(c => c.channel);
  const checklists = generateChannelReadinessChecklist(channels);
  const channelRequirements = checklists.flatMap(c => c.requirements);
  const readinessScore = calculateReadinessScore(checklists);

  return {
    companyId: objectives.companyId,
    name: planName || 'New Media Plan',
    status: 'draft',
    objectives,
    monthlyBudget,
    annualBudget: monthlyBudget * 12,
    channelAllocations,
    marketAllocations: [],
    seasonalBursts,
    forecast,
    channelRequirements,
    readinessScore,
  };
}

function generateSeasonalBursts(objectives: MediaObjectivesInput): MediaSeasonalBurst[] {
  const bursts: MediaSeasonalBurst[] = [];
  const categories = objectives.categoryFocus.map(c => c.toLowerCase());

  if (categories.some(c => c.includes('remote') || c.includes('start'))) {
    bursts.push({
      key: 'remote_start',
      label: 'Remote Start Season',
      months: 'Oct-Feb',
      description: 'Peak season for remote start installations',
      spendLiftPercent: 50,
      primaryChannels: ['google_search', 'google_lsas'],
    });
  }

  if (categories.some(c => c.includes('carplay') || c.includes('android'))) {
    bursts.push({
      key: 'carplay_season',
      label: 'CarPlay/AA Season',
      months: 'Apr-Jun',
      description: 'Spring push for CarPlay retrofits',
      spendLiftPercent: 25,
      primaryChannels: ['google_search', 'paid_social_meta'],
    });
  }

  if (categories.some(c => c.includes('audio') || c.includes('speaker') || c.includes('amp'))) {
    bursts.push({
      key: 'summer_audio',
      label: 'Summer Audio',
      months: 'May-Aug',
      description: 'Peak season for audio upgrades',
      spendLiftPercent: 30,
      primaryChannels: ['paid_social_meta', 'google_search'],
    });
  }

  // Always consider holiday
  if (objectives.seasonality !== 'always_on') {
    bursts.push({
      key: 'holiday',
      label: 'Holiday Season',
      months: 'Nov-Dec',
      description: 'Gift-giving and year-end installs',
      spendLiftPercent: 20,
      primaryChannels: ['paid_social_meta', 'display_retarg'],
    });
  }

  return bursts;
}

// ============================================================================
// Work Items Generation from Plan
// ============================================================================

export interface PlanWorkItem {
  title: string;
  description: string;
  area: string;
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
  category: 'setup' | 'tracking' | 'readiness' | 'optimization';
}

/**
 * Generate work items from a media plan
 */
export function generateWorkItemsFromPlanV2(plan: MediaPlanV2): PlanWorkItem[] {
  const workItems: PlanWorkItem[] = [];

  // Core campaign setup
  workItems.push({
    title: `Set up ${plan.name} - Campaign Structure`,
    description: `Create campaign structure for ${plan.channelAllocations.length} channels with $${plan.monthlyBudget.toLocaleString()}/month budget. Channels: ${plan.channelAllocations.map(c => c.label).join(', ')}.`,
    area: 'Funnel',
    severity: 'High',
    category: 'setup',
  });

  // Tracking setup
  workItems.push({
    title: `${plan.name} - Conversion Tracking Setup`,
    description: 'Implement conversion tracking across all channels including phone calls, form submissions, and chat leads.',
    area: 'Analytics',
    severity: 'High',
    category: 'tracking',
  });

  // Missing readiness items
  const missingRequirements = plan.channelRequirements.filter(r =>
    r.status === 'missing' && r.priority === 'required'
  );

  for (const req of missingRequirements.slice(0, 5)) {
    workItems.push({
      title: `${MEDIA_CHANNEL_LABELS[req.channel]}: ${req.label}`,
      description: req.description,
      area: 'Funnel',
      severity: 'Medium',
      category: 'readiness',
    });
  }

  // Seasonal flight setup
  for (const burst of plan.seasonalBursts) {
    workItems.push({
      title: `Prepare ${burst.label} Campaign (${burst.months})`,
      description: `Plan and set up seasonal campaign for ${burst.label}. Expected ${burst.spendLiftPercent}% spend increase on ${burst.primaryChannels.map(c => MEDIA_CHANNEL_LABELS[c]).join(', ')}.`,
      area: 'Funnel',
      severity: 'Medium',
      category: 'setup',
    });
  }

  return workItems;
}

// ============================================================================
// Plan Export
// ============================================================================

/**
 * Export plan as JSON
 */
export function exportPlanAsJSON(
  plan: MediaPlanV2,
  company: { id: string; name: string; industry?: string }
): string {
  const exportData = {
    plan,
    company,
    exportedAt: new Date().toISOString(),
    version: '2.0',
  };

  return JSON.stringify(exportData, null, 2);
}

/**
 * Generate plan summary for display
 */
export function generatePlanSummary(plan: MediaPlanV2): {
  headline: string;
  bullets: string[];
  readinessStatus: string;
} {
  const topChannels = plan.channelAllocations
    .slice(0, 2)
    .map(c => c.label)
    .join(' and ');

  const headline = `$${plan.monthlyBudget.toLocaleString()}/month plan focused on ${plan.objectives.primaryGoal} via ${topChannels}`;

  const bullets: string[] = [
    `${plan.channelAllocations.length} channels in mix`,
    `~${plan.forecast.estimatedLeads.toLocaleString()} leads/month estimated`,
    plan.forecast.estimatedCPL ? `~$${plan.forecast.estimatedCPL} target CPL` : 'CPL to be determined',
  ];

  if (plan.seasonalBursts.length > 0) {
    bullets.push(`${plan.seasonalBursts.length} seasonal burst${plan.seasonalBursts.length > 1 ? 's' : ''} planned`);
  }

  let readinessStatus = 'Ready to Launch';
  if (plan.readinessScore < 50) {
    readinessStatus = 'Needs Setup Work';
  } else if (plan.readinessScore < 80) {
    readinessStatus = 'Almost Ready';
  }

  return { headline, bullets, readinessStatus };
}
