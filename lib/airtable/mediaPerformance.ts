// lib/airtable/mediaPerformance.ts
// Airtable helper for Media Performance (fact table)
//
// MediaPerformance stores rolled-up metrics (daily/weekly rows)

import { getAirtableConfig } from './client';
import { AIRTABLE_TABLES } from './tables';
import type {
  MediaPerformancePoint,
  MediaChannel,
  MetricName,
  MetricUnit,
  SourceSystem,
  MediaPerformanceCompositeKey,
} from '@/lib/types/media';
import { generateCompositeKey, METRIC_UNIT_MAP } from '@/lib/types/media';

const TABLE_NAME = AIRTABLE_TABLES.MEDIA_PERFORMANCE;

// ============================================================================
// Airtable Field Mapping
// ============================================================================

interface AirtableMediaPerformanceFields {
  Company?: string[];
  Program?: string[];
  Campaign?: string[];
  Market?: string[];
  Store?: string[];
  Channel?: MediaChannel;
  Date?: string;
  'Metric Name'?: MetricName;
  'Metric Value'?: number;
  'Metric Unit'?: MetricUnit;
  'Source System'?: SourceSystem;
  Notes?: string;
  'Created At'?: string;
}

function mapAirtableToMediaPerformance(
  record: { id: string; fields: AirtableMediaPerformanceFields }
): MediaPerformancePoint {
  const fields = record.fields;
  return {
    id: record.id,
    companyId: fields.Company?.[0] || '',
    programId: fields.Program?.[0],
    campaignId: fields.Campaign?.[0],
    marketId: fields.Market?.[0],
    storeId: fields.Store?.[0],
    channel: fields.Channel,
    date: fields.Date || '',
    metricName: fields['Metric Name'] || 'Impressions',
    metricValue: fields['Metric Value'] ?? 0,
    metricUnit: fields['Metric Unit'] || 'Count',
    sourceSystem: fields['Source System'] || 'Other',
    notes: fields.Notes,
    createdAt: fields['Created At'],
  };
}

// ============================================================================
// Query Functions
// ============================================================================

export interface PerformanceQueryOptions {
  range?: { start: Date; end: Date };
  metricNames?: MetricName[];
  channel?: MediaChannel;
  storeId?: string;
  marketId?: string;
  campaignId?: string;
  programId?: string;
}

/**
 * Get media performance data for a company
 */
export async function getMediaPerformanceByCompany(
  companyId: string,
  options?: PerformanceQueryOptions
): Promise<MediaPerformancePoint[]> {
  const config = getAirtableConfig();

  // Build filter formula
  const filters: string[] = [`FIND("${companyId}", ARRAYJOIN({Company}))`];

  if (options?.range) {
    const startStr = options.range.start.toISOString().split('T')[0];
    const endStr = options.range.end.toISOString().split('T')[0];
    filters.push(`IS_AFTER({Date}, '${startStr}')`);
    filters.push(`IS_BEFORE({Date}, '${endStr}')`);
  }

  if (options?.channel) {
    filters.push(`{Channel} = '${options.channel}'`);
  }

  if (options?.storeId) {
    filters.push(`FIND("${options.storeId}", ARRAYJOIN({Store}))`);
  }

  if (options?.marketId) {
    filters.push(`FIND("${options.marketId}", ARRAYJOIN({Market}))`);
  }

  if (options?.campaignId) {
    filters.push(`FIND("${options.campaignId}", ARRAYJOIN({Campaign}))`);
  }

  if (options?.programId) {
    filters.push(`FIND("${options.programId}", ARRAYJOIN({Program}))`);
  }

  if (options?.metricNames && options.metricNames.length > 0) {
    const metricFilter = options.metricNames
      .map((m) => `{Metric Name} = '${m}'`)
      .join(', ');
    filters.push(`OR(${metricFilter})`);
  }

  const filterFormula =
    filters.length > 1 ? `AND(${filters.join(', ')})` : filters[0];

  const url = `https://api.airtable.com/v0/${config.baseId}/${encodeURIComponent(TABLE_NAME)}?filterByFormula=${encodeURIComponent(filterFormula)}&sort%5B0%5D%5Bfield%5D=Date&sort%5B0%5D%5Bdirection%5D=desc`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('[MediaPerformance] Failed to fetch:', response.status);
      return [];
    }

    const data = await response.json();
    return (data.records || []).map(mapAirtableToMediaPerformance);
  } catch (error) {
    console.error('[MediaPerformance] Error fetching performance data:', error);
    return [];
  }
}

/**
 * Get aggregated metrics for a company (last 30 days)
 */
export async function getLast30DayMetrics(
  companyId: string
): Promise<{
  spend: number;
  calls: number;
  installs: number;
  leads: number;
  impressions: number;
  clicks: number;
}> {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const performance = await getMediaPerformanceByCompany(companyId, {
    range: { start: thirtyDaysAgo, end: now },
  });

  const metrics = {
    spend: 0,
    calls: 0,
    installs: 0,
    leads: 0,
    impressions: 0,
    clicks: 0,
  };

  for (const point of performance) {
    switch (point.metricName) {
      case 'Spend':
        metrics.spend += point.metricValue;
        break;
      case 'Calls':
        metrics.calls += point.metricValue;
        break;
      case 'Installs':
        metrics.installs += point.metricValue;
        break;
      case 'LSAs Leads':
        metrics.leads += point.metricValue;
        break;
      case 'Impressions':
        metrics.impressions += point.metricValue;
        break;
      case 'Clicks':
        metrics.clicks += point.metricValue;
        break;
    }
  }

  return metrics;
}

/**
 * Get performance by channel (last 30 days)
 */
export async function getPerformanceByChannel(
  companyId: string
): Promise<Partial<Record<MediaChannel, { spend: number; calls: number; clicks: number }>>> {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const performance = await getMediaPerformanceByCompany(companyId, {
    range: { start: thirtyDaysAgo, end: now },
  });

  const byChannel: Partial<Record<MediaChannel, { spend: number; calls: number; clicks: number }>> = {};

  for (const point of performance) {
    const channel = point.channel || 'Other';
    if (!byChannel[channel]) {
      byChannel[channel] = { spend: 0, calls: 0, clicks: 0 };
    }

    switch (point.metricName) {
      case 'Spend':
        byChannel[channel]!.spend += point.metricValue;
        break;
      case 'Calls':
        byChannel[channel]!.calls += point.metricValue;
        break;
      case 'Clicks':
        byChannel[channel]!.clicks += point.metricValue;
        break;
    }
  }

  return byChannel;
}

/**
 * Create a performance data point
 */
export async function createMediaPerformancePoint(
  point: Omit<MediaPerformancePoint, 'id' | 'createdAt'>
): Promise<MediaPerformancePoint | null> {
  const config = getAirtableConfig();
  const url = `https://api.airtable.com/v0/${config.baseId}/${encodeURIComponent(TABLE_NAME)}`;

  const fields: AirtableMediaPerformanceFields = {
    Company: point.companyId ? [point.companyId] : undefined,
    Program: point.programId ? [point.programId] : undefined,
    Campaign: point.campaignId ? [point.campaignId] : undefined,
    Market: point.marketId ? [point.marketId] : undefined,
    Store: point.storeId ? [point.storeId] : undefined,
    Channel: point.channel,
    Date: point.date,
    'Metric Name': point.metricName,
    'Metric Value': point.metricValue,
    'Metric Unit': point.metricUnit,
    'Source System': point.sourceSystem,
    Notes: point.notes,
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
      console.error('[MediaPerformance] Failed to create:', response.status, errorText);
      return null;
    }

    const record = await response.json();
    return mapAirtableToMediaPerformance(record);
  } catch (error) {
    console.error('[MediaPerformance] Error creating performance point:', error);
    return null;
  }
}

/**
 * Bulk create performance data points
 */
export async function bulkCreateMediaPerformance(
  points: Array<Omit<MediaPerformancePoint, 'id' | 'createdAt'>>
): Promise<MediaPerformancePoint[]> {
  const config = getAirtableConfig();
  const url = `https://api.airtable.com/v0/${config.baseId}/${encodeURIComponent(TABLE_NAME)}`;

  // Airtable limits to 10 records per request
  const results: MediaPerformancePoint[] = [];
  const batches: Array<Array<Omit<MediaPerformancePoint, 'id' | 'createdAt'>>> = [];

  for (let i = 0; i < points.length; i += 10) {
    batches.push(points.slice(i, i + 10));
  }

  for (const batch of batches) {
    const records = batch.map((point) => ({
      fields: {
        Company: point.companyId ? [point.companyId] : undefined,
        Program: point.programId ? [point.programId] : undefined,
        Campaign: point.campaignId ? [point.campaignId] : undefined,
        Market: point.marketId ? [point.marketId] : undefined,
        Store: point.storeId ? [point.storeId] : undefined,
        Channel: point.channel,
        Date: point.date,
        'Metric Name': point.metricName,
        'Metric Value': point.metricValue,
        'Metric Unit': point.metricUnit,
        'Source System': point.sourceSystem,
        Notes: point.notes,
      },
    }));

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ records }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[MediaPerformance] Failed to bulk create:', response.status, errorText);
        continue;
      }

      const data = await response.json();
      const createdRecords = (data.records || []).map(mapAirtableToMediaPerformance);
      results.push(...createdRecords);
    } catch (error) {
      console.error('[MediaPerformance] Error in bulk create:', error);
    }
  }

  return results;
}

// ============================================================================
// Upsert Functions (for sync operations)
// ============================================================================

/**
 * Find existing performance point by composite key
 * Used for deduplication during sync
 */
async function findExistingByCompositeKey(
  key: MediaPerformanceCompositeKey
): Promise<MediaPerformancePoint | null> {
  const config = getAirtableConfig();

  // Build filter formula for the composite key
  const filters: string[] = [
    `FIND("${key.companyId}", ARRAYJOIN({Company}))`,
    `{Date} = '${key.date}'`,
    `{Channel} = '${key.channel}'`,
    `{Metric Name} = '${key.metricName}'`,
  ];

  if (key.storeId) {
    filters.push(`FIND("${key.storeId}", ARRAYJOIN({Store}))`);
  } else {
    filters.push(`OR({Store} = '', {Store} = BLANK())`);
  }

  if (key.marketId) {
    filters.push(`FIND("${key.marketId}", ARRAYJOIN({Market}))`);
  }

  if (key.campaignId) {
    filters.push(`FIND("${key.campaignId}", ARRAYJOIN({Campaign}))`);
  }

  const filterFormula = `AND(${filters.join(', ')})`;
  const url = `https://api.airtable.com/v0/${config.baseId}/${encodeURIComponent(TABLE_NAME)}?filterByFormula=${encodeURIComponent(filterFormula)}&maxRecords=1`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('[MediaPerformance] Failed to find existing:', response.status);
      return null;
    }

    const data = await response.json();
    if (data.records && data.records.length > 0) {
      return mapAirtableToMediaPerformance(data.records[0]);
    }
    return null;
  } catch (error) {
    console.error('[MediaPerformance] Error finding existing:', error);
    return null;
  }
}

/**
 * Update an existing performance point
 */
async function updateMediaPerformancePoint(
  recordId: string,
  updates: Partial<Omit<MediaPerformancePoint, 'id' | 'createdAt'>>
): Promise<MediaPerformancePoint | null> {
  const config = getAirtableConfig();
  const url = `https://api.airtable.com/v0/${config.baseId}/${encodeURIComponent(TABLE_NAME)}/${recordId}`;

  const fields: Partial<AirtableMediaPerformanceFields> = {};
  if (updates.metricValue !== undefined) fields['Metric Value'] = updates.metricValue;
  if (updates.notes !== undefined) fields.Notes = updates.notes;
  if (updates.sourceSystem !== undefined) fields['Source System'] = updates.sourceSystem;

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
      console.error('[MediaPerformance] Failed to update:', response.status, errorText);
      return null;
    }

    const record = await response.json();
    return mapAirtableToMediaPerformance(record);
  } catch (error) {
    console.error('[MediaPerformance] Error updating:', error);
    return null;
  }
}

/**
 * Upsert media performance points - creates new or updates existing
 * Uses composite key (companyId, date, channel, metricName, storeId?, marketId?, campaignId?)
 * to prevent duplicates during sync operations.
 *
 * @param points - Array of performance points to upsert
 * @returns Object with created and updated counts
 */
export async function upsertMediaPerformancePoints(
  points: Array<Omit<MediaPerformancePoint, 'id' | 'createdAt'>>
): Promise<{ created: number; updated: number; errors: string[] }> {
  const result = { created: 0, updated: 0, errors: [] as string[] };

  // Process in batches to avoid rate limits
  const BATCH_SIZE = 10;

  for (let i = 0; i < points.length; i += BATCH_SIZE) {
    const batch = points.slice(i, i + BATCH_SIZE);

    // For each point, check if it exists and update or create
    const operations = batch.map(async (point) => {
      const compositeKey: MediaPerformanceCompositeKey = {
        companyId: point.companyId,
        date: point.date,
        channel: point.channel || 'Other',
        metricName: point.metricName,
        storeId: point.storeId,
        marketId: point.marketId,
        campaignId: point.campaignId,
      };

      try {
        const existing = await findExistingByCompositeKey(compositeKey);

        if (existing) {
          // Update existing record
          const updated = await updateMediaPerformancePoint(existing.id, {
            metricValue: point.metricValue,
            notes: point.notes,
            sourceSystem: point.sourceSystem,
          });
          if (updated) {
            result.updated++;
          } else {
            result.errors.push(`Failed to update: ${generateCompositeKey(compositeKey)}`);
          }
        } else {
          // Create new record
          const created = await createMediaPerformancePoint(point);
          if (created) {
            result.created++;
          } else {
            result.errors.push(`Failed to create: ${generateCompositeKey(compositeKey)}`);
          }
        }
      } catch (error) {
        const keyStr = generateCompositeKey(compositeKey);
        result.errors.push(`Error processing ${keyStr}: ${error}`);
      }
    });

    // Wait for batch to complete
    await Promise.all(operations);

    // Small delay between batches to avoid rate limits
    if (i + BATCH_SIZE < points.length) {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }

  console.log('[MediaPerformance] Upsert complete:', result);
  return result;
}

/**
 * Get all performance data for a company within a date range, grouped by store
 */
export async function getPerformanceByStore(
  companyId: string,
  range: { start: Date; end: Date }
): Promise<Record<string, MediaPerformancePoint[]>> {
  const points = await getMediaPerformanceByCompany(companyId, { range });

  const byStore: Record<string, MediaPerformancePoint[]> = {};

  for (const point of points) {
    const storeId = point.storeId || '_company_level_';
    if (!byStore[storeId]) {
      byStore[storeId] = [];
    }
    byStore[storeId].push(point);
  }

  return byStore;
}

/**
 * Get performance data aggregated by date for trend charts
 */
export async function getPerformanceTimeSeries(
  companyId: string,
  range: { start: Date; end: Date },
  metricName: MetricName
): Promise<Array<{ date: string; value: number }>> {
  const points = await getMediaPerformanceByCompany(companyId, {
    range,
    metricNames: [metricName],
  });

  // Group by date and sum
  const byDate: Record<string, number> = {};

  for (const point of points) {
    byDate[point.date] = (byDate[point.date] || 0) + point.metricValue;
  }

  // Convert to array and sort by date
  return Object.entries(byDate)
    .map(([date, value]) => ({ date, value }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
