// lib/airtable/clientInsights.ts
// Airtable helper functions for Client Brain Insights
//
// This stores strategic insights in the Company AI Context table with a specific
// structure for insights (as opposed to general AI context entries).

import { getBase } from '@/lib/airtable';
import type {
  ClientInsight,
  CreateClientInsightPayload,
  UpdateClientInsightPayload,
  ListClientInsightsOptions,
  InsightCategory,
  InsightSeverity,
  InsightStatus,
  InsightSource,
  normalizeInsightCategory,
  normalizeInsightSeverity,
} from '@/lib/types/clientBrain';

// ============================================================================
// Table Configuration
// ============================================================================

// We use the Company AI Context table but with Type = 'Client Insight'
const CLIENT_INSIGHTS_TABLE =
  process.env.AIRTABLE_CLIENT_INSIGHTS_TABLE || 'Client Insights';

// ============================================================================
// Field Mapping
// ============================================================================

/**
 * Map Airtable record to ClientInsight
 */
function mapRecordToInsight(record: any): ClientInsight {
  const fields = record.fields;

  // Handle linked company field
  const companyIds = fields['Company'] as string[] | undefined;
  const companyId = companyIds?.[0] || '';

  // Parse source JSON
  let source: InsightSource = { type: 'manual' };
  if (fields['Source JSON']) {
    try {
      source = JSON.parse(fields['Source JSON'] as string);
    } catch {
      // Default to manual if parsing fails
    }
  }

  // Build source from individual fields if Source JSON is missing
  if (!source || source.type === 'manual') {
    const sourceType = fields['Source Type'] as string | undefined;
    if (sourceType === 'tool_run') {
      source = {
        type: 'tool_run',
        toolId: (fields['Tool Slug'] as string) || '',
        toolName: (fields['Tool Slug'] as string) || '',
        runId: (fields['Tool Run ID'] as string) || '',
      };
    } else if (sourceType === 'document') {
      source = {
        type: 'document',
        documentId: (fields['Document ID'] as string) || '',
        documentName: '',
      };
    }
  }

  return {
    id: record.id,
    companyId,
    title: (fields['Title'] as string) || '',
    body: (fields['Body'] as string) || '',
    category: (fields['Category'] as InsightCategory) || 'other',
    severity: (fields['Severity'] as InsightSeverity) || 'medium',
    status: (fields['Status'] as InsightStatus) || 'open',
    createdAt: (fields['Created At'] as string) || new Date().toISOString(),
    updatedAt: (fields['Last Modified Time'] as string) || undefined,
    source,
    tags: (fields['Tags'] as string[]) || [],
    workItemCount: (fields['Work Item Count'] as number) || 0,
    linkedWorkItemId: (fields['Linked Work Item ID'] as string) || undefined,
    recommendation: (fields['Recommendation'] as string) || undefined,
    rationale: (fields['Rationale'] as string) || undefined,
    contextPaths: (fields['Context Paths'] as string[]) || undefined,
  };
}

/**
 * Convert ClientInsight fields to Airtable fields
 */
function insightToAirtableFields(
  payload: CreateClientInsightPayload | UpdateClientInsightPayload,
  isCreate: boolean = false
): Record<string, unknown> {
  const fields: Record<string, unknown> = {};

  if ('companyId' in payload && payload.companyId) {
    fields['Company'] = [payload.companyId];
    // Also populate the Company ID text field for easier filtering
    fields['Company ID'] = payload.companyId;
  }

  if ('title' in payload && payload.title !== undefined) {
    fields['Title'] = payload.title;
  }

  if ('body' in payload && payload.body !== undefined) {
    fields['Body'] = payload.body;
  }

  if ('category' in payload && payload.category !== undefined) {
    fields['Category'] = payload.category;
  }

  if ('severity' in payload && payload.severity !== undefined) {
    fields['Severity'] = payload.severity;
  }

  if ('status' in payload && payload.status !== undefined) {
    fields['Status'] = payload.status;
  }

  if ('linkedWorkItemId' in payload && payload.linkedWorkItemId !== undefined) {
    fields['Linked Work Item ID'] = payload.linkedWorkItemId;
  }

  if ('recommendation' in payload && payload.recommendation !== undefined) {
    fields['Recommendation'] = payload.recommendation;
  }

  if ('rationale' in payload && payload.rationale !== undefined) {
    fields['Rationale'] = payload.rationale;
  }

  if ('contextPaths' in payload && payload.contextPaths !== undefined) {
    fields['Context Paths'] = payload.contextPaths;
  }

  if ('source' in payload && payload.source !== undefined) {
    fields['Source JSON'] = JSON.stringify(payload.source);
    // Also populate individual source fields for easier Airtable filtering
    fields['Source Type'] = payload.source.type;

    if (payload.source.type === 'tool_run') {
      fields['Tool Slug'] = payload.source.toolId;
      fields['Tool Run ID'] = payload.source.runId;
    } else if (payload.source.type === 'document') {
      fields['Document ID'] = payload.source.documentId;
    }
  }

  if ('tags' in payload && payload.tags !== undefined) {
    fields['Tags'] = payload.tags;
  }

  return fields;
}

// ============================================================================
// CRUD Operations
// ============================================================================

/**
 * Create a new Client Insight
 */
export async function createClientInsight(
  payload: CreateClientInsightPayload
): Promise<ClientInsight> {
  const base = getBase();

  console.log('[ClientInsights] Creating insight:', {
    companyId: payload.companyId,
    category: payload.category,
    severity: payload.severity,
    titlePreview: payload.title.substring(0, 50),
  });

  const fields = insightToAirtableFields(payload, true);

  const records = await base(CLIENT_INSIGHTS_TABLE).create([
    { fields: fields as any },
  ]);

  const insight = mapRecordToInsight(records[0]);
  console.log('[ClientInsights] ✅ Insight created:', insight.id);

  return insight;
}

/**
 * Create multiple Client Insights in batch
 */
export async function createClientInsights(
  payloads: CreateClientInsightPayload[]
): Promise<ClientInsight[]> {
  if (payloads.length === 0) return [];

  const base = getBase();

  console.log('[ClientInsights] Creating batch of', payloads.length, 'insights');

  // Airtable allows max 10 records per batch
  const batchSize = 10;
  const results: ClientInsight[] = [];

  for (let i = 0; i < payloads.length; i += batchSize) {
    const batch = payloads.slice(i, i + batchSize);
    const records = await base(CLIENT_INSIGHTS_TABLE).create(
      batch.map((p) => ({
        fields: insightToAirtableFields(p, true) as any,
      }))
    );

    results.push(...records.map(mapRecordToInsight));
  }

  console.log('[ClientInsights] ✅ Created', results.length, 'insights');
  return results;
}

/**
 * Get a single Client Insight by ID
 */
export async function getClientInsight(id: string): Promise<ClientInsight | null> {
  try {
    const base = getBase();
    const record = await base(CLIENT_INSIGHTS_TABLE).find(id);

    if (!record) return null;
    return mapRecordToInsight(record);
  } catch (error) {
    console.error('[ClientInsights] Failed to get insight:', id, error);
    return null;
  }
}

/**
 * List Client Insights for a company
 */
export async function listClientInsightsForCompany(
  companyId: string,
  options: ListClientInsightsOptions = {}
): Promise<ClientInsight[]> {
  try {
    const base = getBase();
    const { limit = 100, category, severity, sourceType } = options;

    // Build filter formula
    const filterParts: string[] = [];
    filterParts.push(`FIND("${companyId}", ARRAYJOIN({Company}))`);

    if (category) {
      filterParts.push(`{Category} = "${category}"`);
    }

    if (severity) {
      filterParts.push(`{Severity} = "${severity}"`);
    }

    const filterFormula =
      filterParts.length > 1
        ? `AND(${filterParts.join(', ')})`
        : filterParts[0];

    console.log('[ClientInsights] Listing insights:', {
      companyId,
      limit,
      category,
      severity,
    });

    const records = await base(CLIENT_INSIGHTS_TABLE)
      .select({
        filterByFormula: filterFormula,
        maxRecords: limit,
        sort: [{ field: 'Created At', direction: 'desc' }],
      })
      .all();

    let insights = records.map(mapRecordToInsight);

    // Post-filter by source type if needed
    if (sourceType) {
      insights = insights.filter((i) => i.source.type === sourceType);
    }

    console.log('[ClientInsights] ✅ Found', insights.length, 'insights');
    return insights;
  } catch (error) {
    console.error('[ClientInsights] Failed to list insights:', error);
    return [];
  }
}

/**
 * Update a Client Insight
 */
export async function updateClientInsight(
  id: string,
  payload: UpdateClientInsightPayload
): Promise<ClientInsight | null> {
  try {
    const base = getBase();
    const fields = insightToAirtableFields(payload, false);

    const records = await base(CLIENT_INSIGHTS_TABLE).update([
      { id, fields: fields as any },
    ]);

    const insight = mapRecordToInsight(records[0]);
    console.log('[ClientInsights] ✅ Insight updated:', id);

    return insight;
  } catch (error) {
    console.error('[ClientInsights] Failed to update insight:', id, error);
    return null;
  }
}

/**
 * Delete a Client Insight
 */
export async function deleteClientInsight(id: string): Promise<boolean> {
  try {
    const base = getBase();
    await base(CLIENT_INSIGHTS_TABLE).destroy(id);

    console.log('[ClientInsights] ✅ Insight deleted:', id);
    return true;
  } catch (error) {
    console.error('[ClientInsights] Failed to delete insight:', id, error);
    return false;
  }
}

/**
 * Increment work item count for an insight
 */
export async function incrementInsightWorkItemCount(
  id: string,
  increment: number = 1
): Promise<void> {
  try {
    const insight = await getClientInsight(id);
    if (!insight) return;

    const base = getBase();
    await base(CLIENT_INSIGHTS_TABLE).update([
      {
        id,
        fields: {
          'Work Item Count': (insight.workItemCount || 0) + increment,
          'Updated At': new Date().toISOString(),
        } as any,
      },
    ]);

    console.log('[ClientInsights] ✅ Incremented work item count for:', id);
  } catch (error) {
    console.error('[ClientInsights] Failed to increment work item count:', error);
  }
}
