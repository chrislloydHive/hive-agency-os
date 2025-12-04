// lib/media/mediaProfile.ts
// Media Profile System - Company-Agnostic Media Configuration
//
// This module provides a universal media profile layer that any company
// can use to configure their media strategy. Works for B2C, retail, services,
// multi-location, single-location, DTC, or any business model.
//
// Key Features:
// - Company-specific channel requirements and benchmarks
// - Seasonality profiles for demand forecasting
// - Regional/store-level configuration
// - Sensible defaults for companies without custom profiles

import { getBase } from '@/lib/airtable';
import { AIRTABLE_TABLES } from '@/lib/airtable/tables';
import type { MediaChannel } from './types';

// ============================================================================
// Types
// ============================================================================

/**
 * Monthly seasonality multipliers (0.0 - 2.0 typical range)
 * 1.0 = baseline, <1.0 = slower period, >1.0 = peak period
 */
export type SeasonalityProfile = Record<string, number>;

/**
 * Channel-specific performance benchmarks
 */
export interface ChannelBenchmarks {
  cpa: number;     // Cost per acquisition
  ctr?: number;    // Click-through rate (0-1)
  cpm?: number;    // Cost per 1000 impressions
  cvr?: number;    // Conversion rate (0-1)
}

/**
 * Regional configuration for multi-location businesses
 */
export interface MediaRegion {
  id: string;
  name: string;
  storeIds: string[];
  weight?: number;           // Budget allocation weight
  seasonalityOverride?: SeasonalityProfile; // Optional regional seasonality
}

/**
 * Complete Media Profile for a company
 */
export interface MediaProfile {
  id: string;
  companyId: string;

  // Channel Configuration
  requiredChannels: MediaChannel[];   // Must include in all plans
  optionalChannels: MediaChannel[];   // Available but not required
  excludedChannels?: MediaChannel[];  // Never recommend

  // Performance Benchmarks
  baselineCpa: Record<string, number>;
  baselineCtrCpm?: Record<string, { ctr: number; cpm: number }>;

  // Seasonality
  seasonality: SeasonalityProfile;

  // Business Context
  avgTicketValue?: number;
  leadToCustomerRate?: number;  // % of leads that become customers
  primaryObjective?: 'installs' | 'calls' | 'traffic' | 'awareness' | 'blended';

  // Multi-Location Support
  regions?: MediaRegion[];
  maxStoreCapacity?: Record<string, number>; // Max monthly installs per store

  // Guardrails
  maxCpa?: number;
  minRoas?: number;

  // Metadata
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Input for creating/updating a media profile
 */
export interface MediaProfileInput {
  requiredChannels?: MediaChannel[];
  optionalChannels?: MediaChannel[];
  excludedChannels?: MediaChannel[];
  baselineCpa?: Record<string, number>;
  baselineCtrCpm?: Record<string, { ctr: number; cpm: number }>;
  seasonality?: SeasonalityProfile;
  avgTicketValue?: number;
  leadToCustomerRate?: number;
  primaryObjective?: MediaProfile['primaryObjective'];
  regions?: MediaRegion[];
  maxStoreCapacity?: Record<string, number>;
  maxCpa?: number;
  minRoas?: number;
  notes?: string;
}

// ============================================================================
// Default Profile Values
// ============================================================================

/**
 * Default seasonality - flat throughout the year
 */
export const DEFAULT_SEASONALITY: SeasonalityProfile = {
  Jan: 1.0,
  Feb: 1.0,
  Mar: 1.0,
  Apr: 1.0,
  May: 1.0,
  Jun: 1.0,
  Jul: 1.0,
  Aug: 1.0,
  Sep: 1.0,
  Oct: 1.0,
  Nov: 1.0,
  Dec: 1.0,
};

/**
 * Default CPA benchmarks by channel (general industry averages)
 */
export const DEFAULT_BASELINE_CPA: Record<string, number> = {
  search: 75,
  maps: 45,
  lsa: 60,
  social: 85,
  display: 120,
  radio: 150,
  video: 100,
  email: 25,
  affiliate: 50,
};

/**
 * Default CTR/CPM benchmarks by channel
 */
export const DEFAULT_CTR_CPM: Record<string, { ctr: number; cpm: number }> = {
  search: { ctr: 0.045, cpm: 25 },
  maps: { ctr: 0.025, cpm: 8 },
  lsa: { ctr: 0.08, cpm: 0 },  // Pay per lead
  social: { ctr: 0.012, cpm: 12 },
  display: { ctr: 0.005, cpm: 4 },
  radio: { ctr: 0, cpm: 15 },  // No click tracking
  video: { ctr: 0.015, cpm: 10 },
};

/**
 * Generate a default media profile for any company
 */
export function createDefaultMediaProfile(companyId: string): MediaProfile {
  const now = new Date().toISOString();
  return {
    id: `default_${companyId}`,
    companyId,
    requiredChannels: ['search', 'maps'],
    optionalChannels: ['social', 'lsa', 'display'],
    seasonality: { ...DEFAULT_SEASONALITY },
    baselineCpa: { ...DEFAULT_BASELINE_CPA },
    baselineCtrCpm: { ...DEFAULT_CTR_CPM },
    primaryObjective: 'blended',
    createdAt: now,
    updatedAt: now,
  };
}

// ============================================================================
// Airtable Field Interfaces
// ============================================================================

interface AirtableMediaProfileFields {
  Company?: string[];
  'Required Channels'?: string[];
  'Optional Channels'?: string[];
  'Excluded Channels'?: string[];
  'Baseline CPA'?: string;          // JSON
  'Baseline CTR CPM'?: string;      // JSON
  Seasonality?: string;             // JSON
  'Avg Ticket Value'?: number;
  'Lead To Customer Rate'?: number;
  'Primary Objective'?: string;
  Regions?: string;                 // JSON
  'Max Store Capacity'?: string;    // JSON
  'Max CPA'?: number;
  'Min ROAS'?: number;
  Notes?: string;
  'Created At'?: string;
  'Updated At'?: string;
}

// ============================================================================
// Parsing Helpers
// ============================================================================

function parseJson<T>(raw: string | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function parseChannels(raw: string[] | undefined): MediaChannel[] {
  if (!raw) return [];
  return raw as MediaChannel[];
}

function parseObjective(raw: string | undefined): MediaProfile['primaryObjective'] {
  const valid = ['installs', 'calls', 'traffic', 'awareness', 'blended'];
  if (raw && valid.includes(raw)) {
    return raw as MediaProfile['primaryObjective'];
  }
  return 'blended';
}

// ============================================================================
// Mapping Functions
// ============================================================================

function mapAirtableToMediaProfile(record: any): MediaProfile {
  const fields = record.fields as AirtableMediaProfileFields;

  return {
    id: record.id,
    companyId: fields.Company?.[0] || '',
    requiredChannels: parseChannels(fields['Required Channels']),
    optionalChannels: parseChannels(fields['Optional Channels']),
    excludedChannels: parseChannels(fields['Excluded Channels']),
    baselineCpa: parseJson(fields['Baseline CPA'], DEFAULT_BASELINE_CPA),
    baselineCtrCpm: parseJson(fields['Baseline CTR CPM'], DEFAULT_CTR_CPM),
    seasonality: parseJson(fields.Seasonality, DEFAULT_SEASONALITY),
    avgTicketValue: fields['Avg Ticket Value'],
    leadToCustomerRate: fields['Lead To Customer Rate'],
    primaryObjective: parseObjective(fields['Primary Objective']),
    regions: parseJson(fields.Regions, undefined),
    maxStoreCapacity: parseJson(fields['Max Store Capacity'], undefined),
    maxCpa: fields['Max CPA'],
    minRoas: fields['Min ROAS'],
    notes: fields.Notes,
    createdAt: fields['Created At'] || new Date().toISOString(),
    updatedAt: fields['Updated At'] || new Date().toISOString(),
  };
}

// ============================================================================
// Query Functions
// ============================================================================

/**
 * Get the media profile for a company
 * Returns default profile if none exists
 */
export async function getMediaProfile(companyId: string): Promise<MediaProfile> {
  try {
    const base = getBase();
    const records = await base(AIRTABLE_TABLES.MEDIA_PROFILES)
      .select({
        filterByFormula: `SEARCH("${companyId}", ARRAYJOIN({Company}))`,
        maxRecords: 1,
      })
      .all();

    if (records.length === 0) {
      // Return default profile
      return createDefaultMediaProfile(companyId);
    }

    return mapAirtableToMediaProfile(records[0]);
  } catch (error: any) {
    const errorMessage = error?.message || error?.error || String(error);
    // Silently return default for missing table
    if (errorMessage.includes('Could not find table') || errorMessage.includes('NOT_FOUND')) {
      return createDefaultMediaProfile(companyId);
    }
    console.error(`[MediaProfile] Failed to fetch profile for ${companyId}:`, errorMessage);
    return createDefaultMediaProfile(companyId);
  }
}

/**
 * Check if a company has a custom media profile
 */
export async function hasMediaProfile(companyId: string): Promise<boolean> {
  try {
    const base = getBase();
    const records = await base(AIRTABLE_TABLES.MEDIA_PROFILES)
      .select({
        filterByFormula: `SEARCH("${companyId}", ARRAYJOIN({Company}))`,
        maxRecords: 1,
        fields: [],
      })
      .all();

    return records.length > 0;
  } catch {
    return false;
  }
}

// ============================================================================
// Mutation Functions
// ============================================================================

/**
 * Create a new media profile for a company
 */
export async function createMediaProfile(
  companyId: string,
  input: MediaProfileInput
): Promise<MediaProfile> {
  const base = getBase();
  const now = new Date().toISOString();

  const fields: Partial<AirtableMediaProfileFields> = {
    Company: [companyId],
    'Required Channels': input.requiredChannels || ['search', 'maps'],
    'Optional Channels': input.optionalChannels || ['social', 'lsa'],
    'Excluded Channels': input.excludedChannels,
    'Baseline CPA': JSON.stringify(input.baselineCpa || DEFAULT_BASELINE_CPA),
    'Baseline CTR CPM': input.baselineCtrCpm ? JSON.stringify(input.baselineCtrCpm) : undefined,
    Seasonality: JSON.stringify(input.seasonality || DEFAULT_SEASONALITY),
    'Avg Ticket Value': input.avgTicketValue,
    'Lead To Customer Rate': input.leadToCustomerRate,
    'Primary Objective': input.primaryObjective || 'blended',
    Regions: input.regions ? JSON.stringify(input.regions) : undefined,
    'Max Store Capacity': input.maxStoreCapacity ? JSON.stringify(input.maxStoreCapacity) : undefined,
    'Max CPA': input.maxCpa,
    'Min ROAS': input.minRoas,
    Notes: input.notes,
    'Created At': now,
    'Updated At': now,
  };

  const record = await base(AIRTABLE_TABLES.MEDIA_PROFILES).create(fields);
  return mapAirtableToMediaProfile(record);
}

/**
 * Update an existing media profile
 */
export async function updateMediaProfile(
  profileId: string,
  input: Partial<MediaProfileInput>
): Promise<MediaProfile> {
  const base = getBase();
  const now = new Date().toISOString();

  const fields: Partial<AirtableMediaProfileFields> = {
    'Updated At': now,
  };

  if (input.requiredChannels !== undefined) {
    fields['Required Channels'] = input.requiredChannels;
  }
  if (input.optionalChannels !== undefined) {
    fields['Optional Channels'] = input.optionalChannels;
  }
  if (input.excludedChannels !== undefined) {
    fields['Excluded Channels'] = input.excludedChannels;
  }
  if (input.baselineCpa !== undefined) {
    fields['Baseline CPA'] = JSON.stringify(input.baselineCpa);
  }
  if (input.baselineCtrCpm !== undefined) {
    fields['Baseline CTR CPM'] = JSON.stringify(input.baselineCtrCpm);
  }
  if (input.seasonality !== undefined) {
    fields.Seasonality = JSON.stringify(input.seasonality);
  }
  if (input.avgTicketValue !== undefined) {
    fields['Avg Ticket Value'] = input.avgTicketValue;
  }
  if (input.leadToCustomerRate !== undefined) {
    fields['Lead To Customer Rate'] = input.leadToCustomerRate;
  }
  if (input.primaryObjective !== undefined) {
    fields['Primary Objective'] = input.primaryObjective;
  }
  if (input.regions !== undefined) {
    fields.Regions = JSON.stringify(input.regions);
  }
  if (input.maxStoreCapacity !== undefined) {
    fields['Max Store Capacity'] = JSON.stringify(input.maxStoreCapacity);
  }
  if (input.maxCpa !== undefined) {
    fields['Max CPA'] = input.maxCpa;
  }
  if (input.minRoas !== undefined) {
    fields['Min ROAS'] = input.minRoas;
  }
  if (input.notes !== undefined) {
    fields.Notes = input.notes;
  }

  const record = await base(AIRTABLE_TABLES.MEDIA_PROFILES).update(profileId, fields);
  return mapAirtableToMediaProfile(record);
}

/**
 * Delete a media profile
 */
export async function deleteMediaProfile(profileId: string): Promise<void> {
  const base = getBase();
  await base(AIRTABLE_TABLES.MEDIA_PROFILES).destroy(profileId);
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get all available channels for a profile (required + optional)
 */
export function getAvailableChannels(profile: MediaProfile): MediaChannel[] {
  const channels = new Set<MediaChannel>([
    ...profile.requiredChannels,
    ...profile.optionalChannels,
  ]);

  // Remove excluded channels
  if (profile.excludedChannels) {
    for (const excluded of profile.excludedChannels) {
      channels.delete(excluded);
    }
  }

  return Array.from(channels);
}

/**
 * Get CPA benchmark for a specific channel
 */
export function getChannelCpa(profile: MediaProfile, channel: MediaChannel): number {
  return profile.baselineCpa[channel] ?? DEFAULT_BASELINE_CPA[channel] ?? 100;
}

/**
 * Get CTR/CPM benchmarks for a specific channel
 */
export function getChannelCtrCpm(
  profile: MediaProfile,
  channel: MediaChannel
): { ctr: number; cpm: number } {
  const custom = profile.baselineCtrCpm?.[channel];
  const fallback = DEFAULT_CTR_CPM[channel] ?? { ctr: 0.02, cpm: 15 };

  return {
    ctr: custom?.ctr ?? fallback.ctr,
    cpm: custom?.cpm ?? fallback.cpm,
  };
}

/**
 * Get seasonality multiplier for a specific month
 */
export function getSeasonalityMultiplier(
  profile: MediaProfile,
  month: string,
  regionId?: string
): number {
  // Check for regional override
  if (regionId && profile.regions) {
    const region = profile.regions.find(r => r.id === regionId);
    if (region?.seasonalityOverride?.[month] !== undefined) {
      return region.seasonalityOverride[month];
    }
  }

  return profile.seasonality[month] ?? 1.0;
}

/**
 * Check if a channel is required for the profile
 */
export function isChannelRequired(profile: MediaProfile, channel: MediaChannel): boolean {
  return profile.requiredChannels.includes(channel);
}

/**
 * Check if a channel is excluded for the profile
 */
export function isChannelExcluded(profile: MediaProfile, channel: MediaChannel): boolean {
  return profile.excludedChannels?.includes(channel) ?? false;
}

// ============================================================================
// Profile Validation
// ============================================================================

/**
 * Validate a media profile configuration
 */
export function validateMediaProfile(profile: MediaProfile): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check required channels
  if (profile.requiredChannels.length === 0) {
    warnings.push('No required channels specified. Consider adding at least one.');
  }

  // Check for overlap between required and excluded
  if (profile.excludedChannels) {
    const overlap = profile.requiredChannels.filter(c =>
      profile.excludedChannels?.includes(c)
    );
    if (overlap.length > 0) {
      errors.push(`Channels cannot be both required and excluded: ${overlap.join(', ')}`);
    }
  }

  // Check seasonality values
  const seasonValues = Object.values(profile.seasonality);
  if (seasonValues.some(v => v < 0 || v > 5)) {
    warnings.push('Seasonality values outside typical range (0-5). Please verify.');
  }

  // Check CPA values
  const cpaValues = Object.values(profile.baselineCpa);
  if (cpaValues.some(v => v <= 0)) {
    errors.push('CPA values must be positive.');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// ============================================================================
// Seasonality Templates
// ============================================================================

/**
 * Pre-built seasonality templates for common business types
 */
export const SEASONALITY_TEMPLATES: Record<string, SeasonalityProfile> = {
  retail_holiday: {
    Jan: 0.7, Feb: 0.75, Mar: 0.85, Apr: 0.9, May: 0.95,
    Jun: 0.9, Jul: 0.85, Aug: 0.9, Sep: 0.95, Oct: 1.1,
    Nov: 1.4, Dec: 1.5,
  },
  automotive_seasonal: {
    Jan: 0.8, Feb: 0.85, Mar: 1.0, Apr: 1.1, May: 1.15,
    Jun: 1.1, Jul: 1.0, Aug: 0.95, Sep: 1.0, Oct: 1.2,
    Nov: 1.1, Dec: 0.9,
  },
  summer_peak: {
    Jan: 0.6, Feb: 0.65, Mar: 0.8, Apr: 1.0, May: 1.2,
    Jun: 1.4, Jul: 1.5, Aug: 1.4, Sep: 1.1, Oct: 0.9,
    Nov: 0.7, Dec: 0.6,
  },
  winter_peak: {
    Jan: 1.3, Feb: 1.2, Mar: 1.0, Apr: 0.8, May: 0.7,
    Jun: 0.6, Jul: 0.6, Aug: 0.7, Sep: 0.9, Oct: 1.1,
    Nov: 1.2, Dec: 1.4,
  },
  b2b_fiscal: {
    Jan: 0.8, Feb: 0.9, Mar: 1.2, Apr: 1.0, May: 1.0,
    Jun: 1.1, Jul: 0.8, Aug: 0.7, Sep: 1.1, Oct: 1.1,
    Nov: 1.0, Dec: 1.2,
  },
  flat: DEFAULT_SEASONALITY,
};

/**
 * Get a seasonality template by name
 */
export function getSeasonalityTemplate(name: string): SeasonalityProfile {
  return SEASONALITY_TEMPLATES[name] ?? DEFAULT_SEASONALITY;
}
