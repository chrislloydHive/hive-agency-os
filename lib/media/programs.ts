// lib/media/programs.ts
// Media Program Domain Model and CRUD Operations
//
// A Media Program represents an active media engagement for a company.
// When a program is active, the Media Dashboard unlocks with channel performance.
//
// Programs are stored in Airtable and support:
// - Multiple channels per program
// - Link to Media Plans for strategic planning
// - Status management (active, paused, completed)

import { getBase } from '@/lib/airtable';
import { AIRTABLE_TABLES } from '@/lib/airtable/tables';
import type { MediaChannel } from './types';
import type { MediaProvider } from '@/lib/types/media';

// ============================================================================
// Types
// ============================================================================

export type MediaProgramStatus = 'active' | 'paused' | 'completed';

export interface MediaProgramChannel {
  channel: MediaChannel;
  provider?: MediaProvider;
  isActive: boolean;
  monthlyBudget?: number;
}

export interface MediaProgram {
  id: string;
  companyId: string;
  name: string;
  status: MediaProgramStatus;
  channels: MediaProgramChannel[];
  totalMonthlyBudget: number;
  planId?: string;       // Link to Media Plan
  forecastId?: string;   // Optional link to saved forecast
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMediaProgramInput {
  name?: string;
  channels: MediaProgramChannel[];
  totalMonthlyBudget?: number;
  planId?: string;
  notes?: string;
}

export interface UpdateMediaProgramInput {
  name?: string;
  channels?: MediaProgramChannel[];
  totalMonthlyBudget?: number;
  planId?: string;
  forecastId?: string;
  notes?: string;
}

// ============================================================================
// Constants
// ============================================================================

export const MEDIA_PROGRAM_STATUS_OPTIONS: { value: MediaProgramStatus; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'completed', label: 'Completed' },
];

/**
 * Default channels for new programs
 */
export function getDefaultProgramChannels(): MediaProgramChannel[] {
  return [
    { channel: 'search', provider: 'google_ads', isActive: true, monthlyBudget: 0 },
    { channel: 'maps', provider: 'gbp', isActive: true, monthlyBudget: 0 },
    { channel: 'lsa', provider: 'lsa', isActive: true, monthlyBudget: 0 },
    { channel: 'social', provider: 'meta_ads', isActive: false, monthlyBudget: 0 },
    { channel: 'radio', provider: 'radio_vendor', isActive: false, monthlyBudget: 0 },
  ];
}

// ============================================================================
// Airtable Field Interfaces
// ============================================================================

interface AirtableMediaProgramFields {
  Company?: string[];
  Name?: string;
  Status?: string;
  Channels?: string; // JSON string
  'Total Monthly Budget'?: number;
  'Plan ID'?: string[];
  'Forecast ID'?: string;
  Notes?: string;
  'Created At'?: string;
  'Updated At'?: string;
}

// ============================================================================
// Mapping Functions
// ============================================================================

function parseStatus(raw: string | undefined): MediaProgramStatus {
  const valid: MediaProgramStatus[] = ['active', 'paused', 'completed'];
  const normalized = raw?.toLowerCase() as MediaProgramStatus;
  return valid.includes(normalized) ? normalized : 'active';
}

function parseChannels(raw: string | undefined): MediaProgramChannel[] {
  if (!raw) return getDefaultProgramChannels();
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
    return getDefaultProgramChannels();
  } catch {
    return getDefaultProgramChannels();
  }
}

function mapAirtableToMediaProgram(record: any): MediaProgram {
  const fields = record.fields as AirtableMediaProgramFields;
  return {
    id: record.id,
    companyId: fields.Company?.[0] || '',
    name: fields.Name || 'Media Program',
    status: parseStatus(fields.Status),
    channels: parseChannels(fields.Channels),
    totalMonthlyBudget: fields['Total Monthly Budget'] ?? 0,
    planId: fields['Plan ID']?.[0],
    forecastId: fields['Forecast ID'] || undefined,
    notes: fields.Notes || undefined,
    createdAt: fields['Created At'] || new Date().toISOString(),
    updatedAt: fields['Updated At'] || new Date().toISOString(),
  };
}

// ============================================================================
// Query Functions
// ============================================================================

/**
 * Get the media program for a company
 * Returns null if no program exists
 */
export async function getMediaProgram(companyId: string): Promise<MediaProgram | null> {
  try {
    const base = getBase();
    const records = await base(AIRTABLE_TABLES.MEDIA_PROGRAMS)
      .select({
        filterByFormula: `SEARCH("${companyId}", ARRAYJOIN({Company}))`,
        maxRecords: 1,
        sort: [{ field: 'Updated At', direction: 'desc' }],
      })
      .all();

    if (records.length === 0) {
      return null;
    }

    return mapAirtableToMediaProgram(records[0]);
  } catch (error: any) {
    const errorMessage = error?.message || error?.error || String(error);
    // Silently return null for missing table (not yet created in Airtable)
    if (!errorMessage.includes('Could not find table') && !errorMessage.includes('NOT_FOUND')) {
      console.error(`[MediaPrograms] Failed to fetch program for company ${companyId}:`, errorMessage);
    }
    return null;
  }
}

/**
 * Get the active media program for a company
 * Returns null if no active program exists
 */
export async function getActiveMediaProgram(companyId: string): Promise<MediaProgram | null> {
  const program = await getMediaProgram(companyId);
  if (program && program.status === 'active') {
    return program;
  }
  return null;
}

/**
 * Check if a company has an active media program
 */
export async function hasActiveMediaProgram(companyId: string): Promise<boolean> {
  const program = await getActiveMediaProgram(companyId);
  return program !== null;
}

// ============================================================================
// Mutation Functions
// ============================================================================

/**
 * Create a new media program for a company
 */
export async function createMediaProgram(
  companyId: string,
  input: CreateMediaProgramInput
): Promise<MediaProgram> {
  const base = getBase();
  const now = new Date().toISOString();

  const fields: Partial<AirtableMediaProgramFields> = {
    Company: [companyId],
    Name: input.name || `${new Date().getFullYear()} Media Program`,
    Status: 'active',
    Channels: JSON.stringify(input.channels),
    'Total Monthly Budget': input.totalMonthlyBudget ?? 0,
    Notes: input.notes || undefined,
    'Created At': now,
    'Updated At': now,
  };

  if (input.planId) {
    fields['Plan ID'] = [input.planId];
  }

  const record = await base(AIRTABLE_TABLES.MEDIA_PROGRAMS).create(fields);
  return mapAirtableToMediaProgram(record);
}

/**
 * Update an existing media program
 */
export async function updateMediaProgram(
  companyId: string,
  programId: string,
  input: UpdateMediaProgramInput
): Promise<MediaProgram> {
  const base = getBase();
  const now = new Date().toISOString();

  // First verify the program belongs to this company
  const existing = await getMediaProgram(companyId);
  if (!existing || existing.id !== programId) {
    throw new Error('Program not found or does not belong to this company');
  }

  const fields: Partial<AirtableMediaProgramFields> = {
    'Updated At': now,
  };

  if (input.name !== undefined) {
    fields.Name = input.name;
  }
  if (input.channels !== undefined) {
    fields.Channels = JSON.stringify(input.channels);
  }
  if (input.totalMonthlyBudget !== undefined) {
    fields['Total Monthly Budget'] = input.totalMonthlyBudget;
  }
  if (input.planId !== undefined) {
    fields['Plan ID'] = input.planId ? [input.planId] : undefined;
  }
  if (input.forecastId !== undefined) {
    fields['Forecast ID'] = input.forecastId;
  }
  if (input.notes !== undefined) {
    fields.Notes = input.notes;
  }

  const record = await base(AIRTABLE_TABLES.MEDIA_PROGRAMS).update(programId, fields);
  return mapAirtableToMediaProgram(record);
}

/**
 * Set the status of a media program
 */
export async function setMediaProgramStatus(
  companyId: string,
  programId: string,
  status: MediaProgramStatus
): Promise<MediaProgram> {
  const base = getBase();
  const now = new Date().toISOString();

  // First verify the program belongs to this company
  const existing = await getMediaProgram(companyId);
  if (!existing || existing.id !== programId) {
    throw new Error('Program not found or does not belong to this company');
  }

  const record = await base(AIRTABLE_TABLES.MEDIA_PROGRAMS).update(programId, {
    Status: status,
    'Updated At': now,
  });

  return mapAirtableToMediaProgram(record);
}

/**
 * Delete a media program
 */
export async function deleteMediaProgram(companyId: string, programId: string): Promise<void> {
  const base = getBase();

  // First verify the program belongs to this company
  const existing = await getMediaProgram(companyId);
  if (!existing || existing.id !== programId) {
    throw new Error('Program not found or does not belong to this company');
  }

  await base(AIRTABLE_TABLES.MEDIA_PROGRAMS).destroy(programId);
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get active channels from a program
 */
export function getActiveChannels(program: MediaProgram): MediaProgramChannel[] {
  return program.channels.filter(c => c.isActive);
}

/**
 * Calculate total budget from channel budgets
 */
export function calculateTotalBudget(channels: MediaProgramChannel[]): number {
  return channels.reduce((sum, c) => sum + (c.monthlyBudget || 0), 0);
}
