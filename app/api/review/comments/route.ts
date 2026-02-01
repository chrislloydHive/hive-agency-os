// app/api/review/comments/route.ts
// Per-asset comment API for the Client Review Portal.
// Token-only auth. Comments stored in Creative Review Comments table.

import { NextRequest, NextResponse } from 'next/server';
import { getBase } from '@/lib/airtable';
import { AIRTABLE_TABLES } from '@/lib/airtable/tables';
import { resolveReviewProject } from '@/lib/review/resolveProject';

export const dynamic = 'force-dynamic';

const VALID_VARIANTS = new Set(['Prospecting', 'Retargeting']);
const VALID_TACTICS = new Set([
  'Display', 'Social', 'Video', 'Audio', 'OOH', 'PMAX', 'Geofence',
]);

// Rate limiting
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

// GET: Fetch comments for a specific asset
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  const variant = req.nextUrl.searchParams.get('variant');
  const tactic = req.nextUrl.searchParams.get('tactic');
  const fileId = req.nextUrl.searchParams.get('fileId');

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

  const osBase = getBase();
  const projectId = resolved.project.recordId;

  try {
    // Query comments for this specific asset
    const formula = `AND(
      FIND("${projectId}", ARRAYJOIN({Project})) > 0,
      {Variant} = "${variant}",
      {Tactic} = "${tactic}",
      {File ID} = "${fileId}"
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

    return NextResponse.json({ ok: true, comments });
  } catch (err: any) {
    console.error('[review/comments] GET error:', err?.message ?? err);
    return NextResponse.json({ error: 'Failed to fetch comments' }, { status: 500 });
  }
}

// POST: Add a new comment for an asset
export async function POST(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');

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

  let body: {
    variant?: string;
    tactic?: string;
    fileId?: string;
    fileName?: string;
    comment?: string;
    authorName?: string;
    authorEmail?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { variant, tactic, fileId, fileName, comment, authorName, authorEmail } = body;

  // Require author identity
  if (!authorName || typeof authorName !== 'string' || !authorName.trim()) {
    return NextResponse.json({ error: 'Author name is required' }, { status: 400 });
  }

  if (!authorEmail || typeof authorEmail !== 'string' || !isValidEmail(authorEmail.trim())) {
    return NextResponse.json({ error: 'Valid author email is required' }, { status: 400 });
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

  if (!comment || typeof comment !== 'string' || comment.trim().length === 0) {
    return NextResponse.json({ error: 'Comment is required' }, { status: 400 });
  }

  const osBase = getBase();
  const projectId = resolved.project.recordId;

  try {
    const record = await osBase(AIRTABLE_TABLES.CREATIVE_REVIEW_COMMENTS).create({
      Project: [projectId],
      Variant: variant,
      Tactic: tactic,
      'File ID': fileId,
      Filename: fileName?.trim().slice(0, 500) || '',
      Comment: comment.trim().slice(0, 5000), // Cap length
      'Author Name': authorName.trim().slice(0, 100),
      'Author Email': authorEmail.trim().slice(0, 200),
      'Created At': new Date().toISOString(),
    } as any);

    const newComment: AssetComment = {
      id: record.id,
      comment: comment.trim(),
      createdAt: new Date().toISOString(),
      authorName: authorName.trim(),
      authorEmail: authorEmail.trim(),
    };

    return NextResponse.json({ ok: true, comment: newComment });
  } catch (err: any) {
    console.error('[review/comments] POST error:', err?.message ?? err);
    return NextResponse.json({ error: 'Failed to save comment' }, { status: 500 });
  }
}
