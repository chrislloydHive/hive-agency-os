// app/api/comments/group/route.ts
// Group-level comments API for the Client Review Portal.
// Creates and reads comments from the canonical Comments table with Target Type = "Group".

import { NextRequest, NextResponse } from 'next/server';
import { getBase, getCommentsBase } from '@/lib/airtable';
import { AIRTABLE_TABLES } from '@/lib/airtable/tables';
import { resolveReviewProject } from '@/lib/review/resolveProject';
import { createRecord } from '@/lib/airtable/client';

export const dynamic = 'force-dynamic';

const VALID_VARIANTS = new Set(['Prospecting', 'Retargeting']);
const VALID_TACTICS = new Set([
  'Display', 'Social', 'Video', 'Audio', 'OOH', 'PMAX', 'Geofence', 'Search',
  'General', // variant-level feedback when no assets yet
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

interface GroupComment {
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
    console.error('[comments/group] Failed to find or create Creative Review Set:', err);
    return null;
  }
}

// GET: List group comments
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  const groupId = req.nextUrl.searchParams.get('groupId');
  
  if (!token) {
    return NextResponse.json({ error: 'Missing token' }, { status: 401 });
  }
  
  if (!groupId) {
    return NextResponse.json({ error: 'Missing groupId' }, { status: 400 });
  }
  
  const resolved = await resolveReviewProject(token);
  if (!resolved) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }
  
  const commentsBase = getCommentsBase();
  
  try {
    // Query Comments table for group comments
    const groupIdEsc = String(groupId).replace(/"/g, '\\"');
    const formula = `AND(
      FIND("${groupIdEsc}", ARRAYJOIN({Creative Review Groups})) > 0,
      {Target Type} = "Group"
    )`;
    
    const records = await commentsBase(AIRTABLE_TABLES.COMMENTS)
      .select({
        filterByFormula: formula,
        sort: [{ field: 'Created', direction: 'desc' }],
      })
      .all();
    
    const comments: GroupComment[] = records.map((r) => {
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
    console.error('[comments/group] GET error:', message);
    
    // Graceful degradation - return empty array on errors
    return NextResponse.json({ ok: true, comments: [] }, { headers: NO_STORE_HEADERS });
  }
}

// POST: Create group comment
export async function POST(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  
  let body: {
    groupId?: string;
    body?: string;
    authorName?: string;
    authorEmail?: string;
  };
  
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  
  const finalToken = token || (body as any).token;
  if (!finalToken) {
    return NextResponse.json({ error: 'Missing token' }, { status: 401 });
  }
  
  if (isRateLimited(finalToken)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }
  
  const resolved = await resolveReviewProject(finalToken);
  if (!resolved) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }
  
  const groupIdRaw = body.groupId;
  const commentBody = body.body;
  const authorName = body.authorName;
  const authorEmail = body.authorEmail;
  
  // Ensure groupId is a string, not an object
  const groupId = typeof groupIdRaw === 'string' ? groupIdRaw.trim() : String(groupIdRaw || '').trim();
  
  if (!groupId || !groupId.startsWith('rec')) {
    console.error('[comments/group] Invalid groupId:', { groupIdRaw, groupId, type: typeof groupIdRaw });
    return NextResponse.json({ error: 'Missing or invalid groupId' }, { status: 400 });
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
  
  const osBase = getBase();
  const createdAt = new Date().toISOString();
  
  try {
    // Create comment record
    // Note: Author field removed - it's not a text field (likely collaborator/link/single-select)
    // Note: Created field removed - it's read-only (automatically set by Airtable)
    // Note: Linked records must be array of record ID strings, not objects with id property
    // Ensure groupId is definitely a string
    const groupIdString = String(groupId).trim();
    if (!groupIdString.startsWith('rec')) {
      throw new Error(`Invalid group ID format: ${groupIdString}`);
    }
    
    const recordFields: Record<string, unknown> = {
      Body: trimmedBody.slice(0, 5000),
      Status: 'Open', // Single-select: use string value
      'Target Type': 'Group', // Single-select: use string value
      'Creative Review Groups': [groupIdString], // Linked record: array of record ID strings (must be strings, not objects)
    };
    
    // Add Author Email field if it exists in schema (optional)
    if (trimmedAuthorEmail) {
      recordFields['Author Email'] = trimmedAuthorEmail.slice(0, 200);
    }
    
    // Comments table is in a different base (appQLwoVH8JyGSTIo)
    // Use AIRTABLE_COMMENTS_BASE_ID if set, otherwise use the provided base ID
    const commentsBaseId = process.env.AIRTABLE_COMMENTS_BASE_ID || 'appQLwoVH8JyGSTIo';
    
    // Validate all linked record fields are arrays of strings (not objects)
    for (const [key, value] of Object.entries(recordFields)) {
      if (Array.isArray(value)) {
        for (let i = 0; i < value.length; i++) {
          const item = value[i];
          if (typeof item !== 'string') {
            console.error(`[comments/group] Invalid linked record value in field ${key}[${i}]:`, {
              value: item,
              type: typeof item,
              isObject: typeof item === 'object',
            });
            throw new Error(`Field ${key} contains non-string value: ${JSON.stringify(item)}`);
          }
          if (!item.startsWith('rec')) {
            console.warn(`[comments/group] Linked record value in ${key}[${i}] does not start with 'rec':`, item);
          }
        }
      }
    }
    
    console.log('[comments/group] Creating comment record:', {
      table: AIRTABLE_TABLES.COMMENTS,
      baseId: commentsBaseId,
      fields: Object.keys(recordFields),
      fieldValues: JSON.stringify(recordFields, null, 2),
      groupId,
      groupIdType: typeof groupId,
      hasBody: !!trimmedBody,
      bodyLength: trimmedBody.length,
      authorName: trimmedAuthorName,
      authorEmail: trimmedAuthorEmail || 'none',
    });
    
    let result;
    try {
      result = await createRecord(AIRTABLE_TABLES.COMMENTS, recordFields, commentsBaseId);
      console.log('[comments/group] createRecord returned:', {
        hasId: !!result?.id,
        hasRecords: !!result?.records,
        recordsLength: result?.records?.length || 0,
        fullResult: JSON.stringify(result, null, 2),
      });
    } catch (createErr) {
      console.error('[comments/group] createRecord threw error:', {
        error: createErr instanceof Error ? createErr.message : String(createErr),
        stack: createErr instanceof Error ? createErr.stack : undefined,
        fields: recordFields,
        baseId: commentsBaseId,
      });
      throw createErr;
    }
    
    const recordId = result?.id || result?.records?.[0]?.id;
    
    if (!recordId) {
      console.error('[comments/group] Failed to get record ID from create response:', {
        result,
        resultType: typeof result,
        resultKeys: result ? Object.keys(result) : [],
        hasId: !!result?.id,
        hasRecords: !!result?.records,
      });
      throw new Error('Failed to get record ID from create response');
    }
    
    console.log('[comments/group] Comment created successfully:', {
      recordId,
      table: AIRTABLE_TABLES.COMMENTS,
      baseId: commentsBaseId,
    });
    
    const comment: GroupComment = {
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
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error('[comments/group] POST error:', {
      message,
      stack,
      error: err,
      table: AIRTABLE_TABLES.COMMENTS,
      baseId: process.env.AIRTABLE_COMMENTS_BASE_ID || 'appQLwoVH8JyGSTIo',
    });
    return NextResponse.json({ error: `Failed to create comment: ${message}` }, { status: 500 });
  }
}
