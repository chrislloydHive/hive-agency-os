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
  
  try {
    const existing = await osBase(tableName)
      .select({
        filterByFormula: formula,
        maxRecords: 1,
      })
      .firstPage();
    
    if (existing.length > 0) {
      return existing[0].id;
    }
    
    // Create new record if not found
    // Note: Project field expects array of record IDs, not objects with id property
    const created = (await osBase(tableName).create({
      Project: [projectId],
      Tactic: tactic,
      Variant: variant,
    } as any)) as unknown as { id: string };
    
    return created.id;
  } catch (err) {
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
  
  try {
    // Query Comments table for asset comments
    // Check both Target CRAS (preferred) and Target Asset (legacy/Option A) fields
    const crasIdEsc = String(resolvedCrasId).replace(/"/g, '\\"');
    const commentsBaseId = process.env.AIRTABLE_COMMENTS_BASE_ID || 'appQLwoVH8JyGSTIo';
    
    // Try formula with Target CRAS first (preferred schema)
    let formula = `AND(
      OR(
        FIND("${crasIdEsc}", ARRAYJOIN({Target CRAS})) > 0,
        FIND("${crasIdEsc}", ARRAYJOIN({Target Asset})) > 0
      ),
      {Target Type} = "Asset"
    )`;
    
    let records;
    try {
      console.log('[comments/asset] Querying comments (with Target CRAS):', {
        operation: 'airtable.select',
        table: AIRTABLE_TABLES.COMMENTS,
        baseId: commentsBaseId,
        targetAssetId: resolvedCrasId,
        queryFields: ['Target CRAS', 'Target Asset'],
      });
      
      records = await commentsBase(AIRTABLE_TABLES.COMMENTS)
        .select({
          filterByFormula: formula,
          sort: [{ field: 'Created', direction: 'desc' }],
        })
        .all();
    } catch (formulaErr) {
      // Option A fallback: If Target CRAS field doesn't exist, query only Target Asset
      const errorMessage = formulaErr instanceof Error ? formulaErr.message : String(formulaErr);
      if (errorMessage.includes('UNKNOWN_FIELD_NAME') || errorMessage.includes('Target CRAS')) {
        console.warn('[comments/asset] Target CRAS field not found (Option A schema), querying Target Asset only:', {
          error: errorMessage,
        });
        
        formula = `AND(
          FIND("${crasIdEsc}", ARRAYJOIN({Target Asset})) > 0,
          {Target Type} = "Asset"
        )`;
        
        records = await commentsBase(AIRTABLE_TABLES.COMMENTS)
          .select({
            filterByFormula: formula,
            sort: [{ field: 'Created', direction: 'desc' }],
          })
          .all();
      } else {
        throw formulaErr;
      }
    }
    
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
      
      // Check for separate Author Email field if it exists
      if (!authorEmail && fields['Author Email']) {
        authorEmail = fields['Author Email'] as string;
      }
      
      return {
        id: r.id,
        body: (fields['Body'] as string) || '',
        author: authorName,
        authorEmail,
        createdAt: (fields['Created'] as string) || new Date().toISOString(),
      };
    });
    
    return NextResponse.json({ ok: true, comments }, { headers: NO_STORE_HEADERS });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
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
  
  try {
    // Create comment record in Comments base
    // Note: Author field removed - it's not a text field (likely collaborator/link/single-select)
    // Note: Created field removed - it's read-only (automatically set by Airtable)
    // Note: Linked records must be array of record ID strings, not objects with id property
    
    const recordFields: Record<string, unknown> = {
      Body: trimmedBody.slice(0, 5000),
      Status: 'Open', // Single-select: use string value
      'Target Type': 'Asset', // Single-select: use string value
    };
    
    // Set target field based on provided ID
    // If crasRecordId provided: write to Target CRAS (or Target Asset if Option A schema)
    // If only creativeReviewAssetId provided: write to Target Asset (legacy)
    if (hasCrasRecordId && resolvedCrasId) {
      const crasIdString = String(resolvedCrasId).trim();
      // Prefer Target CRAS field, but use Target Asset if Option A schema (no Target CRAS field)
      // Note: If Target CRAS doesn't exist, Airtable will return UNKNOWN_FIELD_NAME error
      recordFields['Target CRAS'] = [crasIdString];
      // For Option A compatibility: if Target CRAS field doesn't exist, use Target Asset instead
      // This will be handled by Airtable error response if Target CRAS is missing
    } else if (hasCreativeReviewAssetId) {
      const assetIdString = String(creativeReviewAssetId).trim();
      recordFields['Target Asset'] = [assetIdString];
    }
    
    // Add Author Email field if it exists in schema (optional)
    if (trimmedAuthorEmail) {
      recordFields['Author Email'] = trimmedAuthorEmail.slice(0, 200);
    }
    
    // Link Creative Review Groups if groupId provided
    // Ensure groupId is a string, not an object
    if (groupId && typeof groupId === 'string' && groupId.trim().startsWith('rec')) {
      recordFields['Creative Review Groups'] = [groupId.trim()]; // Linked record: array of record ID strings
    } else if (tactic && variant) {
      // Try to find/create group if tactic and variant provided
      const groupIdFromTactic = await findOrCreateCreativeReviewSet(
        resolved.project.recordId,
        tactic,
        variant
      );
      if (groupIdFromTactic && typeof groupIdFromTactic === 'string' && groupIdFromTactic.trim().startsWith('rec')) {
        recordFields['Creative Review Groups'] = [groupIdFromTactic.trim()]; // Linked record: array of record ID strings
      }
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
    
    const targetId = hasCrasRecordId ? resolvedCrasId : (hasCreativeReviewAssetId ? String(creativeReviewAssetId).trim() : 'none');
    const targetField = hasCrasRecordId ? 'Target CRAS (or Target Asset)' : 'Target Asset';
    
    console.log('[comments/asset] Creating comment record:', {
      operation: 'airtable.create',
      table: AIRTABLE_TABLES.COMMENTS,
      baseId: commentsBaseId,
      apiKeyPrefix,
      fieldKeys: Object.keys(recordFields),
      targetField,
      targetId,
      hasCrasRecordId,
      hasCreativeReviewAssetId,
      hasBody: !!trimmedBody,
      bodyLength: trimmedBody.length,
      authorName: trimmedAuthorName,
      authorEmail: trimmedAuthorEmail || 'none',
      groupId: groupId || 'none',
    });
    
    let result;
    try {
      result = await createRecord(AIRTABLE_TABLES.COMMENTS, recordFields, commentsBaseId);
      console.log('[comments/asset] createRecord returned:', {
        hasId: !!result?.id,
        hasRecords: !!result?.records,
        recordsLength: result?.records?.length || 0,
        fullResult: JSON.stringify(result, null, 2),
      });
    } catch (createErr) {
      // Option A fallback: If Target CRAS field doesn't exist (UNKNOWN_FIELD_NAME), retry with Target Asset
      const errorMessage = createErr instanceof Error ? createErr.message : String(createErr);
      const isUnknownField = errorMessage.includes('UNKNOWN_FIELD_NAME') && 
                            (errorMessage.includes('Target CRAS') || recordFields['Target CRAS']);
      
      if (isUnknownField && hasCrasRecordId && resolvedCrasId) {
        console.warn('[comments/asset] Target CRAS field not found (Option A schema), retrying with Target Asset:', {
          error: errorMessage,
          crasId: String(resolvedCrasId).trim(),
        });
        
        // Remove Target CRAS, use Target Asset instead
        const fallbackFields = { ...recordFields };
        delete fallbackFields['Target CRAS'];
        fallbackFields['Target Asset'] = [String(resolvedCrasId).trim()];
        
        try {
          result = await createRecord(AIRTABLE_TABLES.COMMENTS, fallbackFields, commentsBaseId);
          console.log('[comments/asset] createRecord (Option A fallback) returned:', {
            hasId: !!result?.id,
            hasRecords: !!result?.records,
            recordsLength: result?.records?.length || 0,
          });
        } catch (fallbackErr) {
          console.error('[comments/asset] createRecord (Option A fallback) threw error:', {
            error: fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr),
            stack: fallbackErr instanceof Error ? fallbackErr.stack : undefined,
            fields: fallbackFields,
            baseId: commentsBaseId,
          });
          throw fallbackErr;
        }
      } else {
        console.error('[comments/asset] createRecord threw error:', {
          error: errorMessage,
          stack: createErr instanceof Error ? createErr.stack : undefined,
          fields: recordFields,
          baseId: commentsBaseId,
        });
        throw createErr;
      }
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
    
    const incomingAssetId = typeof resolvedCrasId === 'string' ? resolvedCrasId : 'unknown';
    
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
      incomingAssetId: crasIdString,
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
      incomingAssetId: crasIdString,
    }, { status: statusCode });
  }
}
