// lib/os/plans/convert/mediaPlanMapper.ts
// Maps Media Plan sections to Work Items
//
// Conversion mapping:
// - Channel Mix → Channel setup tasks (one per channel)
// - Campaigns → Campaign tasks + creative production tasks
// - Measurement → Tracking/attribution setup tasks
// - Cadence → Flighting calendar tasks

import type { MediaPlan, ChannelAllocation, MediaCampaign } from '@/lib/types/plan';
import type { WorkItem, WorkSourceHeavyPlan, WorkItemArea, WorkItemSeverity } from '@/lib/types/work';
import {
  generateChannelWorkKey,
  generateCampaignWorkKey,
  generateMeasurementWorkKey,
  generateCreativeWorkKey,
  generateCalendarWorkKey,
} from './workKeyGenerator';

// ============================================================================
// Types
// ============================================================================

export interface ConvertedWorkItem {
  title: string;
  notes: string;
  area: WorkItemArea;
  severity: WorkItemSeverity;
  source: WorkSourceHeavyPlan;
}

export interface MediaPlanConversionResult {
  channelTasks: ConvertedWorkItem[];
  campaignTasks: ConvertedWorkItem[];
  creativeTasks: ConvertedWorkItem[];
  measurementTasks: ConvertedWorkItem[];
  cadenceTasks: ConvertedWorkItem[];
  all: ConvertedWorkItem[];
}

// ============================================================================
// Channel Mix → Work Items
// ============================================================================

/**
 * Convert channel allocations to channel setup tasks
 */
export function mapChannelMixToWorkItems(
  plan: MediaPlan,
  companyId: string
): ConvertedWorkItem[] {
  const { channelMix } = plan.sections;
  if (!channelMix?.length) return [];

  return channelMix.map((channel, index) => {
    const workKey = generateChannelWorkKey(companyId, plan.id, channel.id, channel.channel);

    return {
      title: `Set up ${channel.channel} channel`,
      notes: buildChannelNotes(channel),
      area: channelToArea(channel.channel),
      severity: 'High' as WorkItemSeverity,
      source: {
        sourceType: 'heavy_plan',
        planId: plan.id,
        planType: 'media',
        planVersion: plan.version,
        sectionId: 'channelMix',
        sectionName: 'Channel Mix',
        itemIndex: index,
        workKey,
        convertedAt: new Date().toISOString(),
      },
    };
  });
}

function buildChannelNotes(channel: ChannelAllocation): string {
  const lines: string[] = [
    `**Objective:** ${channel.objective}`,
    `**Audience:** ${channel.audience}`,
    `**Monthly Budget:** $${channel.monthlyBudget.toLocaleString()}`,
  ];

  if (channel.rationale) {
    lines.push(`\n**Rationale:** ${channel.rationale}`);
  }

  if (Object.keys(channel.kpiTargets).length > 0) {
    lines.push('\n**KPI Targets:**');
    for (const [kpi, target] of Object.entries(channel.kpiTargets)) {
      lines.push(`- ${kpi}: ${target}`);
    }
  }

  return lines.join('\n');
}

function channelToArea(channel: string): WorkItemArea {
  const lower = channel.toLowerCase();
  if (lower.includes('seo') || lower.includes('organic')) return 'SEO';
  if (lower.includes('content') || lower.includes('blog')) return 'Content';
  if (lower.includes('social') || lower.includes('paid') || lower.includes('display')) return 'Funnel';
  if (lower.includes('analytics') || lower.includes('tracking')) return 'Analytics';
  return 'Funnel'; // Default for paid media
}

// ============================================================================
// Campaigns → Work Items
// ============================================================================

/**
 * Convert campaigns to campaign setup tasks
 */
export function mapCampaignsToWorkItems(
  plan: MediaPlan,
  companyId: string
): ConvertedWorkItem[] {
  const { campaigns } = plan.sections;
  if (!campaigns?.length) return [];

  return campaigns.map((campaign, index) => {
    const workKey = generateCampaignWorkKey(companyId, plan.id, campaign.id, campaign.name);

    return {
      title: `Launch "${campaign.name}" campaign on ${campaign.channel}`,
      notes: buildCampaignNotes(campaign),
      area: channelToArea(campaign.channel),
      severity: 'High' as WorkItemSeverity,
      source: {
        sourceType: 'heavy_plan',
        planId: plan.id,
        planType: 'media',
        planVersion: plan.version,
        sectionId: 'campaigns',
        sectionName: 'Campaigns',
        itemIndex: index,
        workKey,
        convertedAt: new Date().toISOString(),
      },
    };
  });
}

function buildCampaignNotes(campaign: MediaCampaign): string {
  const lines: string[] = [
    `**Channel:** ${campaign.channel}`,
    `**Offer:** ${campaign.offer}`,
    `**Targeting:** ${campaign.targeting}`,
    `**Budget:** $${campaign.budget.toLocaleString()}`,
  ];

  if (campaign.flighting) {
    lines.push(`**Flight Dates:** ${campaign.flighting.startDate} to ${campaign.flighting.endDate}`);
  }

  if (campaign.landingPage) {
    lines.push(`**Landing Page:** ${campaign.landingPage}`);
  }

  if (campaign.creativeNeeds) {
    lines.push(`\n**Creative Needs:** ${campaign.creativeNeeds}`);
  }

  if (Object.keys(campaign.kpis).length > 0) {
    lines.push('\n**KPIs:**');
    for (const [kpi, target] of Object.entries(campaign.kpis)) {
      lines.push(`- ${kpi}: ${target}`);
    }
  }

  if (campaign.experiments?.length) {
    lines.push('\n**Experiments:**');
    campaign.experiments.forEach((exp) => lines.push(`- ${exp}`));
  }

  return lines.join('\n');
}

// ============================================================================
// Campaigns → Creative Production Tasks
// ============================================================================

/**
 * Convert campaigns to creative production tasks
 */
export function mapCampaignsToCreativeTasks(
  plan: MediaPlan,
  companyId: string
): ConvertedWorkItem[] {
  const { campaigns } = plan.sections;
  if (!campaigns?.length) return [];

  const tasks: ConvertedWorkItem[] = [];

  campaigns.forEach((campaign, index) => {
    // Only create creative tasks if creative needs are specified
    if (!campaign.creativeNeeds) return;

    const workKey = generateCreativeWorkKey(companyId, plan.id, campaign.id, 'creative');

    tasks.push({
      title: `Produce creative assets for "${campaign.name}"`,
      notes: buildCreativeNotes(campaign),
      area: 'Brand',
      severity: 'Medium' as WorkItemSeverity,
      source: {
        sourceType: 'heavy_plan',
        planId: plan.id,
        planType: 'media',
        planVersion: plan.version,
        sectionId: 'campaigns',
        sectionName: 'Creative Production',
        itemIndex: index,
        workKey,
        convertedAt: new Date().toISOString(),
      },
    });

    // Landing page task if specified
    if (campaign.landingPage) {
      const lpWorkKey = generateCreativeWorkKey(companyId, plan.id, campaign.id, 'landing_page');

      tasks.push({
        title: `Create/update landing page for "${campaign.name}"`,
        notes: `**Campaign:** ${campaign.name}\n**Channel:** ${campaign.channel}\n**Landing Page:** ${campaign.landingPage}\n**Offer:** ${campaign.offer}`,
        area: 'Website UX',
        severity: 'High' as WorkItemSeverity,
        source: {
          sourceType: 'heavy_plan',
          planId: plan.id,
          planType: 'media',
          planVersion: plan.version,
          sectionId: 'campaigns',
          sectionName: 'Landing Pages',
          itemIndex: index,
          workKey: lpWorkKey,
          convertedAt: new Date().toISOString(),
        },
      });
    }
  });

  return tasks;
}

function buildCreativeNotes(campaign: MediaCampaign): string {
  const lines: string[] = [
    `**Campaign:** ${campaign.name}`,
    `**Channel:** ${campaign.channel}`,
    `**Creative Needs:** ${campaign.creativeNeeds}`,
    `**Offer:** ${campaign.offer}`,
    `**Targeting:** ${campaign.targeting}`,
  ];

  if (campaign.flighting) {
    lines.push(`**Due Before:** ${campaign.flighting.startDate}`);
  }

  return lines.join('\n');
}

// ============================================================================
// Measurement → Work Items
// ============================================================================

/**
 * Convert measurement section to tracking setup tasks
 */
export function mapMeasurementToWorkItems(
  plan: MediaPlan,
  companyId: string
): ConvertedWorkItem[] {
  const { measurement } = plan.sections;
  if (!measurement) return [];

  const tasks: ConvertedWorkItem[] = [];
  let itemIndex = 0;

  // Tracking stack setup
  if (measurement.trackingStack) {
    const workKey = generateMeasurementWorkKey(companyId, plan.id, 'tracking_stack');
    tasks.push({
      title: 'Configure analytics tracking stack',
      notes: `**Tracking Stack:** ${measurement.trackingStack}\n**Attribution Model:** ${measurement.attributionModel || 'TBD'}\n**Reporting Cadence:** ${measurement.reportingCadence || 'TBD'}`,
      area: 'Analytics',
      severity: 'High' as WorkItemSeverity,
      source: {
        sourceType: 'heavy_plan',
        planId: plan.id,
        planType: 'media',
        planVersion: plan.version,
        sectionId: 'measurement',
        sectionName: 'Measurement',
        itemIndex: itemIndex++,
        workKey,
        convertedAt: new Date().toISOString(),
      },
    });
  }

  // Conversion events
  if (measurement.conversionEvents?.length) {
    const workKey = generateMeasurementWorkKey(companyId, plan.id, 'conversion_events');
    tasks.push({
      title: 'Set up conversion tracking events',
      notes: `**Conversion Events to Track:**\n${measurement.conversionEvents.map((e) => `- ${e}`).join('\n')}\n\n**Attribution Model:** ${measurement.attributionModel || 'TBD'}`,
      area: 'Analytics',
      severity: 'High' as WorkItemSeverity,
      source: {
        sourceType: 'heavy_plan',
        planId: plan.id,
        planType: 'media',
        planVersion: plan.version,
        sectionId: 'measurement',
        sectionName: 'Measurement',
        itemIndex: itemIndex++,
        workKey,
        convertedAt: new Date().toISOString(),
      },
    });
  }

  // Reporting dashboard
  if (measurement.reportingCadence) {
    const workKey = generateMeasurementWorkKey(companyId, plan.id, 'reporting_dashboard');
    tasks.push({
      title: 'Build media performance dashboard',
      notes: `**Reporting Cadence:** ${measurement.reportingCadence}\n**Attribution Model:** ${measurement.attributionModel || 'TBD'}`,
      area: 'Analytics',
      severity: 'Medium' as WorkItemSeverity,
      source: {
        sourceType: 'heavy_plan',
        planId: plan.id,
        planType: 'media',
        planVersion: plan.version,
        sectionId: 'measurement',
        sectionName: 'Measurement',
        itemIndex: itemIndex++,
        workKey,
        convertedAt: new Date().toISOString(),
      },
    });
  }

  return tasks;
}

// ============================================================================
// Cadence → Work Items
// ============================================================================

/**
 * Convert cadence section to operational tasks
 */
export function mapCadenceToWorkItems(
  plan: MediaPlan,
  companyId: string
): ConvertedWorkItem[] {
  const { cadence } = plan.sections;
  if (!cadence) return [];

  const tasks: ConvertedWorkItem[] = [];
  let itemIndex = 0;

  // Weekly operational tasks
  if (cadence.weekly?.length) {
    const workKey = generateCalendarWorkKey(companyId, plan.id, 'weekly', 'weekly_ops');
    tasks.push({
      title: 'Establish weekly media operations cadence',
      notes: `**Weekly Tasks:**\n${cadence.weekly.map((t) => `- ${t}`).join('\n')}`,
      area: 'Operations',
      severity: 'Medium' as WorkItemSeverity,
      source: {
        sourceType: 'heavy_plan',
        planId: plan.id,
        planType: 'media',
        planVersion: plan.version,
        sectionId: 'cadence',
        sectionName: 'Cadence',
        itemIndex: itemIndex++,
        workKey,
        convertedAt: new Date().toISOString(),
      },
    });
  }

  // Monthly operational tasks
  if (cadence.monthly?.length) {
    const workKey = generateCalendarWorkKey(companyId, plan.id, 'monthly', 'monthly_ops');
    tasks.push({
      title: 'Establish monthly media operations cadence',
      notes: `**Monthly Tasks:**\n${cadence.monthly.map((t) => `- ${t}`).join('\n')}`,
      area: 'Operations',
      severity: 'Medium' as WorkItemSeverity,
      source: {
        sourceType: 'heavy_plan',
        planId: plan.id,
        planType: 'media',
        planVersion: plan.version,
        sectionId: 'cadence',
        sectionName: 'Cadence',
        itemIndex: itemIndex++,
        workKey,
        convertedAt: new Date().toISOString(),
      },
    });
  }

  return tasks;
}

// ============================================================================
// Main Conversion Function
// ============================================================================

/**
 * Convert a Media Plan to Work Items
 */
export function convertMediaPlanToWorkItems(
  plan: MediaPlan,
  companyId: string
): MediaPlanConversionResult {
  // Validate plan is approved
  if (plan.status !== 'approved') {
    throw new Error(`Cannot convert plan in status "${plan.status}". Plan must be approved.`);
  }

  const channelTasks = mapChannelMixToWorkItems(plan, companyId);
  const campaignTasks = mapCampaignsToWorkItems(plan, companyId);
  const creativeTasks = mapCampaignsToCreativeTasks(plan, companyId);
  const measurementTasks = mapMeasurementToWorkItems(plan, companyId);
  const cadenceTasks = mapCadenceToWorkItems(plan, companyId);

  return {
    channelTasks,
    campaignTasks,
    creativeTasks,
    measurementTasks,
    cadenceTasks,
    all: [
      ...channelTasks,
      ...campaignTasks,
      ...creativeTasks,
      ...measurementTasks,
      ...cadenceTasks,
    ],
  };
}
