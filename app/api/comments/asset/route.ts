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
  
  try {
    // Build filter formula: {Target CRAS} = "<crasRecordId>"
    const crasIdEsc = String(resolvedCrasId).replace(/"/g, '\\"');
    const formula = `{Target CRAS} = "${crasIdEsc}"`;
    
    const token = process.env.AIRTABLE_API_KEY || process.env.AIRTABLE_ACCESS_TOKEN || '';
    const tokenPrefix = token ? token.substring(0, 10) + '...' : 'missing';
    
    console.log('[comments/asset] BEFORE airtable.select operation:', {
      operation: 'airtable.select',
      baseId: commentsBaseId,
      tableName: AIRTABLE_TABLES.COMMENTS,
      crasRecordId: resolvedCrasId,
      tokenPrefix,
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
      crasRecordId: resolvedCrasId,
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
      
      // Check for separate Author Email field
      if (!authorEmail && fields['Author Email']) {
        authorEmail = fields['Author Email'] as string;
      }
      
      // Use exact field name for body
      const bodyValue = (fields['Body'] as string) || '';
      
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
    crasRecordId?: string;
    groupId?: string;
    body?: string;
    authorName?: string;
    authorEmail?: string;
    status?: string;
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
  
  const crasId = body.crasId;
  const crasRecordId = body.crasRecordId;
  const groupId = body.groupId;
  const commentBody = body.body;
  const authorName = body.authorName;
  const authorEmail = body.authorEmail;
  const status = body.status;
  const tactic = body.tactic;
  const variant = body.variant;
  const fileId = body.fileId;
  
  // Resolve CRAS ID: prefer crasRecordId, fallback to crasId, then try fileId
  let resolvedCrasId: string | undefined = typeof crasRecordId === 'string' ? crasRecordId : (typeof crasId === 'string' ? crasId : undefined);
  if (!resolvedCrasId && fileId) {
    try {
      const resolved = await getCrasRecordIdByTokenAndFileId(finalToken, fileId);
      resolvedCrasId = typeof resolved === 'string' ? resolved : undefined;
    } catch (err) {
      console.warn('[comments/asset] Failed to resolve CRAS ID from fileId:', err);
    }
  }
  
  // Validate: must have crasRecordId
  if (!resolvedCrasId || typeof resolvedCrasId !== 'string' || !resolvedCrasId.trim().startsWith('rec')) {
    console.error('[comments/asset] Missing or invalid crasRecordId:', {
      crasRecordId,
      crasId,
      fileId,
      resolvedCrasId,
    });
    return NextResponse.json(
      { 
        error: 'Missing or invalid crasRecordId. Must be a valid Airtable record ID starting with "rec".' 
      },
      { status: 400 }
    );
  }
  
  resolvedCrasId = String(resolvedCrasId).trim();
  if (!resolvedCrasId.startsWith('rec')) {
    console.error('[comments/asset] crasRecordId does not look like a valid Airtable record ID:', resolvedCrasId);
    return NextResponse.json({ error: 'Invalid crasRecordId format: must start with "rec"' }, { status: 400 });
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
  
  try {
    // Create comment record in Comments base
    // Note: Created field removed - it's read-only (automatically set by Airtable)
    // Note: Linked records must be array of record ID strings, not objects with id property
    
    const recordFields: Record<string, unknown> = {
      Body: trimmedBody.slice(0, 5000),
      Status: status || 'Open',
      'Target Type': 'Asset',
      'Target CRAS': [resolvedCrasId],
    };
    
    // Add Author Email field if provided (optional)
    if (trimmedAuthorEmail) {
      recordFields['Author Email'] = trimmedAuthorEmail.slice(0, 200);
    }
    
    // Link Creative Review Groups if groupId provided
    if (groupId && typeof groupId === 'string' && groupId.trim().startsWith('rec')) {
      recordFields['Creative Review Groups'] = [groupId.trim()];
    } else if (tactic && variant) {
      // Try to find/create group if tactic and variant provided
      const groupIdFromTactic = await findOrCreateCreativeReviewSet(
        resolved.project.recordId,
        tactic,
        variant
      );
      if (groupIdFromTactic && typeof groupIdFromTactic === 'string' && groupIdFromTactic.trim().startsWith('rec')) {
        recordFields['Creative Review Groups'] = [groupIdFromTactic.trim()];
      }
    }
    
    // Remove undefined values from recordFields
    Object.keys(recordFields).forEach((key) => {
      if (recordFields[key] === undefined) {
        delete recordFields[key];
      }
    });
    
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
    
    console.log('[comments/asset] Creating comment record:', {
      operation: 'airtable.create',
      baseId: commentsBaseId,
      tableName: AIRTABLE_TABLES.COMMENTS,
      crasRecordId: resolvedCrasId,
      fieldKeys: Object.keys(recordFields),
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
        tableName: AIRTABLE_TABLES.COMMENTS,
        crasRecordId: resolvedCrasId,
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
      baseId: commentsBaseId,
      tableName: AIRTABLE_TABLES.COMMENTS,
      crasRecordId: resolvedCrasId,
      commentId: recordId,
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
    
    // Check for 403 errors specifically
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
      baseId: commentsBaseId,
      tableName: AIRTABLE_TABLES.COMMENTS,
      crasRecordId: resolvedCrasId,
      authMode: apiKey ? 'service_account' : 'none',
      tokenPrefix,
    });
    
    // Enhanced error message for 403s
    let errorMessage: string;
    if (is403) {
      errorMessage = `Airtable API 403 NOT_AUTHORIZED: ${message}. ` +
        `Operation: comments/asset POST (create comment record). ` +
        `Base: ${commentsBaseId}. ` +
        `Table: ${AIRTABLE_TABLES.COMMENTS}. ` +
        `Auth Mode: ${apiKey ? 'service_account' : 'none'}, Token: ${tokenPrefix}. ` +
        `The PAT (Personal Access Token) lacks access to base ${commentsBaseId} and table "${AIRTABLE_TABLES.COMMENTS}". ` +
        `Check API key permissions in Airtable. ` +
        `CRAS ID: ${resolvedCrasId}.`;
    } else {
      errorMessage = `Failed to create comment: ${message}`;
    }
    
    const statusCode = is403 ? 503 : 500;
    
    return NextResponse.json({ 
      error: errorMessage,
      crasRecordId: resolvedCrasId,
    }, { status: statusCode });
  }
}
