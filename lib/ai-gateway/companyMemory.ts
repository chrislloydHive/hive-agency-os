/**
 * Company Memory Functions
 *
 * Functions for reading and writing to the Company AI Context (Client Brain).
 * This provides persistent memory for AI interactions per company.
 */

import { getBase } from '@/lib/airtable';
import { AIRTABLE_TABLES } from '@/lib/airtable/tables';
import type {
  CompanyMemoryEntry,
  GetCompanyMemoryOptions,
  AddMemoryEntryOptions,
} from './types';

const TABLE = AIRTABLE_TABLES.COMPANY_AI_CONTEXT;

/**
 * Map Airtable record to CompanyMemoryEntry
 *
 * Airtable field mapping:
 * - Name: Auto-generated name for the entry
 * - Company: Linked record to Companies table (array of record IDs)
 * - Type: Single select (GAP IA, GAP Full, Analytics Insight, etc.)
 * - Status: Single select (optional)
 * - Content: Long text containing the AI response or memory content
 * - Source: Single select (AI, User, System)
 * - Tags: Multi-select for categorization
 * - RelatedEntityID: Text field for linking to related records (GAP run ID, etc.)
 * - CreatedAt: Date/time field
 * - CreatedBy: Created by field (auto-populated by Airtable)
 */
function mapRecordToMemoryEntry(record: any): CompanyMemoryEntry {
  const fields = record.fields;

  // Company field is a linked record - extract first company ID if available
  const companyLinks = fields['Company'] as string[] | undefined;
  const companyId = companyLinks?.[0] || '';

  return {
    id: record.id,
    companyId,
    type: fields['Type'] || 'System',
    source: fields['Source'] || 'System',
    content: fields['Content'] || '',
    tags: fields['Tags'] || [],
    relatedEntityId: fields['RelatedEntityID'] || null,
    createdAt: fields['CreatedAt'] || new Date().toISOString(),
    metadata: fields['Metadata'] ? JSON.parse(fields['Metadata']) : undefined,
  };
}

/**
 * Get memory entries for a company
 *
 * Retrieves prior AI context for a company to inject into prompts.
 * Entries are returned in reverse chronological order (newest first).
 *
 * @param companyId - The canonical company ID (UUID)
 * @param options - Filtering and pagination options
 * @returns Array of memory entries
 */
export async function getCompanyMemory(
  companyId: string,
  options: GetCompanyMemoryOptions = {}
): Promise<CompanyMemoryEntry[]> {
  const { limit = 20, types, tags, since } = options;

  try {
    const base = getBase();

    // Build filter formula
    // Note: Company is a linked record field, so we filter by the linked record ID
    const filters: string[] = [`FIND("${companyId}", ARRAYJOIN({Company}))`];

    if (types && types.length > 0) {
      const typeFilters = types.map((t) => `{Type} = "${t}"`);
      filters.push(`OR(${typeFilters.join(', ')})`);
    }

    if (since) {
      filters.push(`IS_AFTER({CreatedAt}, "${since}")`);
    }

    const filterFormula =
      filters.length > 1 ? `AND(${filters.join(', ')})` : filters[0];

    const records = await base(TABLE)
      .select({
        filterByFormula: filterFormula,
        sort: [{ field: 'CreatedAt', direction: 'desc' }],
        maxRecords: limit,
      })
      .all();

    let entries = records.map(mapRecordToMemoryEntry);

    // Filter by tags if specified (post-query since Airtable array filtering is limited)
    if (tags && tags.length > 0) {
      entries = entries.filter((entry) =>
        entry.tags?.some((tag) => tags.includes(tag))
      );
    }

    console.log(
      `[CompanyMemory] Retrieved ${entries.length} entries for company ${companyId}`
    );
    return entries;
  } catch (error) {
    console.error(
      `[CompanyMemory] Failed to get memory for company ${companyId}:`,
      error
    );
    // Return empty array on error to allow graceful degradation
    return [];
  }
}

/**
 * Get memory formatted for prompt injection
 *
 * Formats memory entries into a string suitable for injecting into AI prompts.
 *
 * @param companyId - The canonical company ID
 * @param options - Memory retrieval options
 * @returns Formatted string for prompt injection
 */
export async function getCompanyMemoryForPrompt(
  companyId: string,
  options: GetCompanyMemoryOptions = {}
): Promise<string> {
  const entries = await getCompanyMemory(companyId, options);

  if (entries.length === 0) {
    return `[No prior context available for this company. This appears to be the first interaction.]`;
  }

  const formattedEntries = entries.map((entry) => {
    const dateStr = new Date(entry.createdAt).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    const tagsStr = entry.tags?.length ? ` [${entry.tags.join(', ')}]` : '';
    return `--- ${entry.type} (${dateStr})${tagsStr} ---\n${entry.content}`;
  });

  return `=== PRIOR COMPANY CONTEXT (${entries.length} entries) ===\n\n${formattedEntries.join('\n\n')}`;
}

/**
 * Add a memory entry for a company
 *
 * Creates a new entry in the Company AI Context table.
 *
 * @param options - The memory entry to create
 * @returns The created memory entry ID
 */
export async function addCompanyMemoryEntry(
  options: AddMemoryEntryOptions
): Promise<string> {
  const {
    companyId,
    type,
    source = 'AI',
    content,
    tags = [],
    relatedEntityId,
    metadata,
  } = options;

  try {
    const base = getBase();
    const now = new Date().toISOString();

    // Auto-derive tags based on type if none provided
    const derivedTags = [...tags];
    if (type === 'GAP IA' && !derivedTags.includes('GAP')) {
      derivedTags.push('GAP', 'Snapshot', 'Marketing');
    } else if (type === 'GAP Full' && !derivedTags.includes('GAP')) {
      derivedTags.push('GAP', 'Growth Plan', 'Strategy');
    }

    // Generate a descriptive name for the entry
    const entryName = `${type} - ${new Date(now).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

    const fields: Record<string, unknown> = {
      Name: entryName,
      Company: [companyId], // Linked record field - pass as array of record IDs
      Type: type,
      Source: source,
      Content: content,
      Tags: derivedTags,
      CreatedAt: now,
      Status: 'Active', // Default status
    };

    if (relatedEntityId) {
      fields['RelatedEntityID'] = relatedEntityId;
    }

    if (metadata) {
      fields['Metadata'] = JSON.stringify(metadata);
    }

    const records = await base(TABLE).create([{ fields: fields as any }]);
    const createdId = records[0]?.id;

    if (!createdId) {
      throw new Error('Failed to create memory entry - no ID returned');
    }

    console.log(
      `[CompanyMemory] Created ${type} entry for company ${companyId}: ${createdId}`
    );
    return createdId;
  } catch (error) {
    console.error(
      `[CompanyMemory] Failed to add memory entry for company ${companyId}:`,
      error
    );
    throw error;
  }
}

/**
 * Extract summary from GAP result for memory storage
 *
 * Creates a condensed summary suitable for memory storage from a GAP result.
 *
 * @param gapResult - The GAP IA or Full result
 * @param type - The type of GAP result
 * @returns Formatted summary string
 */
export function extractGapSummaryForMemory(
  gapResult: {
    executiveSummary?: { narrative?: string; maturityStage?: string };
    scorecard?: { overall?: number };
    core?: { overallScore?: number; marketingMaturity?: string };
    summary?: { overallScore?: number; maturityStage?: string };
  },
  type: 'GAP IA' | 'GAP Full'
): string {
  const overall =
    gapResult.scorecard?.overall ||
    gapResult.core?.overallScore ||
    gapResult.summary?.overallScore ||
    0;

  const maturity =
    gapResult.executiveSummary?.maturityStage ||
    gapResult.core?.marketingMaturity ||
    gapResult.summary?.maturityStage ||
    'Unknown';

  const narrative =
    gapResult.executiveSummary?.narrative || 'No narrative available.';

  return `${type} completed. Overall Score: ${overall}/100. Maturity: ${maturity}. Summary: ${narrative.slice(0, 500)}${narrative.length > 500 ? '...' : ''}`;
}
