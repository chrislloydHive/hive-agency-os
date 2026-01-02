// lib/airtable/templates.ts
// Airtable helpers for Templates and TemplatePacks tables

import { getBase } from '@/lib/airtable';
import { AIRTABLE_TABLES } from '@/lib/airtable/tables';
import type {
  TemplateRecord,
  TemplatePackRecord,
  DocumentType,
  TemplateScope,
  DestinationFolderKey,
} from '@/lib/types/template';

// ============================================================================
// Field Mappings - Templates
// ============================================================================

const TEMPLATE_FIELDS = {
  NAME: 'Name',
  SCOPE: 'Scope',
  DOCUMENT_TYPE: 'Document Type',
  DRIVE_TEMPLATE_FILE_ID: 'Drive Template File ID',
  DESTINATION_FOLDER_KEY: 'Destination Folder Key',
  NAMING_PATTERN: 'Naming Pattern',
  ALLOW_AI_DRAFTING: 'Allow AI Drafting',
  CREATED_AT: 'Created At',
} as const;

// ============================================================================
// Field Mappings - Template Packs
// ============================================================================

const TEMPLATE_PACK_FIELDS = {
  NAME: 'Name',
  TEMPLATES: 'Templates', // Link field to Templates table
  IS_DEFAULT: 'Is Default',
  CREATED_AT: 'Created At',
} as const;

// ============================================================================
// Mappers
// ============================================================================

/**
 * Map Airtable record to TemplateRecord
 */
function mapFieldsToTemplate(record: any): TemplateRecord {
  const fields = record.fields;

  return {
    id: record.id,
    name: (fields[TEMPLATE_FIELDS.NAME] as string) || '',
    scope: (fields[TEMPLATE_FIELDS.SCOPE] as TemplateScope) || 'job',
    documentType: (fields[TEMPLATE_FIELDS.DOCUMENT_TYPE] as DocumentType) || 'SOW',
    driveTemplateFileId: (fields[TEMPLATE_FIELDS.DRIVE_TEMPLATE_FILE_ID] as string) || '',
    destinationFolderKey: (fields[TEMPLATE_FIELDS.DESTINATION_FOLDER_KEY] as DestinationFolderKey) || 'estimate',
    namingPattern: (fields[TEMPLATE_FIELDS.NAMING_PATTERN] as string) || '',
    allowAIDrafting: (fields[TEMPLATE_FIELDS.ALLOW_AI_DRAFTING] as boolean) || false,
    createdAt: fields[TEMPLATE_FIELDS.CREATED_AT] as string | undefined,
  };
}

/**
 * Map Airtable record to TemplatePackRecord (without populated templates)
 */
function mapFieldsToTemplatePack(record: any): TemplatePackRecord {
  const fields = record.fields;

  // Extract template IDs from link field
  const templateLinks = fields[TEMPLATE_PACK_FIELDS.TEMPLATES] as string[] | undefined;

  return {
    id: record.id,
    name: (fields[TEMPLATE_PACK_FIELDS.NAME] as string) || '',
    templateIds: templateLinks || [],
    isDefault: (fields[TEMPLATE_PACK_FIELDS.IS_DEFAULT] as boolean) || false,
    createdAt: fields[TEMPLATE_PACK_FIELDS.CREATED_AT] as string | undefined,
  };
}

// ============================================================================
// Templates CRUD
// ============================================================================

/**
 * Get a template by ID
 */
export async function getTemplateById(templateId: string): Promise<TemplateRecord | null> {
  try {
    const base = getBase();
    const record = await base(AIRTABLE_TABLES.TEMPLATES).find(templateId);
    if (!record) return null;
    return mapFieldsToTemplate(record);
  } catch (error: any) {
    if (error?.statusCode === 404) return null;
    console.error(`[Templates] Failed to get template ${templateId}:`, error);
    return null;
  }
}

/**
 * Get multiple templates by IDs
 */
export async function getTemplatesByIds(templateIds: string[]): Promise<TemplateRecord[]> {
  if (templateIds.length === 0) return [];

  try {
    const base = getBase();
    const filterFormula = `OR(${templateIds.map((id) => `RECORD_ID() = "${id}"`).join(',')})`;

    const records = await base(AIRTABLE_TABLES.TEMPLATES)
      .select({
        filterByFormula: filterFormula,
      })
      .all();

    return records.map(mapFieldsToTemplate);
  } catch (error) {
    console.error('[Templates] Failed to get templates by IDs:', error);
    return [];
  }
}

/**
 * List all templates, optionally filtered by scope or document type
 */
export async function listTemplates(options?: {
  scope?: TemplateScope;
  documentType?: DocumentType;
}): Promise<TemplateRecord[]> {
  try {
    const base = getBase();

    const filters: string[] = [];
    if (options?.scope) {
      filters.push(`{${TEMPLATE_FIELDS.SCOPE}} = "${options.scope}"`);
    }
    if (options?.documentType) {
      filters.push(`{${TEMPLATE_FIELDS.DOCUMENT_TYPE}} = "${options.documentType}"`);
    }

    const selectOptions: { filterByFormula?: string; sort: { field: string; direction: 'asc' | 'desc' }[] } = {
      sort: [{ field: TEMPLATE_FIELDS.NAME, direction: 'asc' }],
    };

    if (filters.length > 0) {
      selectOptions.filterByFormula = `AND(${filters.join(',')})`;
    }

    const records = await base(AIRTABLE_TABLES.TEMPLATES)
      .select(selectOptions)
      .all();

    return records.map(mapFieldsToTemplate);
  } catch (error) {
    console.error('[Templates] Failed to list templates:', error);
    return [];
  }
}

/**
 * Create a new template
 */
export async function createTemplate(data: {
  name: string;
  scope: TemplateScope;
  documentType: DocumentType;
  driveTemplateFileId: string;
  destinationFolderKey: DestinationFolderKey;
  namingPattern: string;
  allowAIDrafting?: boolean;
}): Promise<TemplateRecord | null> {
  try {
    const base = getBase();

    const fields: Record<string, unknown> = {
      [TEMPLATE_FIELDS.NAME]: data.name,
      [TEMPLATE_FIELDS.SCOPE]: data.scope,
      [TEMPLATE_FIELDS.DOCUMENT_TYPE]: data.documentType,
      [TEMPLATE_FIELDS.DRIVE_TEMPLATE_FILE_ID]: data.driveTemplateFileId,
      [TEMPLATE_FIELDS.DESTINATION_FOLDER_KEY]: data.destinationFolderKey,
      [TEMPLATE_FIELDS.NAMING_PATTERN]: data.namingPattern,
      [TEMPLATE_FIELDS.ALLOW_AI_DRAFTING]: data.allowAIDrafting ?? false,
    };

    console.log(`[Templates] Creating template: ${data.name}`);

    const createdRecords = await base(AIRTABLE_TABLES.TEMPLATES).create([{ fields: fields as any }]);
    const createdRecord = createdRecords[0];

    console.log(`[Templates] Created template: ${data.name} (${createdRecord.id})`);
    return mapFieldsToTemplate(createdRecord);
  } catch (error) {
    console.error('[Templates] Failed to create template:', error);
    return null;
  }
}

// ============================================================================
// Template Packs CRUD
// ============================================================================

/**
 * Get a template pack by ID
 */
export async function getTemplatePackById(packId: string): Promise<TemplatePackRecord | null> {
  try {
    const base = getBase();
    const record = await base(AIRTABLE_TABLES.TEMPLATE_PACKS).find(packId);
    if (!record) return null;
    return mapFieldsToTemplatePack(record);
  } catch (error: any) {
    if (error?.statusCode === 404) return null;
    console.error(`[TemplatePacks] Failed to get template pack ${packId}:`, error);
    return null;
  }
}

/**
 * Get a template pack with populated templates
 */
export async function getTemplatePackWithTemplates(packId: string): Promise<TemplatePackRecord | null> {
  const pack = await getTemplatePackById(packId);
  if (!pack) return null;

  if (pack.templateIds.length > 0) {
    pack.templates = await getTemplatesByIds(pack.templateIds);
  }

  return pack;
}

/**
 * Get the default template pack
 */
export async function getDefaultTemplatePack(): Promise<TemplatePackRecord | null> {
  try {
    const base = getBase();
    const records = await base(AIRTABLE_TABLES.TEMPLATE_PACKS)
      .select({
        filterByFormula: `{${TEMPLATE_PACK_FIELDS.IS_DEFAULT}} = TRUE()`,
        maxRecords: 1,
      })
      .firstPage();

    if (records.length === 0) return null;
    return mapFieldsToTemplatePack(records[0]);
  } catch (error) {
    console.error('[TemplatePacks] Failed to get default template pack:', error);
    return null;
  }
}

/**
 * Get the default template pack with populated templates
 */
export async function getDefaultTemplatePackWithTemplates(): Promise<TemplatePackRecord | null> {
  const pack = await getDefaultTemplatePack();
  if (!pack) return null;

  if (pack.templateIds.length > 0) {
    pack.templates = await getTemplatesByIds(pack.templateIds);
  }

  return pack;
}

/**
 * List all template packs
 */
export async function listTemplatePacks(): Promise<TemplatePackRecord[]> {
  try {
    const base = getBase();
    const records = await base(AIRTABLE_TABLES.TEMPLATE_PACKS)
      .select({
        sort: [{ field: TEMPLATE_PACK_FIELDS.NAME, direction: 'asc' }],
      })
      .all();

    return records.map(mapFieldsToTemplatePack);
  } catch (error) {
    console.error('[TemplatePacks] Failed to list template packs:', error);
    return [];
  }
}

/**
 * Create a new template pack
 */
export async function createTemplatePack(data: {
  name: string;
  templateIds: string[];
  isDefault?: boolean;
}): Promise<TemplatePackRecord | null> {
  try {
    const base = getBase();

    const fields: Record<string, unknown> = {
      [TEMPLATE_PACK_FIELDS.NAME]: data.name,
      [TEMPLATE_PACK_FIELDS.TEMPLATES]: data.templateIds,
      [TEMPLATE_PACK_FIELDS.IS_DEFAULT]: data.isDefault ?? false,
    };

    console.log(`[TemplatePacks] Creating template pack: ${data.name}`);

    const createdRecords = await base(AIRTABLE_TABLES.TEMPLATE_PACKS).create([{ fields: fields as any }]);
    const createdRecord = createdRecords[0];

    console.log(`[TemplatePacks] Created template pack: ${data.name} (${createdRecord.id})`);
    return mapFieldsToTemplatePack(createdRecord);
  } catch (error) {
    console.error('[TemplatePacks] Failed to create template pack:', error);
    return null;
  }
}
