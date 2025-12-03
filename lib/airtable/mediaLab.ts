// lib/airtable/mediaLab.ts
// Airtable helpers for Media Lab tables
//
// Tables:
// - MediaPlans: Strategic media plans per company
// - MediaPlanChannels: Channel mix/budget allocation per plan
// - MediaPlanFlights: Seasonal campaign flights per plan

import { getBase } from '@/lib/airtable';
import { AIRTABLE_TABLES } from './tables';
import type {
  MediaPlan,
  MediaPlanChannel,
  MediaPlanFlight,
  MediaPlanWithDetails,
  MediaChannelKey,
  MediaPlanStatus,
  MediaObjective,
  MediaChannelPriority,
  MediaFlightSeason,
} from '@/lib/types/mediaLab';

// ============================================================================
// Airtable Field Interfaces
// ============================================================================

interface AirtableMediaPlanFields {
  Company?: string[]; // Linked record to Companies
  Name?: string;
  Status?: string;
  Objective?: string;
  'Timeframe Start'?: string;
  'Timeframe End'?: string;
  'Total Budget'?: number;
  'Primary Markets'?: string;
  'Has Seasonal Flights'?: boolean;
  Notes?: string;
  'Created At'?: string;
  'Updated At'?: string;
}

interface AirtableMediaPlanChannelFields {
  'Media Plan'?: string[]; // Linked record to MediaPlans
  Channel?: string;
  '% of Budget'?: number;
  '$ Budget'?: number;
  'Expected Installs / Leads'?: number;
  'Expected CPL / CPI'?: number;
  Priority?: string;
  Notes?: string;
}

interface AirtableMediaPlanFlightFields {
  'Media Plan'?: string[]; // Linked record to MediaPlans
  Name?: string;
  Season?: string;
  'Start Date'?: string;
  'End Date'?: string;
  Budget?: number;
  'Primary Channels'?: string[]; // Multi-select
  'Markets / Stores'?: string;
  Notes?: string;
}

// ============================================================================
// Mapping Functions
// ============================================================================

function parseChannelKey(raw: string | undefined): MediaChannelKey {
  const normalized = raw?.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z_]/g, '') || 'other';
  const validKeys: MediaChannelKey[] = [
    'google_search',
    'google_lsas',
    'google_maps_gbp',
    'paid_social_meta',
    'display_retarg',
    'radio',
    'other',
  ];
  return validKeys.includes(normalized as MediaChannelKey) ? (normalized as MediaChannelKey) : 'other';
}

function parsePlanStatus(raw: string | undefined): MediaPlanStatus {
  const normalized = raw?.toLowerCase() || 'draft';
  const validStatuses: MediaPlanStatus[] = ['draft', 'proposed', 'active', 'paused', 'archived'];
  return validStatuses.includes(normalized as MediaPlanStatus) ? (normalized as MediaPlanStatus) : 'draft';
}

function parseObjective(raw: string | undefined): MediaObjective {
  const normalized = raw?.toLowerCase().replace(/\s+/g, '_') || 'leads';
  const validObjectives: MediaObjective[] = ['installs', 'leads', 'store_visits', 'calls', 'awareness'];
  return validObjectives.includes(normalized as MediaObjective) ? (normalized as MediaObjective) : 'leads';
}

function parsePriority(raw: string | undefined): MediaChannelPriority | null {
  if (!raw) return null;
  const normalized = raw.toLowerCase();
  const validPriorities: MediaChannelPriority[] = ['core', 'supporting', 'experimental'];
  return validPriorities.includes(normalized as MediaChannelPriority) ? (normalized as MediaChannelPriority) : null;
}

function parseSeason(raw: string | undefined): MediaFlightSeason | null {
  if (!raw) return null;
  const normalized = raw.toLowerCase().replace(/\s+/g, '_');
  const validSeasons: MediaFlightSeason[] = ['remote_start', 'holiday', 'carplay_season', 'summer_audio', 'other'];
  return validSeasons.includes(normalized as MediaFlightSeason) ? (normalized as MediaFlightSeason) : 'other';
}

function parseChannelArray(raw: string[] | undefined): MediaChannelKey[] {
  if (!raw || !Array.isArray(raw)) return [];
  return raw.map(parseChannelKey);
}

function mapAirtableToMediaPlan(record: any): MediaPlan {
  const fields = record.fields as AirtableMediaPlanFields;
  return {
    id: record.id,
    companyId: fields.Company?.[0] || '',
    name: fields.Name || 'Untitled Plan',
    status: parsePlanStatus(fields.Status),
    objective: parseObjective(fields.Objective),
    timeframeStart: fields['Timeframe Start'] || null,
    timeframeEnd: fields['Timeframe End'] || null,
    totalBudget: fields['Total Budget'] ?? null,
    primaryMarkets: fields['Primary Markets'] || null,
    hasSeasonalFlights: fields['Has Seasonal Flights'] ?? false,
    notes: fields.Notes || null,
    createdAt: fields['Created At'] || null,
    updatedAt: fields['Updated At'] || null,
  };
}

function mapAirtableToMediaPlanChannel(record: any): MediaPlanChannel {
  const fields = record.fields as AirtableMediaPlanChannelFields;
  return {
    id: record.id,
    mediaPlanId: fields['Media Plan']?.[0] || '',
    channel: parseChannelKey(fields.Channel),
    budgetSharePct: fields['% of Budget'] ?? null,
    budgetAmount: fields['$ Budget'] ?? null,
    expectedVolume: fields['Expected Installs / Leads'] ?? null,
    expectedCpl: fields['Expected CPL / CPI'] ?? null,
    priority: parsePriority(fields.Priority),
    notes: fields.Notes || null,
  };
}

function mapAirtableToMediaPlanFlight(record: any): MediaPlanFlight {
  const fields = record.fields as AirtableMediaPlanFlightFields;
  return {
    id: record.id,
    mediaPlanId: fields['Media Plan']?.[0] || '',
    name: fields.Name || 'Untitled Flight',
    season: parseSeason(fields.Season),
    startDate: fields['Start Date'] || null,
    endDate: fields['End Date'] || null,
    budget: fields.Budget ?? null,
    primaryChannels: parseChannelArray(fields['Primary Channels']),
    marketsStores: fields['Markets / Stores'] || null,
    notes: fields.Notes || null,
  };
}

// ============================================================================
// Query Functions - MediaPlans
// ============================================================================

/**
 * Get all media plans for a company
 */
export async function getMediaPlansForCompany(companyId: string): Promise<MediaPlan[]> {
  try {
    const base = getBase();
    const records = await base(AIRTABLE_TABLES.MEDIA_PLANS)
      .select({
        filterByFormula: `SEARCH("${companyId}", ARRAYJOIN({Company}))`,
        sort: [{ field: 'Created At', direction: 'desc' }],
      })
      .all();

    return records.map(mapAirtableToMediaPlan);
  } catch (error: any) {
    // Only log if it's not a "table doesn't exist" error (expected for new setups)
    const errorMessage = error?.message || error?.error || String(error);
    if (!errorMessage.includes('Could not find table') && !errorMessage.includes('NOT_FOUND')) {
      console.error(`[MediaLab] Failed to fetch media plans for company ${companyId}:`, errorMessage);
    }
    return [];
  }
}

/**
 * Get a single media plan by ID
 */
export async function getMediaPlanById(planId: string): Promise<MediaPlan | null> {
  try {
    const base = getBase();
    const record = await base(AIRTABLE_TABLES.MEDIA_PLANS).find(planId);
    return mapAirtableToMediaPlan(record);
  } catch (error) {
    console.error(`[MediaLab] Failed to fetch media plan ${planId}:`, error);
    return null;
  }
}

/**
 * Get active media plans for a company
 */
export async function getActiveMediaPlansForCompany(companyId: string): Promise<MediaPlan[]> {
  try {
    const base = getBase();
    const records = await base(AIRTABLE_TABLES.MEDIA_PLANS)
      .select({
        filterByFormula: `AND(
          SEARCH("${companyId}", ARRAYJOIN({Company})),
          {Status} = "active"
        )`,
        sort: [{ field: 'Created At', direction: 'desc' }],
      })
      .all();

    return records.map(mapAirtableToMediaPlan);
  } catch (error) {
    console.error(`[MediaLab] Failed to fetch active media plans for company ${companyId}:`, error);
    return [];
  }
}

// ============================================================================
// Query Functions - MediaPlanChannels
// ============================================================================

/**
 * Get all channels for a media plan
 */
export async function getChannelsForMediaPlan(planId: string): Promise<MediaPlanChannel[]> {
  try {
    const base = getBase();
    const records = await base(AIRTABLE_TABLES.MEDIA_PLAN_CHANNELS)
      .select({
        filterByFormula: `SEARCH("${planId}", ARRAYJOIN({Media Plan}))`,
        sort: [{ field: '% of Budget', direction: 'desc' }],
      })
      .all();

    return records.map(mapAirtableToMediaPlanChannel);
  } catch (error) {
    console.error(`[MediaLab] Failed to fetch channels for plan ${planId}:`, error);
    return [];
  }
}

/**
 * Get channels for multiple media plans (batch)
 */
export async function getChannelsForMediaPlans(planIds: string[]): Promise<Map<string, MediaPlanChannel[]>> {
  if (planIds.length === 0) return new Map();

  try {
    const base = getBase();
    // Fetch all channels, filter client-side (more efficient for small datasets)
    const records = await base(AIRTABLE_TABLES.MEDIA_PLAN_CHANNELS)
      .select({
        sort: [{ field: '% of Budget', direction: 'desc' }],
      })
      .all();

    const channels = records.map(mapAirtableToMediaPlanChannel);
    const planIdSet = new Set(planIds);

    // Group by plan ID
    const result = new Map<string, MediaPlanChannel[]>();
    for (const channel of channels) {
      if (planIdSet.has(channel.mediaPlanId)) {
        const existing = result.get(channel.mediaPlanId) || [];
        existing.push(channel);
        result.set(channel.mediaPlanId, existing);
      }
    }

    return result;
  } catch (error) {
    console.error(`[MediaLab] Failed to fetch channels for plans:`, error);
    return new Map();
  }
}

// ============================================================================
// Query Functions - MediaPlanFlights
// ============================================================================

/**
 * Get all flights for a media plan
 */
export async function getFlightsForMediaPlan(planId: string): Promise<MediaPlanFlight[]> {
  try {
    const base = getBase();
    const records = await base(AIRTABLE_TABLES.MEDIA_PLAN_FLIGHTS)
      .select({
        filterByFormula: `SEARCH("${planId}", ARRAYJOIN({Media Plan}))`,
        sort: [{ field: 'Start Date', direction: 'asc' }],
      })
      .all();

    return records.map(mapAirtableToMediaPlanFlight);
  } catch (error) {
    console.error(`[MediaLab] Failed to fetch flights for plan ${planId}:`, error);
    return [];
  }
}

/**
 * Get flights for multiple media plans (batch)
 */
export async function getFlightsForMediaPlans(planIds: string[]): Promise<Map<string, MediaPlanFlight[]>> {
  if (planIds.length === 0) return new Map();

  try {
    const base = getBase();
    const records = await base(AIRTABLE_TABLES.MEDIA_PLAN_FLIGHTS)
      .select({
        sort: [{ field: 'Start Date', direction: 'asc' }],
      })
      .all();

    const flights = records.map(mapAirtableToMediaPlanFlight);
    const planIdSet = new Set(planIds);

    const result = new Map<string, MediaPlanFlight[]>();
    for (const flight of flights) {
      if (planIdSet.has(flight.mediaPlanId)) {
        const existing = result.get(flight.mediaPlanId) || [];
        existing.push(flight);
        result.set(flight.mediaPlanId, existing);
      }
    }

    return result;
  } catch (error) {
    console.error(`[MediaLab] Failed to fetch flights for plans:`, error);
    return new Map();
  }
}

// ============================================================================
// Combined Query Functions
// ============================================================================

/**
 * Get a media plan with all its channels and flights
 */
export async function getMediaPlanWithDetails(planId: string): Promise<MediaPlanWithDetails | null> {
  const [plan, channels, flights] = await Promise.all([
    getMediaPlanById(planId),
    getChannelsForMediaPlan(planId),
    getFlightsForMediaPlan(planId),
  ]);

  if (!plan) return null;

  return {
    ...plan,
    channels,
    flights,
  };
}

/**
 * Get all media plans for a company with channels and flights
 */
export async function getMediaPlansWithDetailsForCompany(companyId: string): Promise<MediaPlanWithDetails[]> {
  // First get all plans
  const plans = await getMediaPlansForCompany(companyId);
  if (plans.length === 0) return [];

  // Get all channels and flights in batch
  const planIds = plans.map(p => p.id);
  const [channelsMap, flightsMap] = await Promise.all([
    getChannelsForMediaPlans(planIds),
    getFlightsForMediaPlans(planIds),
  ]);

  // Combine
  return plans.map(plan => ({
    ...plan,
    channels: channelsMap.get(plan.id) || [],
    flights: flightsMap.get(plan.id) || [],
  }));
}

// ============================================================================
// Create/Update/Delete Functions - MediaPlans
// ============================================================================

export interface CreateMediaPlanInput {
  companyId: string;
  name?: string;
  status?: MediaPlanStatus;
  objective?: MediaObjective;
  timeframeStart?: string | null;
  timeframeEnd?: string | null;
  totalBudget?: number | null;
  primaryMarkets?: string | null;
  hasSeasonalFlights?: boolean;
  notes?: string | null;
}

export interface UpdateMediaPlanInput {
  name?: string;
  status?: MediaPlanStatus;
  objective?: MediaObjective;
  timeframeStart?: string | null;
  timeframeEnd?: string | null;
  totalBudget?: number | null;
  primaryMarkets?: string | null;
  hasSeasonalFlights?: boolean;
  notes?: string | null;
}

/**
 * Create a new media plan
 */
export async function createMediaPlan(input: CreateMediaPlanInput): Promise<MediaPlan | null> {
  try {
    const base = getBase();
    const fields: Record<string, any> = {
      Company: [input.companyId],
      Name: input.name || 'New Media Plan',
      Status: input.status || 'draft',
      Objective: input.objective || 'installs',
    };

    if (input.timeframeStart) fields['Timeframe Start'] = input.timeframeStart;
    if (input.timeframeEnd) fields['Timeframe End'] = input.timeframeEnd;
    if (input.totalBudget != null) fields['Total Budget'] = input.totalBudget;
    if (input.primaryMarkets) fields['Primary Markets'] = input.primaryMarkets;
    if (input.hasSeasonalFlights != null) fields['Has Seasonal Flights'] = input.hasSeasonalFlights;
    if (input.notes) fields['Notes'] = input.notes;

    const records = await base(AIRTABLE_TABLES.MEDIA_PLANS).create([{ fields }]);
    if (records.length === 0) return null;
    return mapAirtableToMediaPlan(records[0]);
  } catch (error) {
    console.error(`[MediaLab] Failed to create media plan:`, error);
    throw error;
  }
}

/**
 * Create a new draft media plan (convenience wrapper)
 */
export async function createDraftMediaPlan(
  companyId: string,
  name: string = 'New Media Plan'
): Promise<MediaPlan | null> {
  return createMediaPlan({
    companyId,
    name,
    status: 'draft',
    objective: 'installs',
  });
}

/**
 * Update a media plan
 */
export async function updateMediaPlan(
  planId: string,
  input: UpdateMediaPlanInput
): Promise<MediaPlan | null> {
  try {
    const base = getBase();
    const fields: Record<string, any> = {};

    if (input.name !== undefined) fields['Name'] = input.name;
    if (input.status !== undefined) fields['Status'] = input.status;
    if (input.objective !== undefined) fields['Objective'] = input.objective;
    if (input.timeframeStart !== undefined) fields['Timeframe Start'] = input.timeframeStart || null;
    if (input.timeframeEnd !== undefined) fields['Timeframe End'] = input.timeframeEnd || null;
    if (input.totalBudget !== undefined) fields['Total Budget'] = input.totalBudget;
    if (input.primaryMarkets !== undefined) fields['Primary Markets'] = input.primaryMarkets || null;
    if (input.hasSeasonalFlights !== undefined) fields['Has Seasonal Flights'] = input.hasSeasonalFlights;
    if (input.notes !== undefined) fields['Notes'] = input.notes || null;

    const record = await base(AIRTABLE_TABLES.MEDIA_PLANS).update(planId, fields);
    return mapAirtableToMediaPlan(record);
  } catch (error) {
    console.error(`[MediaLab] Failed to update media plan ${planId}:`, error);
    throw error;
  }
}

/**
 * Update media plan status (convenience wrapper)
 */
export async function updateMediaPlanStatus(
  planId: string,
  status: MediaPlanStatus
): Promise<MediaPlan | null> {
  return updateMediaPlan(planId, { status });
}

/**
 * Delete a media plan and all its channels/flights
 */
export async function deleteMediaPlan(planId: string): Promise<boolean> {
  try {
    const base = getBase();

    // First delete all channels and flights
    const [channels, flights] = await Promise.all([
      getChannelsForMediaPlan(planId),
      getFlightsForMediaPlan(planId),
    ]);

    if (channels.length > 0) {
      await base(AIRTABLE_TABLES.MEDIA_PLAN_CHANNELS).destroy(channels.map(c => c.id));
    }
    if (flights.length > 0) {
      await base(AIRTABLE_TABLES.MEDIA_PLAN_FLIGHTS).destroy(flights.map(f => f.id));
    }

    // Then delete the plan
    await base(AIRTABLE_TABLES.MEDIA_PLANS).destroy([planId]);
    return true;
  } catch (error) {
    console.error(`[MediaLab] Failed to delete media plan ${planId}:`, error);
    throw error;
  }
}

// ============================================================================
// Create/Update/Delete Functions - MediaPlanChannels
// ============================================================================

export interface CreateMediaPlanChannelInput {
  mediaPlanId: string;
  channel?: MediaChannelKey;
  budgetSharePct?: number | null;
  budgetAmount?: number | null;
  expectedVolume?: number | null;
  expectedCpl?: number | null;
  priority?: MediaChannelPriority | null;
  notes?: string | null;
}

export interface UpdateMediaPlanChannelInput {
  channel?: MediaChannelKey;
  budgetSharePct?: number | null;
  budgetAmount?: number | null;
  expectedVolume?: number | null;
  expectedCpl?: number | null;
  priority?: MediaChannelPriority | null;
  notes?: string | null;
}

/**
 * Create a new channel for a media plan
 */
export async function createMediaPlanChannel(input: CreateMediaPlanChannelInput): Promise<MediaPlanChannel | null> {
  try {
    const base = getBase();
    const fields: Record<string, any> = {
      'Media Plan': [input.mediaPlanId],
      'Channel': input.channel || 'google_search',
      'Priority': input.priority || 'core',
    };

    if (input.budgetSharePct != null) fields['% of Budget'] = input.budgetSharePct;
    if (input.budgetAmount != null) fields['$ Budget'] = input.budgetAmount;
    if (input.expectedVolume != null) fields['Expected Installs / Leads'] = input.expectedVolume;
    if (input.expectedCpl != null) fields['Expected CPL / CPI'] = input.expectedCpl;
    if (input.notes) fields['Notes'] = input.notes;

    const records = await base(AIRTABLE_TABLES.MEDIA_PLAN_CHANNELS).create([{ fields }]);
    if (records.length === 0) return null;
    return mapAirtableToMediaPlanChannel(records[0]);
  } catch (error) {
    console.error(`[MediaLab] Failed to create channel:`, error);
    throw error;
  }
}

/**
 * Update a channel
 */
export async function updateMediaPlanChannel(
  channelId: string,
  input: UpdateMediaPlanChannelInput
): Promise<MediaPlanChannel | null> {
  try {
    const base = getBase();
    const fields: Record<string, any> = {};

    if (input.channel !== undefined) fields['Channel'] = input.channel;
    if (input.budgetSharePct !== undefined) fields['% of Budget'] = input.budgetSharePct;
    if (input.budgetAmount !== undefined) fields['$ Budget'] = input.budgetAmount;
    if (input.expectedVolume !== undefined) fields['Expected Installs / Leads'] = input.expectedVolume;
    if (input.expectedCpl !== undefined) fields['Expected CPL / CPI'] = input.expectedCpl;
    if (input.priority !== undefined) fields['Priority'] = input.priority;
    if (input.notes !== undefined) fields['Notes'] = input.notes || null;

    const record = await base(AIRTABLE_TABLES.MEDIA_PLAN_CHANNELS).update(channelId, fields);
    return mapAirtableToMediaPlanChannel(record);
  } catch (error) {
    console.error(`[MediaLab] Failed to update channel ${channelId}:`, error);
    throw error;
  }
}

/**
 * Delete a channel
 */
export async function deleteMediaPlanChannel(channelId: string): Promise<boolean> {
  try {
    const base = getBase();
    await base(AIRTABLE_TABLES.MEDIA_PLAN_CHANNELS).destroy([channelId]);
    return true;
  } catch (error) {
    console.error(`[MediaLab] Failed to delete channel ${channelId}:`, error);
    throw error;
  }
}

// ============================================================================
// Create/Update/Delete Functions - MediaPlanFlights
// ============================================================================

export interface CreateMediaPlanFlightInput {
  mediaPlanId: string;
  name?: string;
  season?: MediaFlightSeason | null;
  startDate?: string | null;
  endDate?: string | null;
  budget?: number | null;
  primaryChannels?: MediaChannelKey[];
  marketsStores?: string | null;
  notes?: string | null;
}

export interface UpdateMediaPlanFlightInput {
  name?: string;
  season?: MediaFlightSeason | null;
  startDate?: string | null;
  endDate?: string | null;
  budget?: number | null;
  primaryChannels?: MediaChannelKey[];
  marketsStores?: string | null;
  notes?: string | null;
}

/**
 * Create a new flight for a media plan
 */
export async function createMediaPlanFlight(input: CreateMediaPlanFlightInput): Promise<MediaPlanFlight | null> {
  try {
    const base = getBase();
    const fields: Record<string, any> = {
      'Media Plan': [input.mediaPlanId],
      'Name': input.name || 'New Flight',
      'Season': input.season || 'other',
    };

    if (input.startDate) fields['Start Date'] = input.startDate;
    if (input.endDate) fields['End Date'] = input.endDate;
    if (input.budget != null) fields['Budget'] = input.budget;
    if (input.primaryChannels && input.primaryChannels.length > 0) {
      fields['Primary Channels'] = input.primaryChannels;
    }
    if (input.marketsStores) fields['Markets / Stores'] = input.marketsStores;
    if (input.notes) fields['Notes'] = input.notes;

    const records = await base(AIRTABLE_TABLES.MEDIA_PLAN_FLIGHTS).create([{ fields }]);
    if (records.length === 0) return null;
    return mapAirtableToMediaPlanFlight(records[0]);
  } catch (error) {
    console.error(`[MediaLab] Failed to create flight:`, error);
    throw error;
  }
}

/**
 * Update a flight
 */
export async function updateMediaPlanFlight(
  flightId: string,
  input: UpdateMediaPlanFlightInput
): Promise<MediaPlanFlight | null> {
  try {
    const base = getBase();
    const fields: Record<string, any> = {};

    if (input.name !== undefined) fields['Name'] = input.name;
    if (input.season !== undefined) fields['Season'] = input.season;
    if (input.startDate !== undefined) fields['Start Date'] = input.startDate || null;
    if (input.endDate !== undefined) fields['End Date'] = input.endDate || null;
    if (input.budget !== undefined) fields['Budget'] = input.budget;
    if (input.primaryChannels !== undefined) fields['Primary Channels'] = input.primaryChannels;
    if (input.marketsStores !== undefined) fields['Markets / Stores'] = input.marketsStores || null;
    if (input.notes !== undefined) fields['Notes'] = input.notes || null;

    const record = await base(AIRTABLE_TABLES.MEDIA_PLAN_FLIGHTS).update(flightId, fields);
    return mapAirtableToMediaPlanFlight(record);
  } catch (error) {
    console.error(`[MediaLab] Failed to update flight ${flightId}:`, error);
    throw error;
  }
}

/**
 * Delete a flight
 */
export async function deleteMediaPlanFlight(flightId: string): Promise<boolean> {
  try {
    const base = getBase();
    await base(AIRTABLE_TABLES.MEDIA_PLAN_FLIGHTS).destroy([flightId]);
    return true;
  } catch (error) {
    console.error(`[MediaLab] Failed to delete flight ${flightId}:`, error);
    throw error;
  }
}
