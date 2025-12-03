// lib/airtable/mediaStores.ts
// Airtable helper for Media Stores
//
// MediaStores represent physical store locations (critical for Car Toys)

import { getAirtableConfig } from './client';
import { AIRTABLE_TABLES } from './tables';
import type {
  MediaStore,
  MediaStoreScorecard,
  CallTrackingProvider,
} from '@/lib/types/media';
import { calculateOverallScore, parseCategoryMix } from '@/lib/types/media';

const TABLE_NAME = AIRTABLE_TABLES.MEDIA_STORES;

// ============================================================================
// Airtable Field Mapping
// ============================================================================

interface AirtableMediaStoreFields {
  Company?: string[];
  Name?: string;
  'Store Code'?: string;
  Market?: string[];
  Address?: string;
  City?: string;
  State?: string;
  ZIP?: string;
  'GBP Location ID'?: string;
  'Call Tracking Number'?: string;
  'Call Tracking Provider'?: CallTrackingProvider;
  'LSA Profile ID'?: string;
  'Website URL'?: string;
  'Visibility Score'?: number;
  'Demand Score'?: number;
  'Conversion Score'?: number;
  'Category Mix'?: string;
  Notes?: string;
  'Created At'?: string;
  'Updated At'?: string;
  // Lookup fields (read-only)
  'Company Name'?: string[];
  'Market Name'?: string[];
}

function mapAirtableToMediaStore(record: { id: string; fields: AirtableMediaStoreFields }): MediaStore {
  const fields = record.fields;
  return {
    id: record.id,
    companyId: fields.Company?.[0] || '',
    companyName: fields['Company Name']?.[0],
    name: fields.Name || 'Untitled Store',
    storeCode: fields['Store Code'],
    marketId: fields.Market?.[0],
    marketName: fields['Market Name']?.[0],
    address: fields.Address,
    city: fields.City,
    state: fields.State,
    zip: fields.ZIP,
    gbpLocationId: fields['GBP Location ID'],
    callTrackingNumber: fields['Call Tracking Number'],
    callTrackingProvider: fields['Call Tracking Provider'],
    lsaProfileId: fields['LSA Profile ID'],
    websiteUrl: fields['Website URL'],
    visibilityScore: fields['Visibility Score'],
    demandScore: fields['Demand Score'],
    conversionScore: fields['Conversion Score'],
    categoryMix: fields['Category Mix'],
    notes: fields.Notes,
    createdAt: fields['Created At'],
    updatedAt: fields['Updated At'],
  };
}

// ============================================================================
// Query Functions
// ============================================================================

/**
 * Get all media stores for a company
 */
export async function getMediaStoresByCompany(companyId: string): Promise<MediaStore[]> {
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
      console.error('[MediaStores] Failed to fetch:', response.status);
      return [];
    }

    const data = await response.json();
    return (data.records || []).map(mapAirtableToMediaStore);
  } catch (error) {
    console.error('[MediaStores] Error fetching stores:', error);
    return [];
  }
}

/**
 * Get stores by market
 */
export async function getMediaStoresByMarket(marketId: string): Promise<MediaStore[]> {
  const config = getAirtableConfig();
  const filterFormula = `FIND("${marketId}", ARRAYJOIN({Market}))`;
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
      console.error('[MediaStores] Failed to fetch by market:', response.status);
      return [];
    }

    const data = await response.json();
    return (data.records || []).map(mapAirtableToMediaStore);
  } catch (error) {
    console.error('[MediaStores] Error fetching stores by market:', error);
    return [];
  }
}

/**
 * Get all media stores (global)
 */
export async function getAllMediaStores(): Promise<MediaStore[]> {
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
      console.error('[MediaStores] Failed to fetch all:', response.status);
      return [];
    }

    const data = await response.json();
    return (data.records || []).map(mapAirtableToMediaStore);
  } catch (error) {
    console.error('[MediaStores] Error fetching all stores:', error);
    return [];
  }
}

/**
 * Get a single store by ID
 */
export async function getMediaStoreById(storeId: string): Promise<MediaStore | null> {
  const config = getAirtableConfig();
  const url = `https://api.airtable.com/v0/${config.baseId}/${encodeURIComponent(TABLE_NAME)}/${storeId}`;

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
      console.error('[MediaStores] Failed to fetch by ID:', response.status);
      return null;
    }

    const record = await response.json();
    return mapAirtableToMediaStore(record);
  } catch (error) {
    console.error('[MediaStores] Error fetching store:', error);
    return null;
  }
}

/**
 * Get store scorecards for a company
 */
export async function getStoreScorecardsForCompany(companyId: string): Promise<MediaStoreScorecard[]> {
  const stores = await getMediaStoresByCompany(companyId);

  return stores.map((store) => ({
    store,
    visibilityScore: store.visibilityScore ?? 0,
    demandScore: store.demandScore ?? 0,
    conversionScore: store.conversionScore ?? 0,
    overallScore: calculateOverallScore(
      store.visibilityScore,
      store.demandScore,
      store.conversionScore
    ),
    categoryMixParsed: parseCategoryMix(store.categoryMix),
  }));
}

/**
 * Create a new media store
 */
export async function createMediaStore(
  store: Omit<MediaStore, 'id' | 'createdAt' | 'updatedAt'>
): Promise<MediaStore | null> {
  const config = getAirtableConfig();
  const url = `https://api.airtable.com/v0/${config.baseId}/${encodeURIComponent(TABLE_NAME)}`;

  const fields: AirtableMediaStoreFields = {
    Company: store.companyId ? [store.companyId] : undefined,
    Name: store.name,
    'Store Code': store.storeCode,
    Market: store.marketId ? [store.marketId] : undefined,
    Address: store.address,
    City: store.city,
    State: store.state,
    ZIP: store.zip,
    'GBP Location ID': store.gbpLocationId,
    'Call Tracking Number': store.callTrackingNumber,
    'Call Tracking Provider': store.callTrackingProvider,
    'LSA Profile ID': store.lsaProfileId,
    'Website URL': store.websiteUrl,
    'Visibility Score': store.visibilityScore,
    'Demand Score': store.demandScore,
    'Conversion Score': store.conversionScore,
    'Category Mix': store.categoryMix,
    Notes: store.notes,
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
      console.error('[MediaStores] Failed to create:', response.status, errorText);
      return null;
    }

    const record = await response.json();
    return mapAirtableToMediaStore(record);
  } catch (error) {
    console.error('[MediaStores] Error creating store:', error);
    return null;
  }
}

/**
 * Update a media store
 */
export async function updateMediaStore(
  storeId: string,
  updates: Partial<Omit<MediaStore, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<MediaStore | null> {
  const config = getAirtableConfig();
  const url = `https://api.airtable.com/v0/${config.baseId}/${encodeURIComponent(TABLE_NAME)}/${storeId}`;

  const fields: Partial<AirtableMediaStoreFields> = {};
  if (updates.name !== undefined) fields.Name = updates.name;
  if (updates.storeCode !== undefined) fields['Store Code'] = updates.storeCode;
  if (updates.marketId !== undefined) fields.Market = updates.marketId ? [updates.marketId] : undefined;
  if (updates.address !== undefined) fields.Address = updates.address;
  if (updates.city !== undefined) fields.City = updates.city;
  if (updates.state !== undefined) fields.State = updates.state;
  if (updates.zip !== undefined) fields.ZIP = updates.zip;
  if (updates.gbpLocationId !== undefined) fields['GBP Location ID'] = updates.gbpLocationId;
  if (updates.callTrackingNumber !== undefined) fields['Call Tracking Number'] = updates.callTrackingNumber;
  if (updates.callTrackingProvider !== undefined) fields['Call Tracking Provider'] = updates.callTrackingProvider;
  if (updates.lsaProfileId !== undefined) fields['LSA Profile ID'] = updates.lsaProfileId;
  if (updates.websiteUrl !== undefined) fields['Website URL'] = updates.websiteUrl;
  if (updates.visibilityScore !== undefined) fields['Visibility Score'] = updates.visibilityScore;
  if (updates.demandScore !== undefined) fields['Demand Score'] = updates.demandScore;
  if (updates.conversionScore !== undefined) fields['Conversion Score'] = updates.conversionScore;
  if (updates.categoryMix !== undefined) fields['Category Mix'] = updates.categoryMix;
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
      console.error('[MediaStores] Failed to update:', response.status, errorText);
      return null;
    }

    const record = await response.json();
    return mapAirtableToMediaStore(record);
  } catch (error) {
    console.error('[MediaStores] Error updating store:', error);
    return null;
  }
}
