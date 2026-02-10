// app/api/comments/asset/route.ts
// Asset-level comments API for the Client Review Portal.
// Creates and reads comments from the canonical Comments table with Target Type = "Asset".

import { NextRequest, NextResponse } from 'next/server';
import { getBase, getCommentsBase, checkAirtableBaseHealth } from '@/lib/airtable';
import { AIRTABLE_TABLES } from '@/lib/airtable/tables';
import { resolveReviewProject } from '@/lib/review/resolveProject';
import { createRecord, AirtableNotAuthorizedError } from '@/lib/airtable/client';
import { getCrasRecordIdByTokenAndFileId } from '@/lib/airtable/reviewAssetStatus';

export const dynamic = 'force-dynamic';

// ============================================================================
// Field Name Mapping (resilient to schema changes)
// ============================================================================

interface CommentsFieldMap {
  targetCras: string | null;
  targetAsset: string | null;
  authorEmail: string | null;
  creativeReviewGroups: string | null;
  targetType: string | null;
  body: string | null;
  status: string | null;
}

const COMMENTS_FIELD_ALIASES = {
  targetCras: ['Target CRAS', 'Target CRAS (link)', 'CRAS', 'Target CRAS Record'],
  targetAsset: ['Target Asset', 'Asset', 'Target Asset (link)'],
  authorEmail: ['Author Email', 'Author', 'Author email', 'Created By Email'],
  creativeReviewGroups: ['Creative Review Groups', 'Review Group', 'Groups'],
  targetType: ['Target Type', 'Target'],
  body: ['Body', 'Comment', 'Text', 'Message'],
  status: ['Status', 'Comment Status', 'State'],
} as const;

interface TableFieldMeta {
  name: string;
  type: string;
}

const schemaCache = new Map<
  string,
  { fields: Map<string, TableFieldMeta>; allFieldNames: Set<string>; fetchedAt: number }
>();
const SCHEMA_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Fetch table schema (field names) via Airtable Meta API or fallback to sample record.
 */
async function resolveExistingFields(
  baseId: string,
  tableName: string
): Promise<Set<string>> {
  const cacheKey = `${baseId}::${tableName}`;
  const cached = schemaCache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < SCHEMA_CACHE_TTL_MS) {
    return cached.allFieldNames;
  }

  const token = process.env.AIRTABLE_API_KEY || process.env.AIRTABLE_ACCESS_TOKEN;
  if (!token) {
    throw new Error('AIRTABLE_API_KEY / AIRTABLE_ACCESS_TOKEN required for schema fetch');
  }

  // Try Meta API first
  try {
    const url = `https://api.airtable.com/v0/meta/bases/${baseId}/tables`;
    const tokenPrefix = token ? token.substring(0, 10) + '...' : 'missing';
    
    console.log('[comments/asset] BEFORE airtable.meta operation:', {
      operation: 'airtable.meta',
      baseId,
      tableName,
      url: url.replace(token, '***'),
      tokenPrefix,
    });
    
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.ok) {
      console.log('[comments/asset] AFTER airtable.meta operation: SUCCESS', {
        operation: 'airtable.meta',
        baseId,
        tableName,
        status: res.status,
      });
      const json = (await res.json()) as {
        tables?: Array<{
          name: string;
          fields?: Array<{ name: string; type: string }>;
        }>;
      };
      const table = json.tables?.find((t) => t.name === tableName);
      const fields = new Map<string, TableFieldMeta>();
      const allFieldNames = new Set<string>();

      for (const f of table?.fields ?? []) {
        const meta: TableFieldMeta = {
          name: f.name,
          type: f.type,
        };
        fields.set(f.name, meta);
        allFieldNames.add(f.name);
      }

      schemaCache.set(cacheKey, { fields, allFieldNames, fetchedAt: Date.now() });
      return allFieldNames;
    } else {
      // Not OK response
      const errorText = await res.text();
      const is403 = res.status === 403;
      console.error('[comments/asset] 403 at operation airtable.meta on table ' + tableName + ' in base ' + baseId, {
        operation: 'airtable.meta',
        baseId,
        tableName,
        status: res.status,
        url: url.replace(token, '***'),
        tokenPrefix,
        errorText: errorText.slice(0, 200),
      });
      if (is403) {
        throw new Error(`403 NOT_AUTHORIZED at operation airtable.meta on table ${tableName} in base ${baseId}`);
      }
    }
  } catch (err) {
    const is403 = err instanceof Error && (err.message.includes('403') || err.message.includes('NOT_AUTHORIZED'));
    if (is403) {
      throw err; // Re-throw 403 errors
    }
    console.warn('[comments/asset] Meta API fetch failed, trying fallback:', err);
  }

  // Fallback: fetch a sample record to detect fields
  try {
    const commentsBase = getCommentsBase();
    const commentsBaseIdActual = process.env.AIRTABLE_COMMENTS_BASE_ID || 'appQLwoVH8JyGSTIo';
    const tokenPrefix = token ? token.substring(0, 10) + '...' : 'missing';
    
    console.log('[comments/asset] BEFORE airtable.select operation:', {
      operation: 'airtable.select',
      baseId: commentsBaseIdActual,
      tableName,
      recordId: 'none',
      tokenPrefix,
    });
    
    const records = await commentsBase(tableName)
      .select({ maxRecords: 1 })
      .firstPage();
    
    console.log('[comments/asset] AFTER airtable.select operation: SUCCESS', {
      operation: 'airtable.select',
      baseId: commentsBaseIdActual,
      tableName,
      recordCount: records.length,
    });
    
    const allFieldNames = new Set<string>();
    if (records.length > 0) {
      Object.keys(records[0].fields).forEach((f) => allFieldNames.add(f));
    }
    
    // Also add common fields that might not be in sample record
    allFieldNames.add('Body');
    allFieldNames.add('Status');
    allFieldNames.add('Created');
    
    const fields = new Map<string, TableFieldMeta>();
    Array.from(allFieldNames).forEach((name) => {
      fields.set(name, { name, type: 'unknown' });
    });
    
    schemaCache.set(cacheKey, { fields, allFieldNames, fetchedAt: Date.now() });
    return allFieldNames;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    const is403 = errorMessage.includes('403') || errorMessage.includes('NOT_AUTHORIZED');
    const commentsBaseIdActual = process.env.AIRTABLE_COMMENTS_BASE_ID || 'appQLwoVH8JyGSTIo';
    const tokenPrefix = token ? token.substring(0, 10) + '...' : 'missing';
    
    if (is403) {
      console.error('[comments/asset] 403 at operation airtable.select on table ' + tableName + ' in base ' + commentsBaseIdActual, {
        operation: 'airtable.select',
        baseId: commentsBaseIdActual,
        tableName,
        recordId: 'none',
        tokenPrefix,
        error: errorMessage,
      });
      throw new Error(`403 NOT_AUTHORIZED at operation airtable.select on table ${tableName} in base ${commentsBaseIdActual}`);
    }
    
    console.error('[comments/asset] Fallback schema fetch failed:', err);
    // Return minimal set of expected fields as fail-safe
    return new Set(['Body', 'Status', 'Created', 'Target CRAS', 'Target Type']);
  }
}

/**
 * Resolve field names from aliases, returning the first match that exists in the schema.
 */
function resolveFieldMap(
  existingFields: Set<string>
): CommentsFieldMap {
  function resolveAlias(aliases: readonly string[]): string | null {
    for (const name of aliases) {
      if (existingFields.has(name)) return name;
    }
    return null;
  }

  return {
    targetCras: resolveAlias(COMMENTS_FIELD_ALIASES.targetCras),
    targetAsset: resolveAlias(COMMENTS_FIELD_ALIASES.targetAsset),
    authorEmail: resolveAlias(COMMENTS_FIELD_ALIASES.authorEmail),
    creativeReviewGroups: resolveAlias(COMMENTS_FIELD_ALIASES.creativeReviewGroups),
    targetType: resolveAlias(COMMENTS_FIELD_ALIASES.targetType),
    body: resolveAlias(COMMENTS_FIELD_ALIASES.body),
    status: resolveAlias(COMMENTS_FIELD_ALIASES.status),
  };
}

const VALID_VARIANTS = new Set(['Prospecting', 'Retargeting']);
const VALID_TACTICS = new Set([
  'Display', 'Social', 'Video', 'Audio', 'OOH', 'PMAX', 'Geofence', 'Search',
]);

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 30;
const rateLimitMap = new Map<string, { count: number; windowStart: number }>();

function isRateLimited(token: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(token);
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(token, { count: 1, windowStart: now });
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT_MAX;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

const NO_STORE_HEADERS = { 'Cache-Control': 'no-store, max-age=0' } as const;

interface AssetComment {
  id: string;
  body: string;
  author: string;
  authorEmail?: string;
  createdAt: string;
}

/**
 * Find or create a Creative Review Sets record for the given project, tactic, and variant.
 * Returns the record ID for linking in Comments.Creative Review Groups.
 */
async function findOrCreateCreativeReviewSet(
  projectId: string,
  tactic: string,
  variant: string
): Promise<string | null> {
  const osBase = getBase();
  const tableName = AIRTABLE_TABLES.CREATIVE_REVIEW_SETS;
  
  // Find existing record
  const projectEsc = String(projectId).replace(/"/g, '\\"');
  const tacticEsc = String(tactic).replace(/"/g, '\\"');
  const variantEsc = String(variant).replace(/"/g, '\\"');
  
  const formula = `AND(
    FIND("${projectEsc}", ARRAYJOIN({Project})) > 0,
    {Tactic} = "${tacticEsc}",
    {Variant} = "${variantEsc}"
  )`;
  
  const osBaseId = process.env.AIRTABLE_OS_BASE_ID || process.env.AIRTABLE_BASE_ID || '';
  const token = process.env.AIRTABLE_API_KEY || process.env.AIRTABLE_ACCESS_TOKEN || '';
  const tokenPrefix = token ? token.substring(0, 10) + '...' : 'missing';
  
  try {
    console.log('[comments/asset] BEFORE airtable.select operation:', {
      operation: 'airtable.select',
      baseId: osBaseId,
      tableName,
      recordId: 'none',
      tokenPrefix,
    });
    
    const existing = await osBase(tableName)
      .select({
        filterByFormula: formula,
        maxRecords: 1,
      })
      .firstPage();
    
    console.log('[comments/asset] AFTER airtable.select operation: SUCCESS', {
      operation: 'airtable.select',
      baseId: osBaseId,
      tableName,
      recordCount: existing.length,
    });
    
    if (existing.length > 0) {
      return existing[0].id;
    }
    
    // Create new record if not found
    // Note: Project field expects array of record IDs, not objects with id property
    console.log('[comments/asset] BEFORE airtable.create operation:', {
      operation: 'airtable.create',
      baseId: osBaseId,
      tableName,
      recordId: 'none',
      tokenPrefix,
    });
    
    const created = (await osBase(tableName).create({
      Project: [projectId],
      Tactic: tactic,
      Variant: variant,
    } as any)) as unknown as { id: string };
    
    console.log('[comments/asset] AFTER airtable.create operation: SUCCESS', {
      operation: 'airtable.create',
      baseId: osBaseId,
      tableName,
      recordId: created.id,
    });
    
    return created.id;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    const is403 = errorMessage.includes('403') || errorMessage.includes('NOT_AUTHORIZED');
    
    if (is403) {
      console.error('[comments/asset] 403 at operation airtable.select/create on table ' + tableName + ' in base ' + osBaseId, {
        operation: 'airtable.select/create',
        baseId: osBaseId,
        tableName,
        recordId: 'none',
        tokenPrefix,
        error: errorMessage,
      });
    }
    
    console.error('[comments/asset] Failed to find or create Creative Review Set:', err);
    return null;
  }
}

// GET: List asset comments
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  const crasId = req.nextUrl.searchParams.get('crasId');
  const fileId = req.nextUrl.searchParams.get('fileId');
  
  if (!token) {
    return NextResponse.json({ error: 'Missing token' }, { status: 401 });
  }
  
  // Resolve CRAS ID from fileId if not provided
  let resolvedCrasId: string | undefined = crasId || undefined; // Convert null to undefined
  if (!resolvedCrasId && fileId) {
    try {
      const resolved = await getCrasRecordIdByTokenAndFileId(token, fileId);
      resolvedCrasId = resolved || undefined; // Convert null to undefined
    } catch (err) {
      console.warn('[comments/asset] Failed to resolve CRAS ID from fileId:', err);
    }
  }
  
  if (!resolvedCrasId) {
    return NextResponse.json({ error: 'Missing crasId or fileId' }, { status: 400 });
  }
  
  const resolved = await resolveReviewProject(token);
  if (!resolved) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }
  
  const commentsBase = getCommentsBase();
  const commentsBaseId = process.env.AIRTABLE_COMMENTS_BASE_ID || 'appQLwoVH8JyGSTIo';
  
  // Resolve existing fields and build field map
  let existingFields: Set<string>;
  let fieldMap: CommentsFieldMap;
  try {
    existingFields = await resolveExistingFields(commentsBaseId, AIRTABLE_TABLES.COMMENTS);
    fieldMap = resolveFieldMap(existingFields);
    
    console.log('[comments/asset] GET - Resolved field names:', {
      baseId: commentsBaseId,
      tableName: AIRTABLE_TABLES.COMMENTS,
      fieldMap,
      existingFieldCount: existingFields.size,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[comments/asset] GET - Failed to resolve fields:', {
      error: message,
      baseId: commentsBaseId,
      tableName: AIRTABLE_TABLES.COMMENTS,
    });
    // Graceful degradation - return empty array on schema resolution failure
    return NextResponse.json({ ok: true, comments: [] }, { headers: NO_STORE_HEADERS });
  }
  
  // Require Target CRAS field (schema must include it)
  if (!fieldMap.targetCras) {
    console.warn('[comments/asset] GET - Target CRAS field not found, returning empty results:', {
      fieldMap,
      existingFields: Array.from(existingFields).sort(),
    });
    return NextResponse.json({ ok: true, comments: [] }, { headers: NO_STORE_HEADERS });
  }
  
  try {
    // Build filter formula using Target CRAS field only
    const crasIdEsc = String(resolvedCrasId).replace(/"/g, '\\"');
    const fieldEsc = String(fieldMap.targetCras).replace(/"/g, '\\"');
    
    // Build formula with Target CRAS condition and optional Target Type filter
    const targetCondition = `FIND("${crasIdEsc}", ARRAYJOIN({${fieldEsc}})) > 0`;
    let formulaParts: string[] = [targetCondition];
    
    // Add Target Type filter if field exists
    if (fieldMap.targetType) {
      const typeEsc = String(fieldMap.targetType).replace(/"/g, '\\"');
      formulaParts.push(`{${typeEsc}} = "Asset"`);
    }
    
    const formula = formulaParts.length === 1 
      ? formulaParts[0]
      : `AND(${formulaParts.join(', ')})`;
    
    const token = process.env.AIRTABLE_API_KEY || process.env.AIRTABLE_ACCESS_TOKEN || '';
    const tokenPrefix = token ? token.substring(0, 10) + '...' : 'missing';
    
    console.log('[comments/asset] BEFORE airtable.select operation:', {
      operation: 'airtable.select',
      baseId: commentsBaseId,
      tableName: AIRTABLE_TABLES.COMMENTS,
      recordId: 'none',
      tokenPrefix,
      targetAssetId: resolvedCrasId,
      formula,
    });
    
    const records = await commentsBase(AIRTABLE_TABLES.COMMENTS)
      .select({
        filterByFormula: formula,
        sort: [{ field: 'Created', direction: 'desc' }],
      })
      .all();
    
    console.log('[comments/asset] AFTER airtable.select operation: SUCCESS', {
      operation: 'airtable.select',
      baseId: commentsBaseId,
      tableName: AIRTABLE_TABLES.COMMENTS,
      recordCount: records.length,
    });
    
    const comments: AssetComment[] = records.map((r) => {
      const fields = r.fields as Record<string, unknown>;
      const author = (fields['Author'] as string) || 'Anonymous';
      
      // Extract email from author field if it's in format "Name <email>"
      let authorName = author;
      let authorEmail: string | undefined;
      const emailMatch = author.match(/^(.+?)\s*<(.+?)>$/);
      if (emailMatch) {
        authorName = emailMatch[1].trim();
        authorEmail = emailMatch[2].trim();
      }
      
      // Check for separate Author Email field if it exists (use resolved field name)
      if (!authorEmail && fieldMap.authorEmail && fields[fieldMap.authorEmail]) {
        authorEmail = fields[fieldMap.authorEmail] as string;
      }
      
      // Use resolved field names for body
      const bodyValue = fieldMap.body ? (fields[fieldMap.body] as string) || '' : '';
      
      return {
        id: r.id,
        body: bodyValue,
        author: authorName,
        authorEmail,
        createdAt: (fields['Created'] as string) || new Date().toISOString(),
      };
    });
    
    return NextResponse.json({ ok: true, comments }, { headers: NO_STORE_HEADERS });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const is403 = message.includes('403') || 
                 message.includes('NOT_AUTHORIZED') ||
                 (err as any)?.statusCode === 403;
    const token = process.env.AIRTABLE_API_KEY || process.env.AIRTABLE_ACCESS_TOKEN || '';
    const tokenPrefix = token ? token.substring(0, 10) + '...' : 'missing';
    
    if (is403) {
      console.error('[comments/asset] 403 at operation airtable.select on table ' + AIRTABLE_TABLES.COMMENTS + ' in base ' + commentsBaseId, {
        operation: 'airtable.select',
        baseId: commentsBaseId,
        tableName: AIRTABLE_TABLES.COMMENTS,
        recordId: 'none',
        tokenPrefix,
        error: message,
      });
    }
    
    console.error('[comments/asset] GET error:', message);
    
    // Graceful degradation - return empty array on errors
    return NextResponse.json({ ok: true, comments: [] }, { headers: NO_STORE_HEADERS });
  }
}

// POST: Create asset comment
export async function POST(req: NextRequest) {
  console.log('[comments/asset] POST called');
  const token = req.nextUrl.searchParams.get('token');
  
  let body: {
    crasId?: string;
    crasRecordId?: string; // Preferred: CRAS record ID
    creativeReviewAssetId?: string; // Legacy: Creative Review Asset record ID
    groupId?: string;
    body?: string;
    authorName?: string;
    authorEmail?: string;
    tactic?: string;
    variant?: string;
    fileId?: string;
  };
  
  try {
    body = await req.json();
    console.log('[comments/asset] Request body parsed:', {
      hasBody: !!body.body,
      bodyLength: body.body?.length || 0,
      hasFileId: !!body.fileId,
      hasCrasId: !!body.crasId,
      hasCrasRecordId: !!body.crasRecordId,
      hasCreativeReviewAssetId: !!body.creativeReviewAssetId,
      hasGroupId: !!body.groupId,
      hasAuthorName: !!body.authorName,
      hasAuthorEmail: !!body.authorEmail,
    });
  } catch (err) {
    console.error('[comments/asset] Failed to parse JSON:', err);
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  
  const finalToken = token || (body as any).token;
  if (!finalToken) {
    console.error('[comments/asset] Missing token');
    return NextResponse.json({ error: 'Missing token' }, { status: 401 });
  }
  
  if (isRateLimited(finalToken)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }
  
  const resolved = await resolveReviewProject(finalToken);
  if (!resolved) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }
  
  const crasId = body.crasId; // Legacy support
  const crasRecordId = body.crasRecordId; // Preferred
  const creativeReviewAssetId = body.creativeReviewAssetId; // Legacy
  const groupId = body.groupId;
  const commentBody = body.body;
  const authorName = body.authorName;
  const authorEmail = body.authorEmail;
  const tactic = body.tactic;
  const variant = body.variant;
  const fileId = body.fileId;
  
  // Resolve CRAS ID: prefer crasRecordId, fallback to crasId, then try fileId
  let resolvedCrasId: string | undefined = typeof crasRecordId === 'string' ? crasRecordId : (typeof crasId === 'string' ? crasId : undefined);
  if (!resolvedCrasId && fileId) {
    try {
      const resolved = await getCrasRecordIdByTokenAndFileId(finalToken, fileId);
      // Ensure it's a string, not an object
      resolvedCrasId = typeof resolved === 'string' ? resolved : undefined;
    } catch (err) {
      console.warn('[comments/asset] Failed to resolve CRAS ID from fileId:', err);
    }
  }
  
  // Validate: must have either crasRecordId (preferred) or creativeReviewAssetId (legacy)
  const hasCrasRecordId = resolvedCrasId && typeof resolvedCrasId === 'string' && resolvedCrasId.trim().startsWith('rec');
  const hasCreativeReviewAssetId = creativeReviewAssetId && typeof creativeReviewAssetId === 'string' && creativeReviewAssetId.trim().startsWith('rec');
  
  if (!hasCrasRecordId && !hasCreativeReviewAssetId) {
    console.error('[comments/asset] Missing required ID:', {
      hasCrasRecordId,
      hasCreativeReviewAssetId,
      crasRecordId,
      crasId,
      creativeReviewAssetId,
      fileId,
    });
    return NextResponse.json(
      { 
        error: 'Missing required ID: provide either crasRecordId (preferred) or creativeReviewAssetId (legacy). Both must be valid Airtable record IDs starting with "rec".' 
      },
      { status: 400 }
    );
  }
  
  // Validate format if crasRecordId provided
  if (hasCrasRecordId) {
    resolvedCrasId = String(resolvedCrasId).trim();
    if (!resolvedCrasId.startsWith('rec')) {
      console.error('[comments/asset] crasRecordId does not look like a valid Airtable record ID:', resolvedCrasId);
      return NextResponse.json({ error: 'Invalid crasRecordId format: must start with "rec"' }, { status: 400 });
    }
  }
  
  // Validate format if creativeReviewAssetId provided
  if (hasCreativeReviewAssetId) {
    const assetId = String(creativeReviewAssetId).trim();
    if (!assetId.startsWith('rec')) {
      console.error('[comments/asset] creativeReviewAssetId does not look like a valid Airtable record ID:', assetId);
      return NextResponse.json({ error: 'Invalid creativeReviewAssetId format: must start with "rec"' }, { status: 400 });
    }
  }
  
  if (!commentBody || typeof commentBody !== 'string' || !commentBody.trim()) {
    return NextResponse.json({ error: 'Comment body is required' }, { status: 400 });
  }
  
  if (!authorName || typeof authorName !== 'string' || !authorName.trim()) {
    return NextResponse.json({ error: 'Author name is required' }, { status: 400 });
  }
  
  const trimmedBody = commentBody.trim();
  const trimmedAuthorName = authorName.trim();
  const trimmedAuthorEmail = authorEmail?.trim();
  
  // Validate email if provided
  if (trimmedAuthorEmail && !isValidEmail(trimmedAuthorEmail)) {
    return NextResponse.json({ error: 'Valid author email is required' }, { status: 400 });
  }
  
  const createdAt = new Date().toISOString();
  
  const commentsBaseId = process.env.AIRTABLE_COMMENTS_BASE_ID || 'appQLwoVH8JyGSTIo';
  const apiKey = process.env.AIRTABLE_API_KEY || process.env.AIRTABLE_ACCESS_TOKEN || '';
  const apiKeyPrefix = apiKey ? apiKey.substring(0, 10) + '...' : 'missing';
  
  // Health check: Verify Comments base access before proceeding
  const healthStatus = await checkAirtableBaseHealth();
  if (!healthStatus.commentsBase.healthy && healthStatus.commentsBase.checked) {
    // Comments base failed health check (likely 403)
    console.error('[comments/asset] Comments base health check failed:', {
      baseId: healthStatus.commentsBase.baseId,
      apiKeyPrefix: healthStatus.commentsBase.apiKeyPrefix,
      osBaseHealthy: healthStatus.osBase.healthy,
      osBaseId: healthStatus.osBase.baseId,
    });
    return NextResponse.json(
      {
        error: `Airtable PAT not authorized for Comments base ${healthStatus.commentsBase.baseId}. Fix base permissions or use correct PAT.`,
        baseId: healthStatus.commentsBase.baseId,
        apiKeyPrefix: healthStatus.commentsBase.apiKeyPrefix,
      },
      { status: 503 }
    );
  }
  
  // Resolve existing fields and build field map
  let existingFields: Set<string>;
  let fieldMap: CommentsFieldMap;
  try {
    existingFields = await resolveExistingFields(commentsBaseId, AIRTABLE_TABLES.COMMENTS);
    fieldMap = resolveFieldMap(existingFields);
    
    console.log('[comments/asset] Resolved field names:', {
      baseId: commentsBaseId,
      tableName: AIRTABLE_TABLES.COMMENTS,
      fieldMap,
      existingFieldCount: existingFields.size,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[comments/asset] Failed to resolve fields:', {
      error: message,
      baseId: commentsBaseId,
      tableName: AIRTABLE_TABLES.COMMENTS,
    });
    return NextResponse.json(
      {
        error: `Failed to resolve Airtable schema: ${message}. Check base permissions and table name.`,
        baseId: commentsBaseId,
      },
      { status: 500 }
    );
  }
  
  // Validate required fields exist
  if (!fieldMap.body) {
    console.error('[comments/asset] Required field "Body" not found in schema:', {
      existingFields: Array.from(existingFields).sort(),
      triedAliases: COMMENTS_FIELD_ALIASES.body,
    });
    return NextResponse.json(
      {
        error: 'Required field "Body" not found in Comments table. Expected one of: ' + COMMENTS_FIELD_ALIASES.body.join(', '),
        baseId: commentsBaseId,
        existingFields: Array.from(existingFields).sort(),
      },
      { status: 500 }
    );
  }
  
  // Require Target CRAS field (schema must include it)
  if (!fieldMap.targetCras) {
    console.error('[comments/asset] Target CRAS field not found in schema:', {
      hasCrasRecordId,
      hasCreativeReviewAssetId,
      fieldMap,
      existingFields: Array.from(existingFields).sort(),
    });
    return NextResponse.json(
      {
        error: 'Target CRAS field not found in Comments table. Expected field: Target CRAS. Found fields: ' + Array.from(existingFields).sort().join(', '),
        baseId: commentsBaseId,
        triedTargetCras: COMMENTS_FIELD_ALIASES.targetCras,
      },
      { status: 500 }
    );
  }
  
  const targetField = fieldMap.targetCras;
  
  try {
    // Create comment record in Comments base using resolved field names
    // Note: Created field removed - it's read-only (automatically set by Airtable)
    // Note: Linked records must be array of record ID strings, not objects with id property
    
    const recordFields: Record<string, unknown> = {
      [fieldMap.body]: trimmedBody.slice(0, 5000),
    };
    
    // Add Status if field exists
    if (fieldMap.status) {
      recordFields[fieldMap.status] = 'Open';
    }
    
    // Add Target Type if field exists
    if (fieldMap.targetType) {
      recordFields[fieldMap.targetType] = 'Asset';
    }
    
    // Set Target CRAS field (required - schema must include it)
    if (hasCrasRecordId && resolvedCrasId) {
      const crasIdString = String(resolvedCrasId).trim();
      recordFields[fieldMap.targetCras] = [crasIdString];
    } else if (hasCreativeReviewAssetId) {
      // Legacy: creativeReviewAssetId should not be used, but if provided, treat as CRAS ID
      const assetIdString = String(creativeReviewAssetId).trim();
      recordFields[fieldMap.targetCras] = [assetIdString];
    }
    
    // Add Author Email field if it exists in schema (optional)
    if (trimmedAuthorEmail && fieldMap.authorEmail) {
      recordFields[fieldMap.authorEmail] = trimmedAuthorEmail.slice(0, 200);
    } else if (trimmedAuthorEmail && !fieldMap.authorEmail) {
      console.warn('[comments/asset] Author Email field not found, omitting:', {
        triedAliases: COMMENTS_FIELD_ALIASES.authorEmail,
        existingFields: Array.from(existingFields).sort(),
      });
    }
    
    // Link Creative Review Groups if groupId provided and field exists
    if (groupId && typeof groupId === 'string' && groupId.trim().startsWith('rec')) {
      if (fieldMap.creativeReviewGroups) {
        recordFields[fieldMap.creativeReviewGroups] = [groupId.trim()];
      } else {
        console.warn('[comments/asset] Creative Review Groups field not found, omitting:', {
          triedAliases: COMMENTS_FIELD_ALIASES.creativeReviewGroups,
          groupId,
        });
      }
    } else if (tactic && variant) {
      // Try to find/create group if tactic and variant provided
      const groupIdFromTactic = await findOrCreateCreativeReviewSet(
        resolved.project.recordId,
        tactic,
        variant
      );
      if (groupIdFromTactic && typeof groupIdFromTactic === 'string' && groupIdFromTactic.trim().startsWith('rec')) {
        if (fieldMap.creativeReviewGroups) {
          recordFields[fieldMap.creativeReviewGroups] = [groupIdFromTactic.trim()];
        } else {
          console.warn('[comments/asset] Creative Review Groups field not found, omitting:', {
            triedAliases: COMMENTS_FIELD_ALIASES.creativeReviewGroups,
            groupIdFromTactic,
          });
        }
      }
    }
    
    // Log omitted fields
    const omittedFields: string[] = [];
    if (trimmedAuthorEmail && !fieldMap.authorEmail) {
      omittedFields.push('Author Email');
    }
    if (groupId && !fieldMap.creativeReviewGroups) {
      omittedFields.push('Creative Review Groups');
    }
    if (omittedFields.length > 0) {
      console.warn('[comments/asset] Omitted fields (not found in schema):', {
        omittedFields,
        fieldMap,
      });
    }
    
    // Comments base ID already resolved above
    console.log('[comments/asset] Comments base ID:', {
      fromEnv: !!process.env.AIRTABLE_COMMENTS_BASE_ID,
      commentsBaseId,
      envVarValue: process.env.AIRTABLE_COMMENTS_BASE_ID || 'not set',
    });
    
    // Validate all linked record fields are arrays of strings (not objects)
    for (const [key, value] of Object.entries(recordFields)) {
      if (Array.isArray(value)) {
        for (let i = 0; i < value.length; i++) {
          const item = value[i];
          if (typeof item !== 'string') {
            console.error(`[comments/asset] Invalid linked record value in field ${key}[${i}]:`, {
              value: item,
              type: typeof item,
              isObject: typeof item === 'object',
            });
            throw new Error(`Field ${key} contains non-string value: ${JSON.stringify(item)}`);
          }
          if (!item.startsWith('rec')) {
            console.warn(`[comments/asset] Linked record value in ${key}[${i}] does not start with 'rec':`, item);
          }
        }
      }
    }
    
    const targetId = hasCrasRecordId ? String(resolvedCrasId).trim() : (hasCreativeReviewAssetId ? String(creativeReviewAssetId).trim() : 'none');
    
    console.log('[comments/asset] Creating comment record:', {
      operation: 'airtable.create',
      table: AIRTABLE_TABLES.COMMENTS,
      baseId: commentsBaseId,
      apiKeyPrefix,
      fieldKeys: Object.keys(recordFields),
      resolvedFieldMap: fieldMap,
      targetField,
      targetId,
      hasCrasRecordId,
      hasCreativeReviewAssetId,
      hasBody: !!trimmedBody,
      bodyLength: trimmedBody.length,
      authorName: trimmedAuthorName,
      authorEmail: trimmedAuthorEmail || 'none',
      groupId: groupId || 'none',
      omittedFields: omittedFields.length > 0 ? omittedFields : undefined,
    });
    
    const token = process.env.AIRTABLE_API_KEY || process.env.AIRTABLE_ACCESS_TOKEN || '';
    const tokenPrefix = token ? token.substring(0, 10) + '...' : 'missing';
    const url = `https://api.airtable.com/v0/${commentsBaseId}/${encodeURIComponent(AIRTABLE_TABLES.COMMENTS)}`;
    
    console.log('[comments/asset] BEFORE airtable.create operation:', {
      operation: 'airtable.create',
      baseId: commentsBaseId,
      tableName: AIRTABLE_TABLES.COMMENTS,
      recordId: 'none',
      url: url.replace(token, '***'),
      tokenPrefix,
    });
    
    let result;
    try {
      result = await createRecord(AIRTABLE_TABLES.COMMENTS, recordFields, commentsBaseId);
      console.log('[comments/asset] AFTER airtable.create operation: SUCCESS', {
        operation: 'airtable.create',
        baseId: commentsBaseId,
        tableName: AIRTABLE_TABLES.COMMENTS,
        recordId: result?.id || result?.records?.[0]?.id || 'unknown',
      });
    } catch (createErr) {
      const errorMessage = createErr instanceof Error ? createErr.message : String(createErr);
      const is403 = errorMessage.includes('403') || 
                   errorMessage.includes('NOT_AUTHORIZED') ||
                   (createErr as any)?.statusCode === 403;
      
      if (is403) {
        console.error('[comments/asset] 403 at operation airtable.create on table ' + AIRTABLE_TABLES.COMMENTS + ' in base ' + commentsBaseId, {
          operation: 'airtable.create',
          baseId: commentsBaseId,
          tableName: AIRTABLE_TABLES.COMMENTS,
          recordId: 'none',
          url: url.replace(token, '***'),
          tokenPrefix,
          error: errorMessage,
        });
      }
      
      console.error('[comments/asset] createRecord threw error:', {
        error: errorMessage,
        stack: createErr instanceof Error ? createErr.stack : undefined,
        fields: recordFields,
        baseId: commentsBaseId,
        targetField: fieldMap.targetCras,
      });
      throw createErr;
    }
    
    const recordId = result?.id || result?.records?.[0]?.id;
    
    if (!recordId) {
      console.error('[comments/asset] Failed to get record ID from create response:', {
        result,
        resultType: typeof result,
        resultKeys: result ? Object.keys(result) : [],
        hasId: !!result?.id,
        hasRecords: !!result?.records,
      });
      throw new Error('Failed to get record ID from create response');
    }
    
    console.log('[comments/asset] Comment created successfully:', {
      recordId,
      table: AIRTABLE_TABLES.COMMENTS,
      baseId: commentsBaseId,
    });
    
    const comment: AssetComment = {
      id: recordId,
      body: trimmedBody,
      author: trimmedAuthorName,
      authorEmail: trimmedAuthorEmail,
      createdAt,
    };
    
    return NextResponse.json(
      { ok: true, comment, commentId: recordId },
      { headers: NO_STORE_HEADERS }
    );
  } catch (err: unknown) {
    // Fail-fast guard: catch AirtableNotAuthorizedError specifically
    if (err instanceof AirtableNotAuthorizedError) {
      // Log with all context: baseId + apiKeyPrefix + tableName + operation
      console.error('[comments/asset] AirtableNotAuthorizedError:', {
        baseId: err.baseId,
        tableName: err.tableName,
        operation: err.operation,
        apiKeyPrefix: err.apiKeyPrefix,
      });
      
      return NextResponse.json(
        {
          error: `Airtable PAT is not authorized for base ${err.baseId}; grant access or use correct token.`,
          baseId: err.baseId,
          tableName: err.tableName,
          operation: err.operation,
        },
        { status: 503 }
      );
    }
    
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    
    // Compute incomingAssetId based on which ID was provided
    const incomingAssetId = hasCrasRecordId && resolvedCrasId 
      ? String(resolvedCrasId).trim() 
      : (hasCreativeReviewAssetId && creativeReviewAssetId 
          ? String(creativeReviewAssetId).trim() 
          : 'unknown');
    
    // Check for 403 errors specifically (fallback for other 403 sources)
    const is403 = (err as any)?.statusCode === 403 || 
                 message.includes('403') || 
                 message.includes('NOT_AUTHORIZED') ||
                 (err as any)?.error === 'NOT_AUTHORIZED';
    
    const commentsBaseId = process.env.AIRTABLE_COMMENTS_BASE_ID || 'appQLwoVH8JyGSTIo';
    const apiKey = process.env.AIRTABLE_API_KEY || process.env.AIRTABLE_ACCESS_TOKEN || '';
    const tokenPrefix = apiKey ? (apiKey.startsWith('pat') ? apiKey.substring(0, 10) + '...' : apiKey.substring(0, 10) + '...') : 'missing';
    
    console.error('[comments/asset] POST error:', {
      message,
      stack,
      error: err,
      is403,
      table: AIRTABLE_TABLES.COMMENTS,
      commentsBaseId,
      incomingAssetId,
      hasCrasRecordId,
      hasCreativeReviewAssetId,
      authMode: apiKey ? 'service_account' : 'none',
      tokenPrefix,
    });
    
    // Enhanced error message for 403s
    let errorMessage: string;
    if (is403) {
      errorMessage = `Airtable API 403 NOT_AUTHORIZED: ${message}. ` +
        `Operation: comments/asset POST (create comment record). ` +
        `Create Base: ${commentsBaseId} (used to create comment record). ` +
        `Table: ${AIRTABLE_TABLES.COMMENTS}. ` +
        `Auth Mode: ${apiKey ? 'service_account' : 'none'}, Token: ${tokenPrefix}. ` +
        `The PAT (Personal Access Token) lacks access to base ${commentsBaseId} and table "${AIRTABLE_TABLES.COMMENTS}". ` +
        `Check API key permissions in Airtable. ` +
        `CRAS ID: ${incomingAssetId}.`;
    } else {
      errorMessage = `Failed to create comment: ${message}`;
    }
    
    const statusCode = is403 ? 503 : 500;
    
    return NextResponse.json({ 
      error: errorMessage,
      incomingAssetId,
    }, { status: statusCode });
  }
}
