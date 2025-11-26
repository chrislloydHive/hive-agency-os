// lib/airtable/companyAiContext.ts
// Airtable helper functions for Company AI Context (Client Brain) table
//
// This table stores AI-generated insights and context per company to enable
// smarter AI responses over time by building institutional memory.

import { getBase } from '@/lib/airtable';

// ============================================================================
// Table Configuration
// ============================================================================

const COMPANY_AI_CONTEXT_TABLE =
  process.env.AIRTABLE_COMPANY_AI_CONTEXT_TABLE || 'Company AI Context';

// ============================================================================
// Types
// ============================================================================

/**
 * Type of AI context entry
 */
export type CompanyAiContextType =
  | 'GAP IA'
  | 'GAP Full'
  | 'Work Item'
  | 'Analytics Insight'
  | 'Manual Note'
  | 'Strategy'
  | 'Other';

/**
 * Source of the context entry
 */
export type CompanyAiContextSource = 'AI' | 'User' | 'System';

/**
 * Tag options for categorizing context entries
 */
export type CompanyAiContextTag =
  | 'SEO'
  | 'Website'
  | 'Content'
  | 'Brand'
  | 'Analytics'
  | 'Authority'
  | 'Conversion'
  | 'Misc';

/**
 * Company AI Context entry record
 */
export interface CompanyAiContextEntry {
  id: string;
  companyId: string;
  type: CompanyAiContextType;
  content: string;
  source: CompanyAiContextSource;
  tags: string[];
  relatedEntityId?: string | null;
  createdAt: string; // ISO timestamp
  createdBy?: string | null;
}

/**
 * Payload for creating a new context entry
 */
export interface CreateCompanyAiContextPayload {
  companyId: string; // Airtable record ID of the company
  type: CompanyAiContextType;
  content: string;
  source: CompanyAiContextSource;
  tags?: string[];
  relatedEntityId?: string | null;
  createdBy?: string | null;
}

/**
 * Options for fetching context entries
 */
export interface GetCompanyAiContextOptions {
  limit?: number;
  types?: CompanyAiContextType[];
  tags?: string[];
  sinceDate?: string; // ISO date string
}

// ============================================================================
// Field Mapping
// ============================================================================

/**
 * Map Airtable record to CompanyAiContextEntry
 */
function mapRecordToEntry(record: any): CompanyAiContextEntry {
  const fields = record.fields;

  // Handle linked company field (array of record IDs)
  const companyIds = fields['Company'] as string[] | undefined;
  const companyId = companyIds?.[0] || '';

  return {
    id: record.id,
    companyId,
    type: (fields['Type'] as CompanyAiContextType) || 'Other',
    content: (fields['Content'] as string) || '',
    source: (fields['Source'] as CompanyAiContextSource) || 'System',
    tags: (fields['Tags'] as string[]) || [],
    relatedEntityId: (fields['RelatedEntityId'] as string) || null,
    createdAt: (fields['CreatedAt'] as string) || new Date().toISOString(),
    createdBy: (fields['CreatedBy'] as string) || null,
  };
}

// ============================================================================
// CRUD Operations
// ============================================================================

/**
 * Create a new Company AI Context entry
 *
 * @param payload - Entry data to create
 * @returns Created entry record
 */
export async function createCompanyAiContextEntry(
  payload: CreateCompanyAiContextPayload
): Promise<CompanyAiContextEntry> {
  try {
    const base = getBase();

    const fields: Record<string, unknown> = {
      Company: [payload.companyId], // Linked record field expects array
      Type: payload.type,
      Content: payload.content,
      Source: payload.source,
    };

    if (payload.tags && payload.tags.length > 0) {
      fields['Tags'] = payload.tags;
    }

    if (payload.relatedEntityId) {
      fields['RelatedEntityId'] = payload.relatedEntityId;
    }

    if (payload.createdBy) {
      fields['CreatedBy'] = payload.createdBy;
    }

    console.log('[CompanyAiContext] Creating entry:', {
      companyId: payload.companyId,
      type: payload.type,
      source: payload.source,
      contentLength: payload.content.length,
    });

    const records = await base(COMPANY_AI_CONTEXT_TABLE).create([
      { fields: fields as any },
    ]);

    const createdRecord = records[0];
    const entry = mapRecordToEntry(createdRecord);

    console.log('[CompanyAiContext] ✅ Entry created:', entry.id);

    return entry;
  } catch (error) {
    console.error('[CompanyAiContext] ❌ Failed to create entry:', error);
    throw error;
  }
}

/**
 * Get Company AI Context entries for a specific company
 *
 * @param companyId - Airtable record ID of the company
 * @param options - Filter and limit options
 * @returns Array of context entries, sorted by createdAt DESC
 */
export async function getCompanyAiContextForCompany(
  companyId: string,
  options: GetCompanyAiContextOptions = {}
): Promise<CompanyAiContextEntry[]> {
  try {
    const base = getBase();
    const { limit = 50, types, tags, sinceDate } = options;

    // Build filter formula
    const filterParts: string[] = [];

    // Filter by company (linked record)
    filterParts.push(`FIND("${companyId}", ARRAYJOIN({Company}))`);

    // Filter by types if specified
    if (types && types.length > 0) {
      const typeConditions = types
        .map((t) => `{Type} = "${t}"`)
        .join(', ');
      filterParts.push(`OR(${typeConditions})`);
    }

    // Filter by date if specified
    if (sinceDate) {
      filterParts.push(`IS_AFTER({CreatedAt}, "${sinceDate}")`);
    }

    // Note: Tag filtering is complex with multi-select, simplify for now
    // Full tag filtering would require FIND() for each tag

    const filterFormula =
      filterParts.length > 1
        ? `AND(${filterParts.join(', ')})`
        : filterParts[0];

    console.log('[CompanyAiContext] Fetching entries for company:', {
      companyId,
      limit,
      types,
      filterFormula,
    });

    const records = await base(COMPANY_AI_CONTEXT_TABLE)
      .select({
        filterByFormula: filterFormula,
        maxRecords: limit,
        sort: [{ field: 'CreatedAt', direction: 'desc' }],
      })
      .all();

    const entries = records.map(mapRecordToEntry);

    // Post-filter by tags if specified (Airtable formula for multi-select is complex)
    let filteredEntries = entries;
    if (tags && tags.length > 0) {
      filteredEntries = entries.filter((entry) =>
        tags.some((tag) => entry.tags.includes(tag))
      );
    }

    console.log('[CompanyAiContext] ✅ Found entries:', filteredEntries.length);

    return filteredEntries;
  } catch (error) {
    console.error(
      '[CompanyAiContext] ❌ Failed to fetch entries for company:',
      companyId,
      error
    );
    return [];
  }
}

/**
 * Get a single Company AI Context entry by ID
 *
 * @param entryId - Airtable record ID
 * @returns Entry record or null if not found
 */
export async function getCompanyAiContextById(
  entryId: string
): Promise<CompanyAiContextEntry | null> {
  try {
    const base = getBase();
    const record = await base(COMPANY_AI_CONTEXT_TABLE).find(entryId);

    if (!record) {
      return null;
    }

    return mapRecordToEntry(record);
  } catch (error) {
    console.error(
      '[CompanyAiContext] ❌ Failed to fetch entry:',
      entryId,
      error
    );
    return null;
  }
}

/**
 * Delete a Company AI Context entry
 *
 * @param entryId - Airtable record ID to delete
 * @returns true if deleted, false on error
 */
export async function deleteCompanyAiContextEntry(
  entryId: string
): Promise<boolean> {
  try {
    const base = getBase();
    await base(COMPANY_AI_CONTEXT_TABLE).destroy(entryId);

    console.log('[CompanyAiContext] ✅ Entry deleted:', entryId);
    return true;
  } catch (error) {
    console.error(
      '[CompanyAiContext] ❌ Failed to delete entry:',
      entryId,
      error
    );
    return false;
  }
}
