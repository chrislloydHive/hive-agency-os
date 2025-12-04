// lib/airtable/mediaCampaigns.ts
// Airtable helper for Media Campaigns
//
// MediaCampaigns represent individual channel executions inside a program

import { getAirtableConfig } from './client';
import { AIRTABLE_TABLES } from './tables';
import type {
  MediaCampaign,
  MediaProgramStatus,
  MediaObjective,
  MediaChannel,
  MediaKPI,
} from '@/lib/types/media';

const TABLE_NAME = AIRTABLE_TABLES.MEDIA_CAMPAIGNS;

// ============================================================================
// Airtable Field Mapping
// ============================================================================

interface AirtableMediaCampaignFields {
  Company?: string[];
  Program?: string[];
  Name?: string;
  Channel?: MediaChannel;
  Market?: string[];
  Stores?: string[];
  Objective?: MediaObjective;
  Status?: MediaProgramStatus;
  'Start Date'?: string;
  'End Date'?: string;
  'Monthly Budget'?: number;
  'Bid Strategy'?: string;
  'Key KPI'?: MediaKPI;
  Notes?: string;
  'Created At'?: string;
  'Updated At'?: string;
  // Lookup fields (read-only)
  'Company Name'?: string[];
  'Program Name'?: string[];
  'Market Name'?: string[];
  'Store Names'?: string[];
}

function mapAirtableToMediaCampaign(record: { id: string; fields: AirtableMediaCampaignFields }): MediaCampaign {
  const fields = record.fields;
  return {
    id: record.id,
    companyId: fields.Company?.[0] || '',
    companyName: fields['Company Name']?.[0],
    programId: fields.Program?.[0],
    programName: fields['Program Name']?.[0],
    name: fields.Name || 'Untitled Campaign',
    channel: fields.Channel || 'Other',
    marketId: fields.Market?.[0],
    marketName: fields['Market Name']?.[0],
    storeIds: fields.Stores || [],
    storeNames: fields['Store Names'],
    objective: fields.Objective || 'Leads',
    status: fields.Status || 'Planned',
    startDate: fields['Start Date'],
    endDate: fields['End Date'],
    monthlyBudget: fields['Monthly Budget'],
    bidStrategy: fields['Bid Strategy'],
    keyKPI: fields['Key KPI'],
    notes: fields.Notes,
    createdAt: fields['Created At'],
    updatedAt: fields['Updated At'],
  };
}

// ============================================================================
// Query Functions
// ============================================================================

/**
 * Get all media campaigns for a company
 */
export async function getMediaCampaignsByCompany(companyId: string): Promise<MediaCampaign[]> {
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
      console.error('[MediaCampaigns] Failed to fetch:', response.status);
      return [];
    }

    const data = await response.json();
    return (data.records || []).map(mapAirtableToMediaCampaign);
  } catch (error) {
    console.error('[MediaCampaigns] Error fetching campaigns:', error);
    return [];
  }
}

/**
 * Get campaigns by program
 */
export async function getMediaCampaignsByProgram(programId: string): Promise<MediaCampaign[]> {
  const config = getAirtableConfig();
  const filterFormula = `FIND("${programId}", ARRAYJOIN({Program}))`;
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
      console.error('[MediaCampaigns] Failed to fetch by program:', response.status);
      return [];
    }

    const data = await response.json();
    return (data.records || []).map(mapAirtableToMediaCampaign);
  } catch (error) {
    console.error('[MediaCampaigns] Error fetching campaigns by program:', error);
    return [];
  }
}

/**
 * Get all media campaigns (global)
 */
export async function getAllMediaCampaigns(): Promise<MediaCampaign[]> {
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
      console.error('[MediaCampaigns] Failed to fetch all:', response.status);
      return [];
    }

    const data = await response.json();
    return (data.records || []).map(mapAirtableToMediaCampaign);
  } catch (error) {
    console.error('[MediaCampaigns] Error fetching all campaigns:', error);
    return [];
  }
}

/**
 * Get active campaigns count by channel (for a company)
 */
export async function getActiveCampaignCountsByChannel(
  companyId: string
): Promise<Partial<Record<MediaChannel, number>>> {
  const campaigns = await getMediaCampaignsByCompany(companyId);
  const activeCampaigns = campaigns.filter((c) => c.status === 'Active');

  const counts: Partial<Record<MediaChannel, number>> = {};

  for (const campaign of activeCampaigns) {
    counts[campaign.channel] = (counts[campaign.channel] || 0) + 1;
  }

  return counts;
}

/**
 * Get a single campaign by ID
 */
export async function getMediaCampaignById(campaignId: string): Promise<MediaCampaign | null> {
  const config = getAirtableConfig();
  const url = `https://api.airtable.com/v0/${config.baseId}/${encodeURIComponent(TABLE_NAME)}/${campaignId}`;

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
      console.error('[MediaCampaigns] Failed to fetch by ID:', response.status);
      return null;
    }

    const record = await response.json();
    return mapAirtableToMediaCampaign(record);
  } catch (error) {
    console.error('[MediaCampaigns] Error fetching campaign:', error);
    return null;
  }
}

/**
 * Create a new media campaign
 */
export async function createMediaCampaign(
  campaign: Omit<MediaCampaign, 'id' | 'createdAt' | 'updatedAt'>
): Promise<MediaCampaign | null> {
  const config = getAirtableConfig();
  const url = `https://api.airtable.com/v0/${config.baseId}/${encodeURIComponent(TABLE_NAME)}`;

  const fields: AirtableMediaCampaignFields = {
    Company: campaign.companyId ? [campaign.companyId] : undefined,
    Program: campaign.programId ? [campaign.programId] : undefined,
    Name: campaign.name,
    Channel: campaign.channel,
    Market: campaign.marketId ? [campaign.marketId] : undefined,
    Stores: campaign.storeIds,
    Objective: campaign.objective,
    Status: campaign.status,
    'Start Date': campaign.startDate,
    'End Date': campaign.endDate,
    'Monthly Budget': campaign.monthlyBudget,
    'Bid Strategy': campaign.bidStrategy,
    'Key KPI': campaign.keyKPI,
    Notes: campaign.notes,
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
      console.error('[MediaCampaigns] Failed to create:', response.status, errorText);
      return null;
    }

    const record = await response.json();
    return mapAirtableToMediaCampaign(record);
  } catch (error) {
    console.error('[MediaCampaigns] Error creating campaign:', error);
    return null;
  }
}
