// app/api/review/comments/route.ts
// Per-asset comment API for the Client Review Portal.
// Writes to canonical Comments table (workflow + targeting); also to Creative Review Comments for display.
// GET reads from Creative Review Comments (filter by project + fileId) so lightbox shows comments per asset.
// Same token -> project resolution as /api/review/assets.

import { NextRequest, NextResponse } from 'next/server';
import { getBase } from '@/lib/airtable';
import { AIRTABLE_TABLES } from '@/lib/airtable/tables';
import { resolveReviewProject } from '@/lib/review/resolveProject';
import { createComment, createCreativeReviewComment } from '@/lib/airtable/comments';

export const dynamic = 'force-dynamic';

const VALID_VARIANTS = new Set(['Prospecting', 'Retargeting']);
const VALID_TACTICS = new Set([
  'Display', 'Social', 'Video', 'Audio', 'OOH', 'PMAX', 'Geofence',
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

export interface AssetComment {
  id: string;
  comment: string;
  createdAt: string;
  authorName: string;
  authorEmail?: string;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

const NO_STORE_HEADERS = { 'Cache-Control': 'no-store, max-age=0' } as const;

// GET: Fetch comments for a specific asset from Creative Review Comments (has Drive File ID for filtering)
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  const variant = req.nextUrl.searchParams.get('variant');
  const tactic = req.nextUrl.searchParams.get('tactic');
  const fileId = req.nextUrl.searchParams.get('fileId') ?? req.nextUrl.searchParams.get('driveFileId');

  if (!token) {
    return NextResponse.json({ error: 'Missing token' }, { status: 401 });
  }

  if (!variant || !VALID_VARIANTS.has(variant)) {
    return NextResponse.json({ error: 'Invalid variant' }, { status: 400 });
  }

  if (!tactic || !VALID_TACTICS.has(tactic)) {
    return NextResponse.json({ error: 'Invalid tactic' }, { status: 400 });
  }

  if (!fileId) {
    return NextResponse.json({ error: 'Missing fileId' }, { status: 400 });
  }

  const resolved = await resolveReviewProject(token);
  if (!resolved) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  const projectId = resolved.project.recordId;
  const osBase = getBase();

  try {
    const formula = `AND(
      FIND("${projectId}", ARRAYJOIN({Project})) > 0,
      {Variant} = "${variant}",
      {Tactic} = "${tactic}",
      {Drive File ID} = "${String(fileId).replace(/"/g, '\\"')}"
    )`;

    const records = await osBase(AIRTABLE_TABLES.CREATIVE_REVIEW_COMMENTS)
      .select({
        filterByFormula: formula,
        sort: [{ field: 'Created At', direction: 'asc' }],
      })
      .all();

    const comments: AssetComment[] = records.map((r) => {
      const fields = r.fields as Record<string, unknown>;
      return {
        id: r.id,
        comment: (fields['Comment'] as string) || '',
        createdAt: (fields['Created At'] as string) || new Date().toISOString(),
        authorName: (fields['Author Name'] as string) || 'Anonymous',
        authorEmail: (fields['Author Email'] as string) || undefined,
      };
    });

    return NextResponse.json({ ok: true, comments }, { headers: NO_STORE_HEADERS });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[review/comments] GET error:', message);
    return NextResponse.json({ error: 'Failed to fetch comments' }, { status: 500 });
  }
}

// POST: Create comment in Comments (canonical); always also create in Creative Review Comments for display. On Comments failure, fall back to Creative Review Comments only.
export async function POST(req: NextRequest) {
  const tokenFromQuery = req.nextUrl.searchParams.get('token');

  let body: {
    token?: string;
    body?: string;
    comment?: string;
    authorName?: string;
    authorEmail?: string;
    tactic?: string;
    variantGroup?: string;
    concept?: string;
    driveFileId?: string;
    fileId?: string;
    filename?: string;
    fileName?: string;
    variant?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const token = tokenFromQuery ?? body.token;

  if (!token) {
    return NextResponse.json({ error: 'Missing token' }, { status: 401 });
  }

  if (isRateLimited(token)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const resolved = await resolveReviewProject(token);
  if (!resolved) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  const commentText = (body.body ?? body.comment ?? '') as string;
  const authorName = (body.authorName ?? '') as string;
  const authorEmail = (body.authorEmail ?? '') as string;
  const tactic = (body.tactic ?? '') as string;
  const variantGroup = (body.variantGroup ?? body.variant ?? '') as string;
  const concept = (body.concept ?? '') as string;
  const driveFileId = (body.driveFileId ?? body.fileId ?? '') as string;
  const filename = (body.filename ?? body.fileName ?? '') as string;

  if (!authorName || typeof authorName !== 'string' || !authorName.trim()) {
    return NextResponse.json({ error: 'Author name is required' }, { status: 400 });
  }

  if (!authorEmail || typeof authorEmail !== 'string' || !isValidEmail(authorEmail.trim())) {
    return NextResponse.json({ error: 'Valid author email is required' }, { status: 400 });
  }

  if (!tactic || !VALID_TACTICS.has(tactic)) {
    return NextResponse.json({ error: 'Invalid tactic' }, { status: 400 });
  }

  if (!driveFileId) {
    return NextResponse.json({ error: 'Missing driveFileId or fileId' }, { status: 400 });
  }

  if (!commentText || typeof commentText !== 'string' || commentText.trim().length === 0) {
    return NextResponse.json({ error: 'Comment body is required' }, { status: 400 });
  }

  const payload = {
    projectId: resolved.project.recordId,
    body: commentText.trim(),
    authorName: authorName.trim(),
    authorEmail: authorEmail.trim(),
    tactic,
    variantGroup: variantGroup.trim() || undefined,
    concept: concept.trim() || undefined,
    driveFileId,
    filename: filename.trim(),
  };

  let commentId: string;
  let createdAt: string;
  let usedCommentsTable = false;

  try {
    const result = await createComment(payload);
    commentId = result.id;
    createdAt = result.createdAt;
    usedCommentsTable = true;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn('[review/comments] Comments table create failed, using Creative Review Comments:', message);
    const result = await createCreativeReviewComment(payload);
    commentId = result.id;
    createdAt = result.createdAt;
  }

  // Always create in Creative Review Comments so GET (lightbox) can show comments by fileId
  if (usedCommentsTable) {
    try {
      await createCreativeReviewComment(payload);
    } catch (crcErr: unknown) {
      console.warn('[review/comments] Creative Review Comments create failed:', crcErr instanceof Error ? crcErr.message : crcErr);
    }
  }

  const newComment: AssetComment = {
    id: commentId,
    comment: commentText.trim(),
    createdAt,
    authorName: authorName.trim(),
    authorEmail: authorEmail.trim(),
  };

  return NextResponse.json(
    {
      ok: true,
      commentId,
      createdAt,
      storedIn: usedCommentsTable ? 'Comments + Creative Review Comments' : 'Creative Review Comments',
      comment: newComment,
    },
    { headers: NO_STORE_HEADERS },
  );
}
