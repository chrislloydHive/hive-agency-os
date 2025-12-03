// lib/airtable/mediaMarkets.ts
// Airtable helper for Media Markets
//
// MediaMarkets represent geographic territories (e.g., Seattle, Denver)

import { getAirtableConfig } from './client';
import { AIRTABLE_TABLES } from './tables';
import type { MediaMarket, MediaCategory } from '@/lib/types/media';

const TABLE_NAME = AIRTABLE_TABLES.MEDIA_MARKETS;

// ============================================================================
// Airtable Field Mapping
// ============================================================================

interface AirtableMediaMarketFields {
  Company?: string[];
  Name?: string;
  Region?: string;
  Stores?: string[];
  'Visibility Score'?: number;
  'Demand Score'?: number;
  'Conversion Score'?: number;
  'Primary Categories'?: MediaCategory[];
  Competitors?: string;
  Notes?: string;
  'Created At'?: string;
  'Updated At'?: string;
  // Lookup fields (read-only)
  'Company Name'?: string[];
  'Store Names'?: string[];
}

function mapAirtableToMediaMarket(record: { id: string; fields: AirtableMediaMarketFields }): MediaMarket {
  const fields = record.fields;
  return {
    id: record.id,
    companyId: fields.Company?.[0] || '',
    companyName: fields['Company Name']?.[0],
    name: fields.Name || 'Untitled Market',
    region: fields.Region,
    storeIds: fields.Stores || [],
    storeNames: fields['Store Names'],
    visibilityScore: fields['Visibility Score'],
    demandScore: fields['Demand Score'],
    conversionScore: fields['Conversion Score'],
    primaryCategories: fields['Primary Categories'] || [],
    competitors: fields.Competitors,
    notes: fields.Notes,
    createdAt: fields['Created At'],
    updatedAt: fields['Updated At'],
  };
}

// ============================================================================
// Query Functions
// ============================================================================

/**
 * Get all media markets for a company
 */
export async function getMediaMarketsByCompany(companyId: string): Promise<MediaMarket[]> {
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
      console.error('[MediaMarkets] Failed to fetch:', response.status);
      return [];
    }

    const data = await response.json();
    return (data.records || []).map(mapAirtableToMediaMarket);
  } catch (error) {
    console.error('[MediaMarkets] Error fetching markets:', error);
    return [];
  }
}

/**
 * Get all media markets (global)
 */
export async function getAllMediaMarkets(): Promise<MediaMarket[]> {
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
      console.error('[MediaMarkets] Failed to fetch all:', response.status);
      return [];
    }

    const data = await response.json();
    return (data.records || []).map(mapAirtableToMediaMarket);
  } catch (error) {
    console.error('[MediaMarkets] Error fetching all markets:', error);
    return [];
  }
}

/**
 * Get a single market by ID
 */
export async function getMediaMarketById(marketId: string): Promise<MediaMarket | null> {
  const config = getAirtableConfig();
  const url = `https://api.airtable.com/v0/${config.baseId}/${encodeURIComponent(TABLE_NAME)}/${marketId}`;

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
      console.error('[MediaMarkets] Failed to fetch by ID:', response.status);
      return null;
    }

    const record = await response.json();
    return mapAirtableToMediaMarket(record);
  } catch (error) {
    console.error('[MediaMarkets] Error fetching market:', error);
    return null;
  }
}

/**
 * Create a new media market
 */
export async function createMediaMarket(
  market: Omit<MediaMarket, 'id' | 'createdAt' | 'updatedAt'>
): Promise<MediaMarket | null> {
  const config = getAirtableConfig();
  const url = `https://api.airtable.com/v0/${config.baseId}/${encodeURIComponent(TABLE_NAME)}`;

  const fields: AirtableMediaMarketFields = {
    Company: market.companyId ? [market.companyId] : undefined,
    Name: market.name,
    Region: market.region,
    Stores: market.storeIds,
    'Visibility Score': market.visibilityScore,
    'Demand Score': market.demandScore,
    'Conversion Score': market.conversionScore,
    'Primary Categories': market.primaryCategories,
    Competitors: market.competitors,
    Notes: market.notes,
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
      console.error('[MediaMarkets] Failed to create:', response.status, errorText);
      return null;
    }

    const record = await response.json();
    return mapAirtableToMediaMarket(record);
  } catch (error) {
    console.error('[MediaMarkets] Error creating market:', error);
    return null;
  }
}

/**
 * Update a media market
 */
export async function updateMediaMarket(
  marketId: string,
  updates: Partial<Omit<MediaMarket, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<MediaMarket | null> {
  const config = getAirtableConfig();
  const url = `https://api.airtable.com/v0/${config.baseId}/${encodeURIComponent(TABLE_NAME)}/${marketId}`;

  const fields: Partial<AirtableMediaMarketFields> = {};
  if (updates.name !== undefined) fields.Name = updates.name;
  if (updates.region !== undefined) fields.Region = updates.region;
  if (updates.storeIds !== undefined) fields.Stores = updates.storeIds;
  if (updates.visibilityScore !== undefined) fields['Visibility Score'] = updates.visibilityScore;
  if (updates.demandScore !== undefined) fields['Demand Score'] = updates.demandScore;
  if (updates.conversionScore !== undefined) fields['Conversion Score'] = updates.conversionScore;
  if (updates.primaryCategories !== undefined) fields['Primary Categories'] = updates.primaryCategories;
  if (updates.competitors !== undefined) fields.Competitors = updates.competitors;
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
      console.error('[MediaMarkets] Failed to update:', response.status, errorText);
      return null;
    }

    const record = await response.json();
    return mapAirtableToMediaMarket(record);
  } catch (error) {
    console.error('[MediaMarkets] Error updating market:', error);
    return null;
  }
}
