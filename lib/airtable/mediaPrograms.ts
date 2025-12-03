// lib/airtable/mediaPrograms.ts
// Airtable helper for Media Programs
//
// MediaPrograms represent strategic media initiatives (e.g., "Always-On Install Demand – WA/CO")

import { getAirtableConfig } from './client';
import { AIRTABLE_TABLES } from './tables';
import type {
  MediaProgram,
  MediaProgramStatus,
  MediaObjective,
  MediaChannel,
  MediaCategory,
  MediaKPI,
} from '@/lib/types/media';

const TABLE_NAME = AIRTABLE_TABLES.MEDIA_PROGRAMS;

// ============================================================================
// Airtable Field Mapping
// ============================================================================

interface AirtableMediaProgramFields {
  Company?: string[];
  Name?: string;
  Status?: MediaProgramStatus;
  Objective?: MediaObjective;
  Markets?: string[];
  'Primary Channels'?: MediaChannel[];
  'Core Categories'?: MediaCategory[];
  Seasonal?: boolean;
  'Start Date'?: string;
  'End Date'?: string;
  'Primary KPI'?: MediaKPI;
  'Monthly Budget'?: number;
  Notes?: string;
  'Linked Campaigns'?: string[];
  'Created At'?: string;
  'Updated At'?: string;
  // Lookup fields (read-only)
  'Company Name'?: string[];
  'Market Names'?: string[];
}

function mapAirtableToMediaProgram(record: { id: string; fields: AirtableMediaProgramFields }): MediaProgram {
  const fields = record.fields;
  return {
    id: record.id,
    companyId: fields.Company?.[0] || '',
    companyName: fields['Company Name']?.[0],
    name: fields.Name || 'Untitled Program',
    status: fields.Status || 'Planned',
    objective: fields.Objective || 'Leads',
    marketIds: fields.Markets || [],
    marketNames: fields['Market Names'],
    primaryChannels: fields['Primary Channels'] || [],
    coreCategories: fields['Core Categories'] || [],
    seasonal: fields.Seasonal || false,
    startDate: fields['Start Date'],
    endDate: fields['End Date'],
    primaryKPI: fields['Primary KPI'],
    monthlyBudget: fields['Monthly Budget'],
    notes: fields.Notes,
    linkedCampaignIds: fields['Linked Campaigns'],
    createdAt: fields['Created At'],
    updatedAt: fields['Updated At'],
  };
}

// ============================================================================
// Query Functions
// ============================================================================

/**
 * Get all media programs for a company
 */
export async function getMediaProgramsByCompany(companyId: string): Promise<MediaProgram[]> {
  const config = getAirtableConfig();
  const filterFormula = `FIND("${companyId}", ARRAYJOIN({Company}))`;
  const url = `https://api.airtable.com/v0/${config.baseId}/${encodeURIComponent(TABLE_NAME)}?filterByFormula=${encodeURIComponent(filterFormula)}&sort%5B0%5D%5Bfield%5D=Name&sort%5B0%5D%5Bdirection%5D=asc`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('[MediaPrograms] Failed to fetch:', response.status);
      return [];
    }

    const data = await response.json();
    return (data.records || []).map(mapAirtableToMediaProgram);
  } catch (error) {
    console.error('[MediaPrograms] Error fetching programs:', error);
    return [];
  }
}

/**
 * Get all media programs (global)
 */
export async function getAllMediaPrograms(): Promise<MediaProgram[]> {
  const config = getAirtableConfig();
  const url = `https://api.airtable.com/v0/${config.baseId}/${encodeURIComponent(TABLE_NAME)}?sort%5B0%5D%5Bfield%5D=Name&sort%5B0%5D%5Bdirection%5D=asc`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('[MediaPrograms] Failed to fetch all:', response.status);
      return [];
    }

    const data = await response.json();
    return (data.records || []).map(mapAirtableToMediaProgram);
  } catch (error) {
    console.error('[MediaPrograms] Error fetching all programs:', error);
    return [];
  }
}

/**
 * Get a single media program by ID
 */
export async function getMediaProgramById(programId: string): Promise<MediaProgram | null> {
  const config = getAirtableConfig();
  const url = `https://api.airtable.com/v0/${config.baseId}/${encodeURIComponent(TABLE_NAME)}/${programId}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 404) return null;
      console.error('[MediaPrograms] Failed to fetch by ID:', response.status);
      return null;
    }

    const record = await response.json();
    return mapAirtableToMediaProgram(record);
  } catch (error) {
    console.error('[MediaPrograms] Error fetching program:', error);
    return null;
  }
}

/**
 * Create a new media program
 */
export async function createMediaProgram(
  program: Omit<MediaProgram, 'id' | 'createdAt' | 'updatedAt'>
): Promise<MediaProgram | null> {
  const config = getAirtableConfig();
  const url = `https://api.airtable.com/v0/${config.baseId}/${encodeURIComponent(TABLE_NAME)}`;

  const fields: AirtableMediaProgramFields = {
    Company: program.companyId ? [program.companyId] : undefined,
    Name: program.name,
    Status: program.status,
    Objective: program.objective,
    Markets: program.marketIds,
    'Primary Channels': program.primaryChannels,
    'Core Categories': program.coreCategories,
    Seasonal: program.seasonal,
    'Start Date': program.startDate,
    'End Date': program.endDate,
    'Primary KPI': program.primaryKPI,
    'Monthly Budget': program.monthlyBudget,
    Notes: program.notes,
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fields }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[MediaPrograms] Failed to create:', response.status, errorText);
      return null;
    }

    const record = await response.json();
    return mapAirtableToMediaProgram(record);
  } catch (error) {
    console.error('[MediaPrograms] Error creating program:', error);
    return null;
  }
}

/**
 * Update a media program
 */
export async function updateMediaProgram(
  programId: string,
  updates: Partial<Omit<MediaProgram, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<MediaProgram | null> {
  const config = getAirtableConfig();
  const url = `https://api.airtable.com/v0/${config.baseId}/${encodeURIComponent(TABLE_NAME)}/${programId}`;

  const fields: Partial<AirtableMediaProgramFields> = {};
  if (updates.name !== undefined) fields.Name = updates.name;
  if (updates.status !== undefined) fields.Status = updates.status;
  if (updates.objective !== undefined) fields.Objective = updates.objective;
  if (updates.marketIds !== undefined) fields.Markets = updates.marketIds;
  if (updates.primaryChannels !== undefined) fields['Primary Channels'] = updates.primaryChannels;
  if (updates.coreCategories !== undefined) fields['Core Categories'] = updates.coreCategories;
  if (updates.seasonal !== undefined) fields.Seasonal = updates.seasonal;
  if (updates.startDate !== undefined) fields['Start Date'] = updates.startDate;
  if (updates.endDate !== undefined) fields['End Date'] = updates.endDate;
  if (updates.primaryKPI !== undefined) fields['Primary KPI'] = updates.primaryKPI;
  if (updates.monthlyBudget !== undefined) fields['Monthly Budget'] = updates.monthlyBudget;
  if (updates.notes !== undefined) fields.Notes = updates.notes;

  try {
    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fields }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[MediaPrograms] Failed to update:', response.status, errorText);
      return null;
    }

    const record = await response.json();
    return mapAirtableToMediaProgram(record);
  } catch (error) {
    console.error('[MediaPrograms] Error updating program:', error);
    return null;
  }
}
