// lib/airtable/sectionLibrary.ts
// Airtable CRUD operations for Section Library (Reusable Content)
// Supports company-scoped (default) and global (curated) sections

import { getBase as getAirtableBase } from '@/lib/airtable';
import { AIRTABLE_TABLES } from './tables';
import type {
  ReusableSection,
  ReusableSectionInput,
  CreateSectionInput,
  UpdateSectionInput,
  SectionLibraryScope,
  ListSectionsQuery,
  SectionLibraryListResponse,
} from '@/lib/types/sectionLibrary';

// ============================================================================
// Section Library CRUD
// ============================================================================

/**
 * Get sections for a company (includes company-scoped + global sections)
 */
export async function getSectionsForCompany(
  companyId: string,
  query?: ListSectionsQuery
): Promise<SectionLibraryListResponse> {
  try {
    const base = getAirtableBase();

    // Build filter formula
    const filters: string[] = [];

    // Scope filter: company sections + global sections
    filters.push(`OR({companyId} = '${companyId}', {scope} = 'global')`);

    // Additional filters from query
    if (query?.scope === 'company') {
      filters.length = 0; // Clear and rebuild
      filters.push(`{companyId} = '${companyId}'`);
    } else if (query?.scope === 'global') {
      filters.length = 0;
      filters.push(`{scope} = 'global'`);
    }

    if (query?.tag) {
      filters.push(`FIND('${query.tag}', {tagsString}) > 0`);
    }

    if (query?.q) {
      // Search in title and content (case-insensitive)
      const searchTerm = query.q.toLowerCase();
      filters.push(`OR(
        FIND('${searchTerm}', LOWER({title})) > 0,
        FIND('${searchTerm}', LOWER({content})) > 0
      )`);
    }

    const filterFormula = filters.length > 1
      ? `AND(${filters.join(', ')})`
      : filters[0] || '';

    const records = await base(AIRTABLE_TABLES.SECTION_LIBRARY)
      .select({
        filterByFormula: filterFormula,
        sort: [{ field: 'updatedAt', direction: 'desc' }],
      })
      .all();

    const sections = records.map(mapRecordToSection);

    // Separate into company and global
    const companySections = sections.filter((s: ReusableSection) => s.scope === 'company');
    const globalSections = sections.filter((s: ReusableSection) => s.scope === 'global');

    return {
      sections,
      companySections,
      globalSections,
      total: sections.length,
    };
  } catch (error) {
    console.error('[sectionLibrary] Failed to get sections:', error);
    return {
      sections: [],
      companySections: [],
      globalSections: [],
      total: 0,
    };
  }
}

/**
 * Get a single section by ID
 */
export async function getSectionById(id: string): Promise<ReusableSection | null> {
  try {
    const base = getAirtableBase();
    const record = await base(AIRTABLE_TABLES.SECTION_LIBRARY).find(id);
    return mapRecordToSection(record);
  } catch (error) {
    console.error('[sectionLibrary] Failed to get section:', error);
    return null;
  }
}

/**
 * Create a new company-scoped section (default)
 * Global sections can ONLY be created via the promote endpoint
 */
export async function createSection(
  companyId: string,
  input: CreateSectionInput
): Promise<ReusableSection> {
  const base = getAirtableBase();
  const now = new Date().toISOString();

  const record = await base(AIRTABLE_TABLES.SECTION_LIBRARY).create({
    scope: 'company', // Always company-scoped for normal creation
    companyId, // Required for company scope
    title: input.title,
    content: input.content,
    tagsString: input.tags.join(','), // Store as comma-separated
    source: input.source,
    sourceId: input.sourceId || null,
    sourceSectionKey: input.sourceSectionKey || null,
    outcome: null, // Will be populated from RFP outcome later
    createdAt: now,
    updatedAt: now,
  });

  return mapRecordToSection(record);
}

/**
 * Update a section (only allowed for company-scoped sections owned by this company)
 */
export async function updateSection(
  id: string,
  companyId: string,
  input: UpdateSectionInput
): Promise<ReusableSection | null> {
  try {
    const base = getAirtableBase();

    // First verify ownership
    const existing = await getSectionById(id);
    if (!existing) return null;

    // Cannot edit global sections through normal update
    if (existing.scope === 'global') {
      throw new Error('Cannot edit global sections');
    }

    // Must own the section
    if (existing.companyId !== companyId) {
      throw new Error('Cannot edit sections belonging to another company');
    }

    const now = new Date().toISOString();
    const fields: Record<string, unknown> = { updatedAt: now };

    if (input.title !== undefined) fields.title = input.title;
    if (input.content !== undefined) fields.content = input.content;
    if (input.tags !== undefined) fields.tagsString = input.tags.join(',');

    const [updated] = await base(AIRTABLE_TABLES.SECTION_LIBRARY).update([{ id, fields }]);
    return mapRecordToSection(updated);
  } catch (error) {
    console.error('[sectionLibrary] Failed to update section:', error);
    throw error;
  }
}

/**
 * Delete a section (only allowed for company-scoped sections owned by this company)
 */
export async function deleteSection(id: string, companyId: string): Promise<boolean> {
  try {
    const base = getAirtableBase();

    // First verify ownership
    const existing = await getSectionById(id);
    if (!existing) return false;

    // Cannot delete global sections through normal delete
    if (existing.scope === 'global') {
      throw new Error('Cannot delete global sections');
    }

    // Must own the section
    if (existing.companyId !== companyId) {
      throw new Error('Cannot delete sections belonging to another company');
    }

    await base(AIRTABLE_TABLES.SECTION_LIBRARY).destroy([id]);
    return true;
  } catch (error) {
    console.error('[sectionLibrary] Failed to delete section:', error);
    return false;
  }
}

/**
 * Promote a company section to global
 * Creates a NEW global section (does not mutate original)
 */
export async function promoteSectionToGlobal(
  id: string,
  companyId: string
): Promise<{ originalSection: ReusableSection; globalSection: ReusableSection }> {
  const base = getAirtableBase();

  // Get original section
  const original = await getSectionById(id);
  if (!original) {
    throw new Error('Section not found');
  }

  // Must be company-scoped
  if (original.scope === 'global') {
    throw new Error('Section is already global');
  }

  // Must own the section
  if (original.companyId !== companyId) {
    throw new Error('Cannot promote sections belonging to another company');
  }

  const now = new Date().toISOString();

  // Create new global section (copy content, clear company-specific data)
  const record = await base(AIRTABLE_TABLES.SECTION_LIBRARY).create({
    scope: 'global',
    companyId: null, // Global sections have no company
    title: original.title,
    content: original.content,
    tagsString: original.tags.join(','),
    source: original.source,
    sourceId: null, // Clear source reference (original RFP/Proposal is company-specific)
    sourceSectionKey: original.sourceSectionKey,
    outcome: original.outcome, // Keep outcome if present
    createdAt: now,
    updatedAt: now,
  });

  const globalSection = mapRecordToSection(record);

  return { originalSection: original, globalSection };
}

/**
 * Update outcome on a section (used when RFP outcome changes)
 */
export async function updateSectionOutcome(
  id: string,
  outcome: 'won' | 'lost' | null
): Promise<ReusableSection | null> {
  try {
    const base = getAirtableBase();
    const now = new Date().toISOString();

    const [updated] = await base(AIRTABLE_TABLES.SECTION_LIBRARY).update([
      { id, fields: { outcome, updatedAt: now } },
    ]);

    return mapRecordToSection(updated);
  } catch (error) {
    console.error('[sectionLibrary] Failed to update section outcome:', error);
    return null;
  }
}

/**
 * Get sections by source (for linking back to RFP/Proposal outcomes)
 */
export async function getSectionsBySource(
  source: 'rfp' | 'proposal',
  sourceId: string
): Promise<ReusableSection[]> {
  try {
    const base = getAirtableBase();
    const records = await base(AIRTABLE_TABLES.SECTION_LIBRARY)
      .select({
        filterByFormula: `AND({source} = '${source}', {sourceId} = '${sourceId}')`,
      })
      .all();

    return records.map(mapRecordToSection);
  } catch (error) {
    console.error('[sectionLibrary] Failed to get sections by source:', error);
    return [];
  }
}

/**
 * Get all global sections (for admin/curation purposes)
 */
export async function getGlobalSections(): Promise<ReusableSection[]> {
  try {
    const base = getAirtableBase();
    const records = await base(AIRTABLE_TABLES.SECTION_LIBRARY)
      .select({
        filterByFormula: `{scope} = 'global'`,
        sort: [{ field: 'updatedAt', direction: 'desc' }],
      })
      .all();

    return records.map(mapRecordToSection);
  } catch (error) {
    console.error('[sectionLibrary] Failed to get global sections:', error);
    return [];
  }
}

/**
 * Get sections with won outcome (high-performing content)
 */
export async function getWonSections(companyId: string): Promise<ReusableSection[]> {
  try {
    const base = getAirtableBase();
    const records = await base(AIRTABLE_TABLES.SECTION_LIBRARY)
      .select({
        filterByFormula: `AND(
          OR({companyId} = '${companyId}', {scope} = 'global'),
          {outcome} = 'won'
        )`,
        sort: [{ field: 'updatedAt', direction: 'desc' }],
      })
      .all();

    return records.map(mapRecordToSection);
  } catch (error) {
    console.error('[sectionLibrary] Failed to get won sections:', error);
    return [];
  }
}

// ============================================================================
// Helpers
// ============================================================================

function mapRecordToSection(record: { id: string; get: (field: string) => unknown }): ReusableSection {
  const tagsString = record.get('tagsString') as string | null;
  const tags = tagsString ? tagsString.split(',').filter(Boolean) : [];

  return {
    id: record.id,
    scope: (record.get('scope') as SectionLibraryScope) || 'company',
    companyId: record.get('companyId') as string | null,
    title: (record.get('title') as string) || '',
    content: (record.get('content') as string) || '',
    tags,
    source: (record.get('source') as 'rfp' | 'proposal') || 'rfp',
    sourceId: record.get('sourceId') as string | null,
    sourceSectionKey: record.get('sourceSectionKey') as string | null,
    outcome: record.get('outcome') as 'won' | 'lost' | null,
    createdAt: record.get('createdAt') as string | null,
    updatedAt: record.get('updatedAt') as string | null,
  };
}
