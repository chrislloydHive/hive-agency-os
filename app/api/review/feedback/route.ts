// app/api/review/feedback/route.ts
// Per-tactic approval + comments API for the Client Review Portal.
// Token-only auth. Writes to the Project record's "Client Review Data" field (JSON blob).

import { NextRequest, NextResponse } from 'next/server';
import { getBase, getCommentsBase } from '@/lib/airtable';
import { AIRTABLE_TABLES } from '@/lib/airtable/tables';
import { resolveReviewProject } from '@/lib/review/resolveProject';
import { resolveApprovedAt } from '@/lib/review/approvedAt';
import { createRecord } from '@/lib/airtable/client';

export const dynamic = 'force-dynamic';

const VALID_VARIANTS = new Set(['Prospecting', 'Retargeting']);
const VALID_TACTICS = new Set([
  'Display', 'Social', 'Video', 'Audio', 'OOH', 'PMAX', 'Geofence', 'Search',
  'General', // variant-level feedback when no assets yet
]);

// ── In-memory rate limiter ──────────────────────────────────────────────────
// Max 30 writes per token per 60-second window.
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

// ── Types ───────────────────────────────────────────────────────────────────

export interface TacticFeedback {
  approved: boolean;
  comments: string;
}

export type ReviewData = Record<string, TacticFeedback>;

// ── Helpers ─────────────────────────────────────────────────────────────────

function parseReviewData(raw: unknown): ReviewData {
  if (typeof raw === 'string' && raw.length > 0) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as ReviewData;
      }
    } catch {
      // corrupted — return empty
    }
  }
  return {};
}

// ── GET: Read current feedback ──────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  if (!token) {
    return NextResponse.json({ error: 'Missing token' }, { status: 401 });
  }

  const resolved = await resolveReviewProject(token);
  if (!resolved) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  // Read current Client Review Data from the Project record
  const osBase = getBase();
  try {
    const record = await osBase(AIRTABLE_TABLES.PROJECTS).find(resolved.project.recordId);
    const fields = record.fields as Record<string, unknown>;
    const data = parseReviewData(fields['Client Review Data']);
    return NextResponse.json({ ok: true, data });
  } catch (err: any) {
    console.error('[review/feedback] GET error:', err?.message ?? err);
    return NextResponse.json({ error: 'Failed to read feedback' }, { status: 500 });
  }
}

// ── Email validation ─────────────────────────────────────────────────────────

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ── POST: Write per-tactic feedback ─────────────────────────────────────────

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
    approved?: boolean;
    comments?: string;
    authorName?: string;
    authorEmail?: string;
    approvedAt?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { variant, tactic, approved, comments, authorName, authorEmail } = body;

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

  // Require comments to create a comment record
  if (!comments || typeof comments !== 'string' || !comments.trim()) {
    return NextResponse.json({ error: 'Comments are required to create a comment record' }, { status: 400 });
  }

  const osBase = getBase();
  const recordId = resolved.project.recordId;
  const commentsBaseId = process.env.AIRTABLE_COMMENTS_BASE_ID || 'appQLwoVH8JyGSTIo';

  // Log incoming payload
  console.log('[review/feedback] Incoming payload:', {
    variant,
    tactic,
    approved,
    comments: comments?.substring(0, 100),
    authorName,
    authorEmail,
    projectRecordId: recordId,
  });

  try {
    // Find Creative Review Sets record for this variant/tactic combination
    let groupRecordId: string | null = null;
    try {
      const setFormula = `AND(
        FIND("${recordId}", ARRAYJOIN({Project})) > 0,
        {Variant} = "${variant}",
        {Tactic} = "${tactic}"
      )`;

      const setRecords = await osBase(AIRTABLE_TABLES.CREATIVE_REVIEW_SETS)
        .select({ filterByFormula: setFormula, maxRecords: 1 })
        .firstPage();

      if (setRecords.length > 0) {
        groupRecordId = setRecords[0].id;
      }
    } catch (setErr: any) {
      console.warn('[review/feedback] Failed to find Creative Review Sets record:', setErr?.message ?? setErr);
    }

    // Build comment body - include group context if we have it
    let commentBody = comments.trim().slice(0, 5000);
    if (!groupRecordId) {
      // Include group identifiers in body prefix if we don't have a valid linked field
      commentBody = `[Group:${variant}:${tactic}] ${commentBody}`;
    }

    // Build comment record fields
    const recordFields: Record<string, unknown> = {
      Body: commentBody,
      Status: 'Open',
      'Target Type': 'Group',
      'Author Email': authorEmail.trim().slice(0, 200),
    };

    // Link to Creative Review Groups if we have a valid group record ID
    // Note: Check if Comments table has a "Creative Review Groups" linked field
    // For now, we'll try to set it, but if it fails, the comment will still be created
    if (groupRecordId) {
      recordFields['Creative Review Groups'] = [groupRecordId];
    }

    // Log final fields object before create
    console.log('[review/feedback] Creating comment with fields:', {
      baseId: commentsBaseId,
      tableName: AIRTABLE_TABLES.COMMENTS,
      fields: recordFields,
      groupRecordId: groupRecordId || 'none',
    });

    // Create comment record in Comments table
    const result = await createRecord(AIRTABLE_TABLES.COMMENTS, recordFields, commentsBaseId);
    const commentId = result?.id || result?.records?.[0]?.id;

    if (!commentId) {
      console.error('[review/feedback] Failed to get comment ID from create response:', result);
      return NextResponse.json({ error: 'Failed to create comment record' }, { status: 500 });
    }

    console.log('[review/feedback] Comment created successfully:', {
      baseId: commentsBaseId,
      tableName: AIRTABLE_TABLES.COMMENTS,
      commentId,
      groupRecordId: groupRecordId || 'none',
    });

    // On any approval toggle, update the Creative Review Sets record
    // Always overwrite: timestamp and author info are written for both approve and un-approve
    if (approved !== undefined && groupRecordId) {
      try {
        const approvedAt = resolveApprovedAt(body.approvedAt);
        const updateFields: Record<string, unknown> = {
          'Client Approved': !!approved,
          'Approved At': approvedAt,
          'Approved By Name': authorName.trim(),
          'Approved By Email': authorEmail.trim(),
        };

        await osBase(AIRTABLE_TABLES.CREATIVE_REVIEW_SETS).update(
          groupRecordId,
          updateFields as any,
        );
      } catch (setErr: any) {
        // Log but don't fail the main operation
        console.warn('[review/feedback] Creative Review Sets update failed:', setErr?.message ?? setErr);
      }
    }

    return NextResponse.json({ ok: true, commentId, groupRecordId: groupRecordId || null });
  } catch (err: any) {
    console.error('[review/feedback] POST error:', err?.message ?? err);
    return NextResponse.json({ error: 'Failed to save feedback' }, { status: 500 });
  }
}
