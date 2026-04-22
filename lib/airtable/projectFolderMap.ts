// lib/airtable/projectFolderMap.ts
// Builds a dynamic mapping of Drive folder ID → Project for any Project record
// in Airtable that has a populated "Creative Review Hub Folder ID" field.
//
// Used by the creative ingestion pipeline so that files dropped into a project's
// Creative Review Hub folder can be matched back to the correct Project record
// without relying on hardcoded folder IDs.

import { getBase } from '../airtable';
import { AIRTABLE_TABLES } from './tables';

const PROJECTS_TABLE = AIRTABLE_TABLES.PROJECTS;

/**
 * Airtable Projects field that stores the Drive folder id for the Creative Review Hub.
 * Must match the field name in the **OS base** `Projects` table exactly (case-sensitive).
 * Override if your base uses a different label (422: Unknown field names otherwise).
 */
const CRH_FOLDER_FIELD =
  (typeof process !== 'undefined' && process.env.PROJECT_CRH_FOLDER_FIELD?.trim()) ||
  'Creative Review Hub Folder ID';

/** Field name aliases for the Client Review Portal token on Projects. */
const REVIEW_TOKEN_FIELD_ALIASES = [
  'Client Review Portal Token',
  'Review Token',
] as const;

export interface ProjectFolderMapping {
  /** Airtable record ID of the Project. */
  projectId: string;
  /** Project name (for logging). */
  projectName: string;
  /** Drive folder ID of the Creative Review Hub folder. */
  folderId: string;
  /** Client Review Portal token, if set. */
  reviewToken?: string;
}

function readStringField(
  fields: Record<string, unknown>,
  aliases: readonly string[]
): string | undefined {
  for (const alias of aliases) {
    const v = fields[alias];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return undefined;
}

/**
 * Query the Projects table for all records that have a populated
 * "Creative Review Hub Folder ID" and return a Map keyed by folder ID.
 *
 * Multiple projects are supported dynamically — there are no hardcoded folder IDs.
 */
export async function getProjectsByCreativeReviewHubFolderId(): Promise<
  Map<string, ProjectFolderMapping>
> {
  const base = getBase();
  const map = new Map<string, ProjectFolderMapping>();
  let skipped = 0;

  // Use NOT(... = BLANK()) instead of != "" so the filter works regardless of
  // whether Creative Review Hub Folder ID is a plain text field, a formula
  // field, a lookup, or any other Airtable field type. != "" only works
  // reliably for text fields.
  const filterFormula = `NOT({${CRH_FOLDER_FIELD}} = BLANK())`;

  try {
    console.log(
      `[projectFolderMap] querying table=${PROJECTS_TABLE} formula=${filterFormula}`
    );
    const records = await base(PROJECTS_TABLE)
      .select({ filterByFormula: filterFormula })
      .all();

    console.log(
      `[projectFolderMap] query returned ${records.length} record(s) from table=${PROJECTS_TABLE}`
    );

    for (const record of records) {
      const fields = record.fields as Record<string, unknown>;
      const rawFolderId = fields[CRH_FOLDER_FIELD];
      const folderId =
        typeof rawFolderId === 'string' && rawFolderId.trim()
          ? rawFolderId.trim()
          : undefined;
      if (!folderId) {
        skipped++;
        continue;
      }
      const projectName =
        readStringField(fields, ['Project', 'Name', 'Project Name', 'Title']) ||
        '(unnamed)';
      const reviewToken = readStringField(fields, REVIEW_TOKEN_FIELD_ALIASES);
      map.set(folderId, {
        projectId: record.id,
        projectName,
        folderId,
        reviewToken,
      });
    }
  } catch (err) {
    console.error(
      '[projectFolderMap] Failed to query Projects for CRH folder IDs:',
      err
    );
  }

  console.log(`[projectFolderMap] loaded projects: ${map.size}`);
  console.log(
    `[projectFolderMap] skipped projects with no CRH folder: ${skipped}`
  );

  return map;
}
