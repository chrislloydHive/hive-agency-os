// lib/media/scenarios.ts
// Scenario Planning Repository
//
// CRUD operations for media scenarios used in strategic planning.
// Scenarios are stored in Airtable and can be:
// - Created from scratch or duplicated from existing
// - Edited with budget and channel mix adjustments
// - Marked as "recommended" for a company
// - Linked to forecast engine outputs

import { getBase } from '@/lib/airtable';
import { AIRTABLE_TABLES } from '@/lib/airtable/tables';
import type {
  MediaScenario,
  MediaScenarioChannelAllocation,
  MediaScenarioGoal,
  MediaScenarioTimeHorizon,
  MediaScenarioForecastSummary,
  CreateMediaScenarioInput,
  UpdateMediaScenarioInput,
} from './types';
import { getDefaultScenarioAllocations } from './types';

// ============================================================================
// Airtable Field Interfaces
// ============================================================================

interface AirtableMediaScenarioFields {
  Company?: string[];
  Name?: string;
  Description?: string;
  'Time Horizon'?: string;
  'Period Label'?: string;
  'Total Budget'?: number;
  Allocations?: string; // JSON string
  Goal?: string; // JSON string
  'Is Recommended'?: boolean;
  'Forecast Summary'?: string; // JSON string
  'Created At'?: string;
  'Updated At'?: string;
}

// ============================================================================
// Mapping Functions
// ============================================================================

function parseTimeHorizon(raw: string | undefined): MediaScenarioTimeHorizon {
  const valid: MediaScenarioTimeHorizon[] = ['month', 'quarter', 'year'];
  const normalized = raw?.toLowerCase() as MediaScenarioTimeHorizon;
  return valid.includes(normalized) ? normalized : 'month';
}

function parseAllocations(raw: string | undefined): MediaScenarioChannelAllocation[] {
  if (!raw) return getDefaultScenarioAllocations();
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
    return getDefaultScenarioAllocations();
  } catch {
    return getDefaultScenarioAllocations();
  }
}

function parseGoal(raw: string | undefined): MediaScenarioGoal | undefined {
  if (!raw) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

function parseForecastSummary(raw: string | undefined): MediaScenarioForecastSummary | undefined {
  if (!raw) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

function mapAirtableToMediaScenario(record: any): MediaScenario {
  const fields = record.fields as AirtableMediaScenarioFields;
  return {
    id: record.id,
    companyId: fields.Company?.[0] || '',
    name: fields.Name || 'Untitled Scenario',
    description: fields.Description || undefined,
    timeHorizon: parseTimeHorizon(fields['Time Horizon']),
    periodLabel: fields['Period Label'] || undefined,
    totalBudget: fields['Total Budget'] ?? 0,
    allocations: parseAllocations(fields.Allocations),
    goal: parseGoal(fields.Goal),
    isRecommended: fields['Is Recommended'] ?? false,
    forecastSummary: parseForecastSummary(fields['Forecast Summary']),
    createdAt: fields['Created At'] || new Date().toISOString(),
    updatedAt: fields['Updated At'] || new Date().toISOString(),
  };
}

// ============================================================================
// Query Functions
// ============================================================================

/**
 * Get all scenarios for a company
 */
export async function getMediaScenariosForCompany(companyId: string): Promise<MediaScenario[]> {
  try {
    const base = getBase();
    const records = await base(AIRTABLE_TABLES.MEDIA_SCENARIOS)
      .select({
        filterByFormula: `SEARCH("${companyId}", ARRAYJOIN({Company}))`,
        sort: [
          { field: 'Is Recommended', direction: 'desc' },
          { field: 'Updated At', direction: 'desc' },
        ],
      })
      .all();

    return records.map(mapAirtableToMediaScenario);
  } catch (error: any) {
    const errorMessage = error?.message || error?.error || String(error);
    if (!errorMessage.includes('Could not find table') && !errorMessage.includes('NOT_FOUND')) {
      console.error(`[Scenarios] Failed to fetch scenarios for company ${companyId}:`, errorMessage);
    }
    return [];
  }
}

/**
 * Get a single scenario by ID
 */
export async function getMediaScenarioById(
  companyId: string,
  scenarioId: string
): Promise<MediaScenario | null> {
  try {
    const base = getBase();
    const record = await base(AIRTABLE_TABLES.MEDIA_SCENARIOS).find(scenarioId);
    const scenario = mapAirtableToMediaScenario(record);

    // Verify it belongs to the company
    if (scenario.companyId !== companyId) {
      console.warn(`[Scenarios] Scenario ${scenarioId} does not belong to company ${companyId}`);
      return null;
    }

    return scenario;
  } catch (error) {
    console.error(`[Scenarios] Failed to fetch scenario ${scenarioId}:`, error);
    return null;
  }
}

/**
 * Get the recommended scenario for a company (if any)
 */
export async function getRecommendedScenario(companyId: string): Promise<MediaScenario | null> {
  try {
    const base = getBase();
    const records = await base(AIRTABLE_TABLES.MEDIA_SCENARIOS)
      .select({
        filterByFormula: `AND(
          SEARCH("${companyId}", ARRAYJOIN({Company})),
          {Is Recommended} = TRUE()
        )`,
        maxRecords: 1,
      })
      .all();

    if (records.length === 0) return null;
    return mapAirtableToMediaScenario(records[0]);
  } catch (error) {
    console.error(`[Scenarios] Failed to fetch recommended scenario for company ${companyId}:`, error);
    return null;
  }
}

// ============================================================================
// Create/Update/Delete Functions
// ============================================================================

/**
 * Create a new scenario
 */
export async function createMediaScenario(input: CreateMediaScenarioInput): Promise<MediaScenario> {
  try {
    const base = getBase();
    const now = new Date().toISOString();

    const fields: Record<string, any> = {
      Company: [input.companyId],
      Name: input.name || 'New Scenario',
      'Time Horizon': input.timeHorizon || 'month',
      'Total Budget': input.totalBudget || 0,
      Allocations: JSON.stringify(input.allocations || getDefaultScenarioAllocations()),
      'Is Recommended': false,
      'Created At': now,
      'Updated At': now,
    };

    if (input.description) fields['Description'] = input.description;
    if (input.periodLabel) fields['Period Label'] = input.periodLabel;
    if (input.goal) fields['Goal'] = JSON.stringify(input.goal);

    const records = await base(AIRTABLE_TABLES.MEDIA_SCENARIOS).create([{ fields }]);
    if (records.length === 0) {
      throw new Error('Failed to create scenario record');
    }

    return mapAirtableToMediaScenario(records[0]);
  } catch (error) {
    console.error(`[Scenarios] Failed to create scenario:`, error);
    throw error;
  }
}

/**
 * Update a scenario
 */
export async function updateMediaScenario(
  companyId: string,
  scenarioId: string,
  patch: UpdateMediaScenarioInput
): Promise<MediaScenario> {
  try {
    const base = getBase();
    const now = new Date().toISOString();

    const fields: Record<string, any> = {
      'Updated At': now,
    };

    if (patch.name !== undefined) fields['Name'] = patch.name;
    if (patch.description !== undefined) fields['Description'] = patch.description || null;
    if (patch.timeHorizon !== undefined) fields['Time Horizon'] = patch.timeHorizon;
    if (patch.periodLabel !== undefined) fields['Period Label'] = patch.periodLabel || null;
    if (patch.totalBudget !== undefined) fields['Total Budget'] = patch.totalBudget;
    if (patch.allocations !== undefined) fields['Allocations'] = JSON.stringify(patch.allocations);
    if (patch.goal !== undefined) fields['Goal'] = patch.goal ? JSON.stringify(patch.goal) : null;
    if (patch.isRecommended !== undefined) fields['Is Recommended'] = patch.isRecommended;
    if (patch.forecastSummary !== undefined) {
      fields['Forecast Summary'] = patch.forecastSummary ? JSON.stringify(patch.forecastSummary) : null;
    }

    const record = await base(AIRTABLE_TABLES.MEDIA_SCENARIOS).update(scenarioId, fields);
    const updated = mapAirtableToMediaScenario(record);

    // Verify it belongs to the company
    if (updated.companyId !== companyId) {
      throw new Error(`Scenario ${scenarioId} does not belong to company ${companyId}`);
    }

    return updated;
  } catch (error) {
    console.error(`[Scenarios] Failed to update scenario ${scenarioId}:`, error);
    throw error;
  }
}

/**
 * Set a scenario as recommended (clears previous recommendation)
 */
export async function setRecommendedScenario(
  companyId: string,
  scenarioId: string | null
): Promise<void> {
  try {
    const base = getBase();

    // First, clear any existing recommendations for this company
    const existing = await getMediaScenariosForCompany(companyId);
    const recommendedScenarios = existing.filter(s => s.isRecommended);

    for (const scenario of recommendedScenarios) {
      if (scenario.id !== scenarioId) {
        await base(AIRTABLE_TABLES.MEDIA_SCENARIOS).update(scenario.id, {
          'Is Recommended': false,
          'Updated At': new Date().toISOString(),
        });
      }
    }

    // Set the new recommendation
    if (scenarioId) {
      await base(AIRTABLE_TABLES.MEDIA_SCENARIOS).update(scenarioId, {
        'Is Recommended': true,
        'Updated At': new Date().toISOString(),
      });
    }
  } catch (error) {
    console.error(`[Scenarios] Failed to set recommended scenario:`, error);
    throw error;
  }
}

/**
 * Delete a scenario
 */
export async function deleteMediaScenario(
  companyId: string,
  scenarioId: string
): Promise<boolean> {
  try {
    // Verify it belongs to the company first
    const scenario = await getMediaScenarioById(companyId, scenarioId);
    if (!scenario) {
      throw new Error(`Scenario ${scenarioId} not found or does not belong to company ${companyId}`);
    }

    const base = getBase();
    await base(AIRTABLE_TABLES.MEDIA_SCENARIOS).destroy([scenarioId]);
    return true;
  } catch (error) {
    console.error(`[Scenarios] Failed to delete scenario ${scenarioId}:`, error);
    throw error;
  }
}

/**
 * Duplicate a scenario
 */
export async function duplicateMediaScenario(
  companyId: string,
  scenarioId: string,
  newName?: string
): Promise<MediaScenario> {
  try {
    const original = await getMediaScenarioById(companyId, scenarioId);
    if (!original) {
      throw new Error(`Scenario ${scenarioId} not found`);
    }

    return createMediaScenario({
      companyId,
      name: newName || `${original.name} (Copy)`,
      description: original.description,
      timeHorizon: original.timeHorizon,
      periodLabel: original.periodLabel,
      totalBudget: original.totalBudget,
      allocations: original.allocations.map(a => ({
        ...a,
        id: `alloc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      })),
      goal: original.goal,
    });
  } catch (error) {
    console.error(`[Scenarios] Failed to duplicate scenario ${scenarioId}:`, error);
    throw error;
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a scenario from current media plan
 */
export async function createScenarioFromMediaPlan(
  companyId: string,
  planId: string,
  name?: string
): Promise<MediaScenario> {
  // Import here to avoid circular dependencies
  const { getMediaPlanWithDetails } = await import('@/lib/airtable/mediaLab');

  const plan = await getMediaPlanWithDetails(planId);
  if (!plan) {
    throw new Error(`Media plan ${planId} not found`);
  }

  // Convert plan channels to scenario allocations
  const allocations: MediaScenarioChannelAllocation[] = plan.channels.map(channel => ({
    id: `alloc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    channel: channelKeyToMediaChannel(channel.channel),
    provider: channel.provider || undefined,
    label: getChannelLabel(channel.channel, channel.provider),
    plannedSpend: channel.budgetAmount || 0,
    isLocked: false,
  }));

  return createMediaScenario({
    companyId,
    name: name || `${plan.name} Scenario`,
    description: `Created from media plan: ${plan.name}`,
    timeHorizon: 'month',
    totalBudget: plan.totalBudget || 0,
    allocations: allocations.length > 0 ? allocations : getDefaultScenarioAllocations(),
  });
}

// Channel key to MediaChannel mapping
function channelKeyToMediaChannel(key: string): import('./types').MediaChannel {
  const mapping: Record<string, import('./types').MediaChannel> = {
    google_search: 'search',
    google_lsas: 'lsa',
    google_maps_gbp: 'maps',
    google_youtube: 'youtube',
    google_display: 'display',
    paid_social_meta: 'social',
    microsoft_search: 'microsoft_search',
    tiktok_social: 'tiktok',
    display_retarg: 'display',
    email_marketing: 'email',
    affiliate: 'affiliate',
    radio: 'radio',
    tv: 'tv',
    streaming_audio: 'streaming_audio',
    out_of_home: 'out_of_home',
    print: 'print',
    direct_mail: 'direct_mail',
    other: 'search', // fallback
  };
  return mapping[key] || 'search';
}

// Get display label for channel/provider combo
function getChannelLabel(channelKey: string, provider?: string): string {
  const labels: Record<string, string> = {
    google_search: 'Google Search',
    google_lsas: 'Local Services Ads',
    google_maps_gbp: 'Google Maps / GBP',
    google_youtube: 'YouTube Ads',
    google_display: 'Google Display',
    paid_social_meta: 'Meta Social',
    microsoft_search: 'Microsoft/Bing Search',
    tiktok_social: 'TikTok Ads',
    display_retarg: 'Display / Retargeting',
    email_marketing: 'Email Marketing',
    affiliate: 'Affiliate',
    radio: 'Radio',
    tv: 'Television',
    streaming_audio: 'Streaming Audio',
    out_of_home: 'Out-of-Home',
    print: 'Print',
    direct_mail: 'Direct Mail',
    other: 'Other',
  };
  return labels[channelKey] || channelKey;
}
