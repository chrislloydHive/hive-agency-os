// lib/airtable/comments.ts
// CRH comments: canonical Comments table (workflow + targeting) and Creative Review Comments (per-asset display).
//
// Comments table (canonical) columns: Body, Author, Status, Severity, Category, Assignee,
//   Target Type, Target Concept, Target Variant Group, Target Asset,
//   Resolution Note, Resolved In Version, Created, Comment ID.
// Target Concept and Target Variant Group are linked-record fields; we write [recordId] via find-or-create.
// Drive File ID and Filename do NOT exist in Comments; we do not write them there.
//
// Creative Review Comments table: Comment, Project, Tactic, Drive File ID, Filename, Author Name, Author Email, Created At.
// Used for display in lightbox (filter by project + fileId).

import { getBase } from '@/lib/airtable';
import { AIRTABLE_TABLES } from '@/lib/airtable/tables';

// Comments table field names (exact)
const COMMENTS_FIELDS = {
  BODY: 'Body',
  AUTHOR: 'Author',
  STATUS: 'Status',
  SEVERITY: 'Severity',
  CATEGORY: 'Category',
  TARGET_TYPE: 'Target Type',
  TARGET_CONCEPT: 'Target Concept',
  TARGET_VARIANT_GROUP: 'Target Variant Group',
  TARGET_ASSET: 'Target Asset',
  CREATED: 'Created',
} as const;

// Single-select defaults (must match existing options in Airtable)
const DEFAULT_STATUS = 'Open';
const DEFAULT_SEVERITY = 'Normal';
const DEFAULT_CATEGORY = 'General';
const TARGET_TYPE_ASSET = 'Asset';

// Name field for find-or-create (Concepts / Variant Groups tables)
const NAME_FIELD = 'Name';

export interface CreateCommentFields {
  projectId: string;
  body: string;
  authorName: string;
  authorEmail: string;
  tactic: string;
  variantGroup?: string;
  concept?: string;
  driveFileId: string;
  filename: string;
}

/**
 * Find or create a record in the Concepts table by name.
 * Returns record ID for linking in Comments.Target Concept.
 */
async function findOrCreateConcept(name: string): Promise<string | null> {
  const osBase = getBase();
  const tableName = AIRTABLE_TABLES.CONCEPTS;
  const escaped = String(name).replace(/\\/g, '\\\\').replace(/"/g, '\\"').trim();
  if (!escaped) return null;

  try {
    const existing = await osBase(tableName)
      .select({
        filterByFormula: `{${NAME_FIELD}} = "${escaped}"`,
        maxRecords: 1,
      })
      .firstPage();

    if (existing.length > 0) return existing[0].id;

    const created = (await osBase(tableName).create({ [NAME_FIELD]: name.trim().slice(0, 200) } as any)) as unknown as { id: string };
    return created.id;
  } catch {
    return null;
  }
}

/**
 * Find or create a record in the Variant Groups table by name.
 * Returns record ID for linking in Comments.Target Variant Group.
 */
async function findOrCreateVariantGroup(name: string): Promise<string | null> {
  const osBase = getBase();
  const tableName = AIRTABLE_TABLES.VARIANT_GROUPS;
  const escaped = String(name).replace(/\\/g, '\\\\').replace(/"/g, '\\"').trim();
  if (!escaped) return null;

  try {
    const existing = await osBase(tableName)
      .select({
        filterByFormula: `{${NAME_FIELD}} = "${escaped}"`,
        maxRecords: 1,
      })
      .firstPage();

    if (existing.length > 0) return existing[0].id;

    const created = (await osBase(tableName).create({ [NAME_FIELD]: name.trim().slice(0, 200) } as any)) as unknown as { id: string };
    return created.id;
  } catch {
    return null;
  }
}

/**
 * Create a record in the canonical Comments table.
 * Uses exact field names; Target Concept and Target Variant Group are linked (find-or-create IDs).
 * Does NOT write Drive File ID or Filename (they do not exist in Comments).
 */
export async function createComment(fields: CreateCommentFields): Promise<{ id: string; createdAt: string }> {
  const osBase = getBase();
  const tableName = AIRTABLE_TABLES.COMMENTS;
  const createdAt = new Date().toISOString();

  const author = `${fields.authorName.trim().slice(0, 100)} <${fields.authorEmail.trim().slice(0, 200)}>`;

  const recordFields: Record<string, unknown> = {
    [COMMENTS_FIELDS.BODY]: fields.body.slice(0, 5000),
    [COMMENTS_FIELDS.AUTHOR]: author,
    [COMMENTS_FIELDS.STATUS]: DEFAULT_STATUS,
    [COMMENTS_FIELDS.SEVERITY]: DEFAULT_SEVERITY,
    [COMMENTS_FIELDS.CATEGORY]: DEFAULT_CATEGORY,
    [COMMENTS_FIELDS.TARGET_TYPE]: TARGET_TYPE_ASSET,
    [COMMENTS_FIELDS.CREATED]: createdAt,
  };

  const conceptId = fields.concept?.trim() ? await findOrCreateConcept(fields.concept.trim()) : null;
  if (conceptId) recordFields[COMMENTS_FIELDS.TARGET_CONCEPT] = [conceptId];

  const variantGroupId = fields.variantGroup?.trim() ? await findOrCreateVariantGroup(fields.variantGroup.trim()) : null;
  if (variantGroupId) recordFields[COMMENTS_FIELDS.TARGET_VARIANT_GROUP] = [variantGroupId];

  const record = (await osBase(tableName).create(recordFields as any)) as unknown as { id: string };
  return { id: record.id, createdAt };
}

/**
 * Create a record in Creative Review Comments (lightweight table with Drive File ID for per-asset display).
 * Used for display in lightbox and as fallback when Comments create fails.
 */
export async function createCreativeReviewComment(fields: CreateCommentFields): Promise<{ id: string; createdAt: string }> {
  const osBase = getBase();
  const tableName = AIRTABLE_TABLES.CREATIVE_REVIEW_COMMENTS;
  const createdAt = new Date().toISOString();

  const recordFields: Record<string, unknown> = {
    Project: [fields.projectId],
    Tactic: fields.tactic,
    'Drive File ID': fields.driveFileId,
    Filename: fields.filename.slice(0, 500),
    Comment: fields.body.slice(0, 5000),
    'Author Name': fields.authorName.trim().slice(0, 100),
    'Author Email': fields.authorEmail.trim().slice(0, 200),
    'Created At': createdAt,
  };

  const record = (await osBase(tableName).create(recordFields as any)) as unknown as { id: string };
  return { id: record.id, createdAt };
}
