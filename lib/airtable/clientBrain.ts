// lib/airtable/clientBrain.ts
// Airtable CRUD helpers for Client Brain (Insights + Documents)

import {
  createRecord,
  updateRecord,
  deleteRecord,
  getAirtableConfig,
} from './client';
import { AIRTABLE_TABLES } from './tables';
import type {
  ClientInsight,
  ClientDocument,
  CreateClientInsightInput,
  CreateClientDocumentInput,
  InsightSource,
  InsightCategory,
  InsightSeverity,
  InsightStatus,
  DocumentType,
} from '@/lib/types/clientBrain';

// ============================================================================
// Client Insights CRUD
// ============================================================================

/**
 * Create a new Client Insight
 */
export async function createClientInsight(
  companyId: string,
  input: CreateClientInsightInput
): Promise<ClientInsight> {
  // Build an extended body that includes recommendation, rationale, etc.
  // since those fields don't exist in the Airtable schema
  let body = input.body;

  // Append extra info to body if not already included
  // (The repo already does this, but just in case)
  if (input.recommendation && !body.includes(input.recommendation)) {
    body += `\n\n**Recommendation:** ${input.recommendation}`;
  }
  if (input.rationale && !body.includes(input.rationale)) {
    body += `\n\n**Why this matters:** ${input.rationale}`;
  }
  if (input.contextPaths && input.contextPaths.length > 0) {
    body += `\n\n**Related Context:** ${input.contextPaths.join(', ')}`;
  }
  if (input.metrics && Object.keys(input.metrics).length > 0) {
    body += `\n\n**Metrics:** ${JSON.stringify(input.metrics)}`;
  }

  const fields: Record<string, unknown> = {
    Title: input.title,
    Body: body,
    Category: input.category,
    'Company ID': companyId,
    'Source Type': input.source.type,
  };

  if (input.severity) {
    fields['Severity'] = input.severity;
  }

  // Add source-specific fields
  if (input.source.type === 'tool_run') {
    fields['Tool Slug'] = input.source.toolSlug;
    fields['Tool Run ID'] = input.source.toolRunId;
  } else if (input.source.type === 'document') {
    fields['Document ID'] = input.source.documentId;
  } else if (input.source.type === 'manual' && input.source.createdBy) {
    fields['Created By'] = input.source.createdBy;
  }

  const result = await createRecord(AIRTABLE_TABLES.CLIENT_INSIGHTS, fields);

  return mapRecordToInsight(result);
}

/**
 * Get all insights for a company
 */
export async function getCompanyInsights(
  companyId: string,
  options: {
    category?: InsightCategory;
    severity?: InsightSeverity;
    limit?: number;
  } = {}
): Promise<ClientInsight[]> {
  const config = getAirtableConfig();

  const filterFormulas: string[] = [`{Company ID} = "${companyId}"`];

  if (options.category) {
    filterFormulas.push(`{Category} = "${options.category}"`);
  }
  if (options.severity) {
    filterFormulas.push(`{Severity} = "${options.severity}"`);
  }

  const filterFormula =
    filterFormulas.length > 1
      ? `AND(${filterFormulas.join(', ')})`
      : filterFormulas[0];

  const url = new URL(
    `https://api.airtable.com/v0/${config.baseId}/${encodeURIComponent(
      AIRTABLE_TABLES.CLIENT_INSIGHTS
    )}`
  );
  url.searchParams.set('filterByFormula', filterFormula);
  url.searchParams.set('sort[0][field]', 'Created At');
  url.searchParams.set('sort[0][direction]', 'desc');
  if (options.limit) {
    url.searchParams.set('maxRecords', String(options.limit));
  }

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    if (response.status === 404 || response.status === 422) {
      return [];
    }
    const errorText = await response.text();
    throw new Error(`Airtable API error (${response.status}): ${errorText}`);
  }

  const result = await response.json();
  return (result.records || []).map(mapRecordToInsight);
}

/**
 * Get a single insight by ID
 */
export async function getInsightById(
  insightId: string
): Promise<ClientInsight | null> {
  const config = getAirtableConfig();
  const url = `https://api.airtable.com/v0/${config.baseId}/${encodeURIComponent(
    AIRTABLE_TABLES.CLIENT_INSIGHTS
  )}/${insightId}`;

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
      throw new Error(`Airtable API error (${response.status})`);
    }

    const result = await response.json();
    return mapRecordToInsight(result);
  } catch {
    return null;
  }
}

/**
 * Update an insight
 */
export async function updateInsight(
  insightId: string,
  updates: Partial<Pick<ClientInsight, 'title' | 'body' | 'category' | 'severity' | 'status' | 'recommendation' | 'rationale' | 'linkedWorkItemId'>>
): Promise<ClientInsight> {
  const fields: Record<string, unknown> = {};

  if (updates.title !== undefined) fields['Title'] = updates.title;
  if (updates.body !== undefined) fields['Body'] = updates.body;
  if (updates.category !== undefined) fields['Category'] = updates.category;
  if (updates.severity !== undefined) fields['Severity'] = updates.severity;
  if (updates.status !== undefined) fields['Status'] = updates.status;
  if (updates.recommendation !== undefined) fields['Recommendation'] = updates.recommendation;
  if (updates.rationale !== undefined) fields['Rationale'] = updates.rationale;
  if (updates.linkedWorkItemId !== undefined) fields['Linked Work Item ID'] = updates.linkedWorkItemId;

  const result = await updateRecord(AIRTABLE_TABLES.CLIENT_INSIGHTS, insightId, fields);
  return mapRecordToInsight(result);
}

// Alias for updateInsight
export const updateClientInsight = updateInsight;

/**
 * Delete an insight
 */
export async function deleteInsight(insightId: string): Promise<void> {
  await deleteRecord(AIRTABLE_TABLES.CLIENT_INSIGHTS, insightId);
}

/**
 * Bulk create insights (for batch extraction)
 */
export async function createInsightsBatch(
  companyId: string,
  inputs: CreateClientInsightInput[]
): Promise<ClientInsight[]> {
  const config = getAirtableConfig();

  // Airtable allows max 10 records per batch
  const batches: CreateClientInsightInput[][] = [];
  for (let i = 0; i < inputs.length; i += 10) {
    batches.push(inputs.slice(i, i + 10));
  }

  const allInsights: ClientInsight[] = [];

  for (const batch of batches) {
    const records = batch.map((input) => {
      const fields: Record<string, unknown> = {
        Title: input.title,
        Body: input.body,
        Category: input.category,
        'Company ID': companyId,
        'Source Type': input.source.type,
      };

      if (input.severity) {
        fields['Severity'] = input.severity;
      }

      if (input.source.type === 'tool_run') {
        fields['Tool Slug'] = input.source.toolSlug;
        fields['Tool Run ID'] = input.source.toolRunId;
      } else if (input.source.type === 'document') {
        fields['Document ID'] = input.source.documentId;
      }

      return { fields };
    });

    const url = `https://api.airtable.com/v0/${config.baseId}/${encodeURIComponent(
      AIRTABLE_TABLES.CLIENT_INSIGHTS
    )}`;

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
      throw new Error(`Airtable API error (${response.status}): ${errorText}`);
    }

    const result = await response.json();
    allInsights.push(...(result.records || []).map(mapRecordToInsight));
  }

  return allInsights;
}

// ============================================================================
// Client Documents CRUD
// ============================================================================

/**
 * Create a new Client Document record
 */
export async function createClientDocument(
  input: CreateClientDocumentInput
): Promise<ClientDocument> {
  const fields: Record<string, unknown> = {
    Name: input.name,
    'Company ID': input.companyId,
    'MIME Type': input.mimeType,
    'Size Bytes': input.sizeBytes,
    'Storage URL': input.storageUrl,
  };

  if (input.type) fields['Type'] = input.type;
  if (input.uploadedBy) fields['Uploaded By'] = input.uploadedBy;
  if (input.textExtracted !== undefined) fields['Text Extracted'] = input.textExtracted;
  if (input.textPreview) fields['Text Preview'] = input.textPreview;
  if (input.notes) fields['Notes'] = input.notes;

  const result = await createRecord(AIRTABLE_TABLES.CLIENT_DOCUMENTS, fields);
  return mapRecordToDocument(result);
}

/**
 * Get all documents for a company
 */
export async function getCompanyDocuments(
  companyId: string,
  options: {
    type?: DocumentType;
    limit?: number;
  } = {}
): Promise<ClientDocument[]> {
  const config = getAirtableConfig();

  const filterFormulas: string[] = [`{Company ID} = "${companyId}"`];

  if (options.type) {
    filterFormulas.push(`{Type} = "${options.type}"`);
  }

  const filterFormula =
    filterFormulas.length > 1
      ? `AND(${filterFormulas.join(', ')})`
      : filterFormulas[0];

  const url = new URL(
    `https://api.airtable.com/v0/${config.baseId}/${encodeURIComponent(
      AIRTABLE_TABLES.CLIENT_DOCUMENTS
    )}`
  );
  url.searchParams.set('filterByFormula', filterFormula);
  url.searchParams.set('sort[0][field]', 'Uploaded At');
  url.searchParams.set('sort[0][direction]', 'desc');
  if (options.limit) {
    url.searchParams.set('maxRecords', String(options.limit));
  }

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    if (response.status === 404 || response.status === 422) {
      return [];
    }
    const errorText = await response.text();
    throw new Error(`Airtable API error (${response.status}): ${errorText}`);
  }

  const result = await response.json();
  return (result.records || []).map(mapRecordToDocument);
}

/**
 * Get a single document by ID
 */
export async function getDocumentById(
  documentId: string
): Promise<ClientDocument | null> {
  const config = getAirtableConfig();
  const url = `https://api.airtable.com/v0/${config.baseId}/${encodeURIComponent(
    AIRTABLE_TABLES.CLIENT_DOCUMENTS
  )}/${documentId}`;

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
      throw new Error(`Airtable API error (${response.status})`);
    }

    const result = await response.json();
    return mapRecordToDocument(result);
  } catch {
    return null;
  }
}

/**
 * Update a document
 */
export async function updateDocument(
  documentId: string,
  updates: Partial<
    Pick<ClientDocument, 'name' | 'type' | 'textExtracted' | 'textPreview' | 'notes'>
  >
): Promise<ClientDocument> {
  const fields: Record<string, unknown> = {};

  if (updates.name !== undefined) fields['Name'] = updates.name;
  if (updates.type !== undefined) fields['Type'] = updates.type;
  if (updates.textExtracted !== undefined) fields['Text Extracted'] = updates.textExtracted;
  if (updates.textPreview !== undefined) fields['Text Preview'] = updates.textPreview;
  if (updates.notes !== undefined) fields['Notes'] = updates.notes;

  const result = await updateRecord(AIRTABLE_TABLES.CLIENT_DOCUMENTS, documentId, fields);
  return mapRecordToDocument(result);
}

/**
 * Delete a document
 */
export async function deleteDocument(documentId: string): Promise<void> {
  await deleteRecord(AIRTABLE_TABLES.CLIENT_DOCUMENTS, documentId);
}

// ============================================================================
// Record Mappers
// ============================================================================

interface AirtableRecord {
  id: string;
  fields: Record<string, unknown>;
}

function mapRecordToInsight(record: AirtableRecord): ClientInsight {
  const fields = record.fields;

  // Reconstruct source from individual fields
  let source: InsightSource;
  const sourceType = fields['Source Type'] as string;
  if (sourceType === 'tool_run') {
    source = {
      type: 'tool_run',
      toolSlug: fields['Tool Slug'] as string,
      toolRunId: fields['Tool Run ID'] as string,
    };
  } else if (sourceType === 'document') {
    source = {
      type: 'document',
      documentId: fields['Document ID'] as string,
    };
  } else {
    source = {
      type: 'manual',
      createdBy: fields['Created By'] as string | undefined,
    };
  }

  // Parse JSON fields
  let contextPaths: string[] | undefined;
  let metrics: Record<string, unknown> | undefined;

  try {
    if (fields['Context Paths']) {
      contextPaths = JSON.parse(fields['Context Paths'] as string);
    }
  } catch {
    // Ignore parse errors
  }

  try {
    if (fields['Metrics']) {
      metrics = JSON.parse(fields['Metrics'] as string);
    }
  } catch {
    // Ignore parse errors
  }

  return {
    id: record.id,
    companyId: fields['Company ID'] as string,
    title: fields['Title'] as string,
    body: fields['Body'] as string,
    category: (fields['Category'] as InsightCategory) || 'other',
    severity: fields['Severity'] as InsightSeverity | undefined,
    status: (fields['Status'] as InsightStatus) || 'open',
    createdAt: (fields['Created At'] as string) || new Date().toISOString(),
    updatedAt: fields['Updated At'] as string | undefined,
    source,
    recommendation: fields['Recommendation'] as string | undefined,
    rationale: fields['Rationale'] as string | undefined,
    contextPaths,
    metrics,
    linkedWorkItemId: fields['Linked Work Item ID'] as string | undefined,
    relatedWorkCount: fields['Related Work Count'] as number | undefined,
    lastUsedInWorkAt: fields['Last Used In Work At'] as string | null | undefined,
  };
}

function mapRecordToDocument(record: AirtableRecord): ClientDocument {
  const fields = record.fields;

  return {
    id: record.id,
    companyId: fields['Company ID'] as string,
    name: fields['Name'] as string,
    type: (fields['Type'] as DocumentType) || null,
    mimeType: fields['MIME Type'] as string,
    sizeBytes: fields['Size Bytes'] as number,
    uploadedAt: (fields['Uploaded At'] as string) || new Date().toISOString(),
    uploadedBy: fields['Uploaded By'] as string | null,
    storageUrl: fields['Storage URL'] as string,
    textExtracted: fields['Text Extracted'] as boolean | undefined,
    textPreview: fields['Text Preview'] as string | null | undefined,
    notes: fields['Notes'] as string | null | undefined,
  };
}

// ============================================================================
// Insight Aggregation Helpers
// ============================================================================

/**
 * Get insights summary for a company (grouped by category)
 */
export async function getInsightsSummary(companyId: string): Promise<{
  total: number;
  byCategory: Record<InsightCategory, number>;
  bySeverity: Record<InsightSeverity, number>;
  recentCount: number;
}> {
  const insights = await getCompanyInsights(companyId, { limit: 500 });

  const byCategory: Record<InsightCategory, number> = {
    brand: 0,
    content: 0,
    seo: 0,
    seo_content: 0,
    website: 0,
    analytics: 0,
    demand: 0,
    ops: 0,
    competitive: 0,
    structural: 0,
    product: 0,
    other: 0,
    // New categories
    growth_opportunity: 0,
    conversion: 0,
    audience: 0,
    creative: 0,
    media: 0,
    kpi_risk: 0,
  };

  const bySeverity: Record<InsightSeverity, number> = {
    low: 0,
    medium: 0,
    high: 0,
    critical: 0,
  };

  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  let recentCount = 0;

  for (const insight of insights) {
    byCategory[insight.category]++;
    if (insight.severity) {
      bySeverity[insight.severity]++;
    }
    if (new Date(insight.createdAt) > oneWeekAgo) {
      recentCount++;
    }
  }

  return {
    total: insights.length,
    byCategory,
    bySeverity,
    recentCount,
  };
}

/**
 * Get insights for AI context injection
 * Returns a formatted string for prompt injection
 */
export async function getInsightsForPrompt(
  companyId: string,
  options: {
    limit?: number;
    categories?: InsightCategory[];
    minSeverity?: InsightSeverity;
  } = {}
): Promise<string> {
  const insights = await getCompanyInsights(companyId, { limit: options.limit || 20 });

  // Filter by categories if specified
  let filtered = insights;
  if (options.categories?.length) {
    filtered = filtered.filter((i) => options.categories!.includes(i.category));
  }

  // Filter by minimum severity if specified
  if (options.minSeverity) {
    const severityOrder: InsightSeverity[] = ['low', 'medium', 'high', 'critical'];
    const minIndex = severityOrder.indexOf(options.minSeverity);
    filtered = filtered.filter((i) => {
      if (!i.severity) return false;
      return severityOrder.indexOf(i.severity) >= minIndex;
    });
  }

  if (filtered.length === 0) {
    return 'No prior insights available for this company.';
  }

  const lines = filtered.map((insight) => {
    const severityTag = insight.severity ? ` [${insight.severity.toUpperCase()}]` : '';
    return `---
**${insight.title}**${severityTag}
Category: ${insight.category}
${insight.body}
---`;
  });

  return `## Prior Company Insights (${filtered.length} entries)

${lines.join('\n\n')}`;
}
