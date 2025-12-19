// lib/airtable/activities.ts
// Airtable helpers for Activities table
//
// Activities track interactions with companies/opportunities (emails, calls, meetings, etc.)
// Supports deduplication by external message ID for email integrations.

import { getBase } from '@/lib/airtable';

const ACTIVITIES_TABLE = process.env.AIRTABLE_ACTIVITIES_TABLE || 'Activities';

// ============================================================================
// Types
// ============================================================================

export type ActivityType = 'email' | 'call' | 'meeting' | 'note' | 'task' | 'other';
export type ActivityDirection = 'inbound' | 'outbound';
export type ActivitySource = 'gmail-addon' | 'manual' | 'zapier' | 'api';

/**
 * Activity record from Airtable
 */
export interface ActivityRecord {
  id: string;
  opportunityId: string | null;
  companyId: string | null;
  type: ActivityType;
  direction: ActivityDirection;
  title: string;
  subject: string | null;
  fromName: string | null;
  fromEmail: string | null;
  to: string | null;
  cc: string | null;
  snippet: string | null;
  bodyText: string | null;
  receivedAt: string | null;
  source: ActivitySource;
  externalMessageId: string | null;
  externalThreadId: string | null;
  externalUrl: string | null;
  createdAt: string | null;
}

/**
 * Parameters for creating an activity
 */
export interface CreateActivityParams {
  /** Opportunity to link to (optional for standalone activities) */
  opportunityId?: string;
  companyId?: string;
  type: ActivityType;
  direction: ActivityDirection;
  title: string;
  subject?: string;
  fromName?: string;
  fromEmail?: string;
  to?: string[];
  cc?: string[];
  snippet?: string;
  bodyText?: string;
  receivedAt?: string;
  source: ActivitySource;
  externalMessageId?: string;
  externalThreadId?: string;
  externalUrl?: string;
  rawPayload?: Record<string, unknown>;
}

// ============================================================================
// Mapping
// ============================================================================

/**
 * Map Airtable record to ActivityRecord
 */
function mapRecordToActivity(record: any): ActivityRecord {
  const fields = record.fields;

  // Opportunity and Company are linked record fields
  const opportunityLinks = fields['Opportunity'] as string[] | undefined;
  const companyLinks = fields['Company'] as string[] | undefined;

  return {
    id: record.id,
    opportunityId: opportunityLinks?.[0] || null,
    companyId: companyLinks?.[0] || null,
    type: (fields['Type'] as ActivityType) || 'email',
    direction: (fields['Direction'] as ActivityDirection) || 'inbound',
    title: (fields['Title'] as string) || 'Untitled Activity',
    subject: (fields['Subject'] as string) || null,
    fromName: (fields['From Name'] as string) || null,
    fromEmail: (fields['From Email'] as string) || null,
    to: (fields['To'] as string) || null,
    cc: (fields['CC'] as string) || null,
    snippet: (fields['Snippet'] as string) || null,
    bodyText: (fields['Body Text'] as string) || null,
    receivedAt: (fields['Received At'] as string) || null,
    source: (fields['Source'] as ActivitySource) || 'manual',
    externalMessageId: (fields['External Message ID'] as string) || null,
    externalThreadId: (fields['External Thread ID'] as string) || null,
    externalUrl: (fields['External URL'] as string) || null,
    createdAt: (fields['Created At'] as string) || null,
  };
}

// ============================================================================
// Lookup Operations
// ============================================================================

/**
 * Find an activity by external message ID and source
 *
 * Used for deduplication - prevents creating duplicate activities
 * for the same email message.
 *
 * @param source - Activity source (e.g., 'gmail-addon')
 * @param externalMessageId - External message ID (e.g., Gmail message ID)
 * @returns Activity record with linked opportunity, or null if not found
 */
export async function findActivityByExternalMessageId(
  source: ActivitySource,
  externalMessageId: string
): Promise<{ activity: ActivityRecord; opportunityId: string | null } | null> {
  try {
    const base = getBase();

    const records = await base(ACTIVITIES_TABLE)
      .select({
        filterByFormula: `AND({Source} = "${source}", {External Message ID} = "${externalMessageId}")`,
        maxRecords: 1,
      })
      .firstPage();

    if (records.length === 0) {
      return null;
    }

    const activity = mapRecordToActivity(records[0]);
    return {
      activity,
      opportunityId: activity.opportunityId,
    };
  } catch (error) {
    console.error(`[Activities] Failed to find activity by external message ID:`, error);
    return null;
  }
}

/**
 * Find activities by external thread ID
 *
 * Returns all activities in a thread, sorted by received date descending (newest first).
 * Used for thread attachment logic.
 *
 * @param source - Activity source (e.g., 'gmail-addon')
 * @param externalThreadId - External thread ID (e.g., Gmail thread ID)
 * @param limit - Maximum number of activities to return (default: 10)
 * @returns Array of activity records, newest first
 */
export async function findActivitiesByExternalThreadId(
  source: ActivitySource,
  externalThreadId: string,
  limit: number = 10
): Promise<ActivityRecord[]> {
  try {
    const base = getBase();

    const records = await base(ACTIVITIES_TABLE)
      .select({
        filterByFormula: `AND({Source} = "${source}", {External Thread ID} = "${externalThreadId}")`,
        sort: [{ field: 'Received At', direction: 'desc' }],
        maxRecords: limit,
      })
      .firstPage();

    return records.map(mapRecordToActivity);
  } catch (error) {
    console.error(`[Activities] Failed to find activities by thread ID:`, error);
    return [];
  }
}

/**
 * Find the most recent activity by external thread ID (legacy helper)
 *
 * @param externalThreadId - External thread ID (e.g., Gmail thread ID)
 * @returns Most recent activity with its linked opportunity, or null if not found
 * @deprecated Use findActivitiesByExternalThreadId for more control
 */
export async function findActivityByExternalThreadId(
  externalThreadId: string
): Promise<{ activity: ActivityRecord; opportunityId: string | null } | null> {
  try {
    const base = getBase();

    // Sort by Received At descending to get most recent
    const records = await base(ACTIVITIES_TABLE)
      .select({
        filterByFormula: `{External Thread ID} = "${externalThreadId}"`,
        sort: [{ field: 'Received At', direction: 'desc' }],
        maxRecords: 1,
      })
      .firstPage();

    if (records.length === 0) {
      return null;
    }

    const activity = mapRecordToActivity(records[0]);
    return {
      activity,
      opportunityId: activity.opportunityId,
    };
  } catch (error) {
    console.error(`[Activities] Failed to find activity by thread ID:`, error);
    return null;
  }
}

// ============================================================================
// Create Operations
// ============================================================================

/**
 * Create a new activity
 *
 * Field mapping for Gmail inbound:
 * - Title: subject || "Inbound email"
 * - Type: "email"
 * - Direction: "inbound"
 * - Subject, From Name, From Email, To, CC, Snippet, Body Text
 * - Received At: ISO string
 * - Source: "gmail-addon"
 * - External Message ID, External Thread ID, External URL
 * - Raw Payload (JSON): stringified request
 * - DO NOT set Created At (Airtable auto-generates)
 * - DO NOT set Confidence or AI Summary
 *
 * @param params - Activity parameters
 * @returns Created activity record or null on error
 */
export async function createActivity(
  params: CreateActivityParams
): Promise<ActivityRecord | null> {
  try {
    const base = getBase();

    const fields: Record<string, unknown> = {
      'Type': params.type,
      'Direction': params.direction,
      'Title': params.title || 'Inbound email',
      'Source': params.source,
    };

    // Link to opportunity if provided (optional for standalone activities)
    if (params.opportunityId) {
      fields['Opportunity'] = [params.opportunityId];
    }

    // Link to company if provided
    if (params.companyId) {
      fields['Company'] = [params.companyId];
    }

    // Email fields - always set (use empty string if not provided)
    fields['Subject'] = params.subject || '';
    fields['From Name'] = params.fromName || '';
    fields['From Email'] = params.fromEmail || '';
    fields['To'] = params.to ? params.to.join(', ') : '';
    fields['CC'] = params.cc ? params.cc.join(', ') : '';
    fields['Snippet'] = params.snippet || '';
    fields['Body Text'] = params.bodyText ? params.bodyText.slice(0, 10000) : '';

    // Timestamps and external IDs
    if (params.receivedAt) {
      fields['Received At'] = params.receivedAt;
    }
    if (params.externalMessageId) {
      fields['External Message ID'] = params.externalMessageId;
    }
    if (params.externalThreadId) {
      fields['External Thread ID'] = params.externalThreadId;
    }
    fields['External URL'] = params.externalUrl || '';

    // Raw payload for debugging
    if (params.rawPayload) {
      fields['Raw Payload (JSON)'] = JSON.stringify(params.rawPayload);
    }

    // Note: Do NOT set 'Created At' - Airtable auto-generates
    // Note: Do NOT set 'Confidence' or 'AI Summary' - leave blank

    const records = await base(ACTIVITIES_TABLE).create([{ fields: fields as any }]);
    const createdRecord = records[0];

    console.log(`[Activities] Created activity: ${createdRecord.id} (${params.title})`);
    return mapRecordToActivity(createdRecord);
  } catch (error) {
    console.error('[Activities] Failed to create activity:', error);
    return null;
  }
}

// ============================================================================
// Query Operations
// ============================================================================

/**
 * Get activities for an opportunity
 *
 * @param opportunityId - Airtable record ID of the opportunity
 * @param limit - Maximum number of activities to return (default: 50)
 * @returns Array of activity records, sorted by received date descending
 */
export async function getActivitiesForOpportunity(
  opportunityId: string,
  limit: number = 50
): Promise<ActivityRecord[]> {
  try {
    const base = getBase();

    // Use FIND to match linked records
    const records = await base(ACTIVITIES_TABLE)
      .select({
        filterByFormula: `FIND("${opportunityId}", ARRAYJOIN({Opportunity}))`,
        sort: [{ field: 'Received At', direction: 'desc' }],
        maxRecords: limit,
      })
      .all();

    return records.map(mapRecordToActivity);
  } catch (error) {
    console.error(`[Activities] Failed to get activities for opportunity ${opportunityId}:`, error);
    return [];
  }
}

/**
 * Get activities for a company
 *
 * @param companyId - Airtable record ID of the company
 * @param limit - Maximum number of activities to return (default: 50)
 * @returns Array of activity records, sorted by received date descending
 */
export async function getActivitiesForCompany(
  companyId: string,
  limit: number = 50
): Promise<ActivityRecord[]> {
  try {
    const base = getBase();

    const records = await base(ACTIVITIES_TABLE)
      .select({
        filterByFormula: `FIND("${companyId}", ARRAYJOIN({Company}))`,
        sort: [{ field: 'Received At', direction: 'desc' }],
        maxRecords: limit,
      })
      .all();

    return records.map(mapRecordToActivity);
  } catch (error) {
    console.error(`[Activities] Failed to get activities for company ${companyId}:`, error);
    return [];
  }
}
