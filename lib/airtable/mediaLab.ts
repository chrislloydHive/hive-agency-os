// lib/airtable/mediaLab.ts
// Airtable helpers for Media Lab V1

import { z } from 'zod';
import { getBase } from '@/lib/airtable';
import { AIRTABLE_TABLES } from '@/lib/airtable/tables';
import type {
  MediaPlan,
  MediaPlanChannel,
  MediaPlanFlight,
  MediaChannelKey,
  MediaPlanStatus,
  MediaObjective,
  MediaSeason,
  MediaChannelPriority,
} from '@/lib/media-lab/types';

// ============================================================================
// Zod Schemas for Runtime Validation
// ============================================================================

const MediaPlanSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  name: z.string(),
  status: z.enum(['draft', 'proposed', 'active', 'paused', 'archived']),
  objective: z.enum(['installs', 'leads', 'store_visits', 'calls', 'awareness']),
  timeframeStart: z.string().nullable(),
  timeframeEnd: z.string().nullable(),
  totalBudget: z.number().nullable(),
  primaryMarkets: z.string().nullable(),
  hasSeasonalFlights: z.boolean(),
  notes: z.string().nullable().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

const MediaPlanChannelSchema = z.object({
  id: z.string(),
  mediaPlanId: z.string(),
  channel: z.enum([
    'google_search',
    'google_lsas',
    'google_maps_gbp',
    'paid_social_meta',
    'display_retarg',
    'radio',
    'other',
  ]),
  budgetSharePct: z.number().nullable(),
  budgetAmount: z.number().nullable(),
  expectedVolume: z.number().nullable(),
  expectedCpl: z.number().nullable(),
  priority: z.enum(['core', 'supporting', 'experimental']).nullable(),
  notes: z.string().nullable().optional(),
});

const MediaPlanFlightSchema = z.object({
  id: z.string(),
  mediaPlanId: z.string(),
  name: z.string(),
  season: z.enum(['remote_start', 'holiday', 'carplay_season', 'summer_audio', 'other']).nullable(),
  startDate: z.string().nullable(),
  endDate: z.string().nullable(),
  budget: z.number().nullable(),
  primaryChannels: z.array(
    z.enum([
      'google_search',
      'google_lsas',
      'google_maps_gbp',
      'paid_social_meta',
      'display_retarg',
      'radio',
      'other',
    ])
  ),
  marketsStores: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

// ============================================================================
// Airtable Record Mappers
// ============================================================================

function mapAirtableRecordToMediaPlan(record: any): MediaPlan {
  const fields = record.fields;

  // Get company ID from linked record
  const companyId = Array.isArray(fields['Company']) && fields['Company'].length > 0
    ? fields['Company'][0]
    : '';

  return {
    id: record.id,
    companyId,
    name: fields['Name'] || '',
    status: (fields['Status'] || 'draft') as MediaPlanStatus,
    objective: (fields['Objective'] || 'leads') as MediaObjective,
    timeframeStart: fields['Timeframe Start'] || null,
    timeframeEnd: fields['Timeframe End'] || null,
    totalBudget: fields['Total Budget'] || null,
    primaryMarkets: fields['Primary Markets'] || null,
    hasSeasonalFlights: fields['Has Seasonal Flights'] || false,
    notes: fields['Notes'] || null,
    createdAt: fields['Created At'] || undefined,
    updatedAt: fields['Updated At'] || undefined,
  };
}

function mapAirtableRecordToMediaPlanChannel(record: any): MediaPlanChannel {
  const fields = record.fields;

  // Get media plan ID from linked record
  const mediaPlanId = Array.isArray(fields['Media Plan']) && fields['Media Plan'].length > 0
    ? fields['Media Plan'][0]
    : '';

  return {
    id: record.id,
    mediaPlanId,
    channel: (fields['Channel'] || 'other') as MediaChannelKey,
    budgetSharePct: fields['% of Budget'] || null,
    budgetAmount: fields['$ Budget'] || null,
    expectedVolume: fields['Expected Installs / Leads'] || null,
    expectedCpl: fields['Expected CPL / CPI'] || null,
    priority: (fields['Priority'] || null) as MediaChannelPriority | null,
    notes: fields['Notes'] || null,
  };
}

function mapAirtableRecordToMediaPlanFlight(record: any): MediaPlanFlight {
  const fields = record.fields;

  // Get media plan ID from linked record
  const mediaPlanId = Array.isArray(fields['Media Plan']) && fields['Media Plan'].length > 0
    ? fields['Media Plan'][0]
    : '';

  // Parse primary channels (multi-select)
  const primaryChannels = Array.isArray(fields['Primary Channels'])
    ? fields['Primary Channels'] as MediaChannelKey[]
    : [];

  return {
    id: record.id,
    mediaPlanId,
    name: fields['Name'] || '',
    season: (fields['Season'] || null) as MediaSeason | null,
    startDate: fields['Start Date'] || null,
    endDate: fields['End Date'] || null,
    budget: fields['Budget'] || null,
    primaryChannels,
    marketsStores: fields['Markets / Stores'] || null,
    notes: fields['Notes'] || null,
  };
}

// ============================================================================
// Query Functions
// ============================================================================

/**
 * Get all media plans for a company
 */
export async function getMediaPlansForCompany(companyId: string): Promise<MediaPlan[]> {
  try {
    const base = getBase();
    const records = await base(AIRTABLE_TABLES.MEDIA_PLANS)
      .select({
        filterByFormula: `FIND("${companyId}", ARRAYJOIN({Company}))`,
        sort: [{ field: 'Created At', direction: 'desc' }],
      })
      .all();

    return records.map(mapAirtableRecordToMediaPlan);
  } catch (error) {
    console.error('[getMediaPlansForCompany] Error:', error);
    return [];
  }
}

/**
 * Get a specific media plan by ID
 */
export async function getMediaPlanById(planId: string): Promise<MediaPlan | null> {
  try {
    const base = getBase();
    const record = await base(AIRTABLE_TABLES.MEDIA_PLANS).find(planId);
    return mapAirtableRecordToMediaPlan(record);
  } catch (error) {
    console.error('[getMediaPlanById] Error:', error);
    return null;
  }
}

/**
 * Get all channels for a media plan
 */
export async function getChannelsForMediaPlan(planId: string): Promise<MediaPlanChannel[]> {
  try {
    const base = getBase();
    const records = await base(AIRTABLE_TABLES.MEDIA_PLAN_CHANNELS)
      .select({
        filterByFormula: `FIND("${planId}", ARRAYJOIN({Media Plan}))`,
      })
      .all();

    return records.map(mapAirtableRecordToMediaPlanChannel);
  } catch (error) {
    console.error('[getChannelsForMediaPlan] Error:', error);
    return [];
  }
}

/**
 * Get all flights for a media plan
 */
export async function getFlightsForMediaPlan(planId: string): Promise<MediaPlanFlight[]> {
  try {
    const base = getBase();
    const records = await base(AIRTABLE_TABLES.MEDIA_PLAN_FLIGHTS)
      .select({
        filterByFormula: `FIND("${planId}", ARRAYJOIN({Media Plan}))`,
        sort: [{ field: 'Start Date', direction: 'asc' }],
      })
      .all();

    return records.map(mapAirtableRecordToMediaPlanFlight);
  } catch (error) {
    console.error('[getFlightsForMediaPlan] Error:', error);
    return [];
  }
}

/**
 * Get media fields from Company record
 */
export async function getCompanyMediaFields(companyId: string): Promise<{
  hasMediaProgram: boolean;
  mediaStatus: 'none' | 'planning' | 'running' | 'paused';
  mediaPrimaryObjective: MediaObjective | null;
  mediaNotes: string | null;
}> {
  try {
    const base = getBase();
    const record = await base(AIRTABLE_TABLES.COMPANIES).find(companyId);
    const fields = record.fields;

    return {
      hasMediaProgram: Boolean(fields['Has Media Program']) || false,
      mediaStatus: (String(fields['Media Status'] || 'none')) as 'none' | 'planning' | 'running' | 'paused',
      mediaPrimaryObjective: (fields['Media Primary Objective'] || null) as MediaObjective | null,
      mediaNotes: (fields['Media Notes'] as string) || null,
    };
  } catch (error) {
    console.error('[getCompanyMediaFields] Error:', error);
    return {
      hasMediaProgram: false,
      mediaStatus: 'none',
      mediaPrimaryObjective: null,
      mediaNotes: null,
    };
  }
}

// ============================================================================
// Stub Functions (TODO: Implement when needed)
// ============================================================================

/**
 * Get plans with full details (channels, flights) - stub
 */
export async function getMediaPlansWithDetailsForCompany(companyId: string): Promise<MediaPlan[]> {
  // For now, just return basic plans
  return getMediaPlansForCompany(companyId);
}

/**
 * Get active media plans - stub
 */
export async function getActiveMediaPlansForCompany(companyId: string): Promise<MediaPlan[]> {
  const plans = await getMediaPlansForCompany(companyId);
  return plans.filter(p => p.status === 'active');
}

/**
 * Create draft media plan - stub
 */
export async function createDraftMediaPlan(_companyId: string, _data: { name: string }): Promise<MediaPlan | null> {
  console.warn('[createDraftMediaPlan] Not implemented yet');
  return null;
}

/**
 * Get plan with full details - stub
 */
export async function getMediaPlanWithDetails(planId: string): Promise<MediaPlan | null> {
  return getMediaPlanById(planId);
}

/**
 * Update media plan status - stub
 */
export async function updateMediaPlanStatus(_planId: string, _status: string): Promise<boolean> {
  console.warn('[updateMediaPlanStatus] Not implemented yet');
  return false;
}
