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

/** Field name aliases for the Creative Review Hub folder on Projects. */
const CRH_FOLDER_FIELD_ALIASES = [
  'Creative Review Hub Folder ID',
  'CRH Folder ID',
  'Job Folder ID',
] as const;

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

  // Filter to records where any known alias of the CRH folder field is non-empty.
  const orClauses = CRH_FOLDER_FIELD_ALIASES.map(
    (name) => `{${name}} != ""`
  ).join(',');
  const filterFormula = `OR(${orClauses})`;

  try {
    const records = await base(PROJECTS_TABLE)
      .select({ filterByFormula: filterFormula })
      .all();

    for (const record of records) {
      const fields = record.fields as Record<string, unknown>;
      const folderId = readStringField(fields, CRH_FOLDER_FIELD_ALIASES);
      if (!folderId) continue;
      const projectName = (fields['Name'] as string) || '(unnamed)';
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

  return map;
}
