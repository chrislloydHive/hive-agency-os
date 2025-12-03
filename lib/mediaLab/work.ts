// lib/mediaLab/work.ts
// Generate Work Items from Media Plans
//
// This module maps media plan data to actionable work items
// for the Work system.

import { base } from '@/lib/airtable/client';
import type { MediaPlanWithDetails, MediaPlanChannel, MediaPlanFlight } from '@/lib/types/mediaLab';
import { getChannelLabel, getObjectiveLabel, getSeasonLabel, formatMediaBudget } from '@/lib/types/mediaLab';
import type { WorkItemRecord, WorkItemArea, WorkItemStatus, WorkItemSeverity } from '@/lib/airtable/workItems';

// ============================================================================
// Types
// ============================================================================

interface GeneratedWorkItem {
  title: string;
  notes: string;
  area: WorkItemArea;
  severity: WorkItemSeverity;
  source: {
    sourceType: 'media_plan';
    mediaPlanId: string;
    mediaPlanName: string;
    flightId?: string;
    flightName?: string;
  };
}

interface GenerateWorkResult {
  count: number;
  workItems: WorkItemRecord[];
}

// ============================================================================
// Work Item Generation Logic
// ============================================================================

/**
 * Generate work items from a media plan
 *
 * Creates work items for:
 * 1. Main campaign setup (objective + markets + core channels)
 * 2. Tracking & attribution setup
 * 3. Each seasonal flight
 */
export function generateWorkItemsFromPlan(plan: MediaPlanWithDetails): GeneratedWorkItem[] {
  const workItems: GeneratedWorkItem[] = [];

  // Get core channels
  const coreChannels = plan.channels.filter(c => c.priority === 'core');
  const coreChannelNames = coreChannels.map(c => getChannelLabel(c.channel)).join(', ');

  // 1. Main Campaign Setup
  if (coreChannels.length > 0 || plan.primaryMarkets) {
    const objectiveLabel = getObjectiveLabel(plan.objective);
    const markets = plan.primaryMarkets || 'all markets';

    workItems.push({
      title: `Set up ${objectiveLabel.toLowerCase()} campaigns for ${plan.name}`,
      notes: buildCampaignSetupNotes(plan, coreChannels),
      area: 'Funnel',
      severity: 'High',
      source: {
        sourceType: 'media_plan',
        mediaPlanId: plan.id,
        mediaPlanName: plan.name,
      },
    });
  }

  // 2. Tracking & Attribution
  if (plan.status === 'active' || plan.status === 'proposed') {
    workItems.push({
      title: `Implement tracking & attribution for ${plan.name}`,
      notes: buildTrackingNotes(plan),
      area: 'Analytics',
      severity: 'High',
      source: {
        sourceType: 'media_plan',
        mediaPlanId: plan.id,
        mediaPlanName: plan.name,
      },
    });
  }

  // 3. Seasonal Flights
  for (const flight of plan.flights) {
    workItems.push({
      title: `Build and activate seasonal flight: ${flight.name}`,
      notes: buildFlightNotes(plan, flight),
      area: 'Funnel',
      severity: 'Medium',
      source: {
        sourceType: 'media_plan',
        mediaPlanId: plan.id,
        mediaPlanName: plan.name,
        flightId: flight.id,
        flightName: flight.name,
      },
    });
  }

  // 4. Channel-specific setup for supporting/experimental channels
  const supportingChannels = plan.channels.filter(c => c.priority === 'supporting' || c.priority === 'experimental');
  for (const channel of supportingChannels) {
    const priorityLabel = channel.priority === 'supporting' ? 'supporting' : 'experimental';
    workItems.push({
      title: `Set up ${priorityLabel} channel: ${getChannelLabel(channel.channel)}`,
      notes: buildChannelNotes(plan, channel),
      area: 'Funnel',
      severity: channel.priority === 'supporting' ? 'Medium' : 'Low',
      source: {
        sourceType: 'media_plan',
        mediaPlanId: plan.id,
        mediaPlanName: plan.name,
      },
    });
  }

  return workItems;
}

function buildCampaignSetupNotes(plan: MediaPlanWithDetails, coreChannels: MediaPlanChannel[]): string {
  const parts: string[] = [];

  parts.push(`**Media Plan:** ${plan.name}`);
  parts.push(`**Objective:** ${getObjectiveLabel(plan.objective)}`);

  if (plan.primaryMarkets) {
    parts.push(`**Markets:** ${plan.primaryMarkets}`);
  }

  if (plan.totalBudget) {
    parts.push(`**Total Budget:** ${formatMediaBudget(plan.totalBudget)}`);
  }

  if (coreChannels.length > 0) {
    parts.push('');
    parts.push('**Core Channels:**');
    for (const ch of coreChannels) {
      const budgetInfo = ch.budgetAmount ? ` (${formatMediaBudget(ch.budgetAmount)})` : '';
      parts.push(`- ${getChannelLabel(ch.channel)}${budgetInfo}`);
    }
  }

  if (plan.notes) {
    parts.push('');
    parts.push('**Strategy Notes:**');
    parts.push(plan.notes);
  }

  return parts.join('\n');
}

function buildTrackingNotes(plan: MediaPlanWithDetails): string {
  const parts: string[] = [];

  parts.push(`**Media Plan:** ${plan.name}`);
  parts.push(`**Objective:** ${getObjectiveLabel(plan.objective)}`);
  parts.push('');
  parts.push('**Required tracking setup:**');
  parts.push('- [ ] Verify GA4 conversion events for objective');
  parts.push('- [ ] Set up UTM parameters for all channels');
  parts.push('- [ ] Configure call tracking (if calls objective)');
  parts.push('- [ ] Set up store visit attribution (if store_visits objective)');
  parts.push('- [ ] Create campaign dashboards');

  if (plan.channels.length > 0) {
    parts.push('');
    parts.push('**Channels to track:**');
    for (const ch of plan.channels) {
      parts.push(`- ${getChannelLabel(ch.channel)}`);
    }
  }

  return parts.join('\n');
}

function buildFlightNotes(plan: MediaPlanWithDetails, flight: MediaPlanFlight): string {
  const parts: string[] = [];

  parts.push(`**Flight:** ${flight.name}`);

  if (flight.season) {
    parts.push(`**Season:** ${getSeasonLabel(flight.season)}`);
  }

  if (flight.startDate || flight.endDate) {
    const start = flight.startDate || 'TBD';
    const end = flight.endDate || 'TBD';
    parts.push(`**Dates:** ${start} to ${end}`);
  }

  if (flight.budget) {
    parts.push(`**Budget:** ${formatMediaBudget(flight.budget)}`);
  }

  if (flight.primaryChannels.length > 0) {
    parts.push('');
    parts.push('**Channels:**');
    for (const ch of flight.primaryChannels) {
      parts.push(`- ${getChannelLabel(ch)}`);
    }
  }

  if (flight.marketsStores) {
    parts.push('');
    parts.push(`**Markets/Stores:** ${flight.marketsStores}`);
  }

  if (flight.notes) {
    parts.push('');
    parts.push('**Notes:**');
    parts.push(flight.notes);
  }

  return parts.join('\n');
}

function buildChannelNotes(plan: MediaPlanWithDetails, channel: MediaPlanChannel): string {
  const parts: string[] = [];

  parts.push(`**Channel:** ${getChannelLabel(channel.channel)}`);
  parts.push(`**Priority:** ${channel.priority || 'Not set'}`);

  if (channel.budgetAmount) {
    parts.push(`**Budget:** ${formatMediaBudget(channel.budgetAmount)}`);
  }

  if (channel.budgetSharePct) {
    parts.push(`**Budget Share:** ${channel.budgetSharePct}%`);
  }

  if (channel.expectedVolume) {
    parts.push(`**Expected Volume:** ${channel.expectedVolume.toLocaleString()}`);
  }

  if (channel.expectedCpl) {
    parts.push(`**Expected CPL:** ${formatMediaBudget(channel.expectedCpl)}`);
  }

  if (channel.notes) {
    parts.push('');
    parts.push('**Notes:**');
    parts.push(channel.notes);
  }

  return parts.join('\n');
}

// ============================================================================
// Airtable Integration
// ============================================================================

/**
 * Create work items in Airtable from a media plan
 */
export async function generateWorkItemsFromMediaPlan(
  companyId: string,
  plan: MediaPlanWithDetails
): Promise<GenerateWorkResult> {
  // Generate work item definitions
  const workItemDefs = generateWorkItemsFromPlan(plan);

  if (workItemDefs.length === 0) {
    return { count: 0, workItems: [] };
  }

  // Create records in Airtable
  const records = await base('Work Items').create(
    workItemDefs.map(item => ({
      fields: {
        Title: item.title,
        Company: [companyId],
        Area: item.area,
        Status: 'Backlog' as WorkItemStatus,
        Severity: item.severity,
        Notes: item.notes,
        'Source JSON': JSON.stringify(item.source),
      },
    }))
  );

  // Map to WorkItemRecord
  const workItems: WorkItemRecord[] = records.map(record => ({
    id: record.id,
    companyId,
    title: record.fields['Title'] as string,
    area: record.fields['Area'] as WorkItemArea,
    status: record.fields['Status'] as WorkItemStatus,
    severity: record.fields['Severity'] as WorkItemSeverity,
    notes: record.fields['Notes'] as string | undefined,
    source: workItemDefs.find(d => d.title === record.fields['Title'])?.source as any,
  }));

  return {
    count: workItems.length,
    workItems,
  };
}
