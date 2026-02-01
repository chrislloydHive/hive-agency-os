// app/api/review/feedback/route.ts
// Per-tactic approval + comments API for the Client Review Portal.
// Token-only auth. Writes to the Project record's "Client Review Data" field (JSON blob).

import { NextRequest, NextResponse } from 'next/server';
import { getBase } from '@/lib/airtable';
import { AIRTABLE_TABLES } from '@/lib/airtable/tables';
import { resolveReviewProject } from '@/lib/review/resolveProject';

export const dynamic = 'force-dynamic';

const VALID_VARIANTS = new Set(['Prospecting', 'Retargeting']);
const VALID_TACTICS = new Set([
  'Display', 'Social', 'Video', 'Audio', 'OOH', 'PMAX', 'Geofence',
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

  if (approved === undefined && comments === undefined) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  }

  const osBase = getBase();
  const recordId = resolved.project.recordId;

  // Key is "Variant:Tactic" (e.g., "Prospecting:Display")
  const feedbackKey = `${variant}:${tactic}`;

  try {
    // Read-modify-write the JSON blob
    const record = await osBase(AIRTABLE_TABLES.PROJECTS).find(recordId);
    const fields = record.fields as Record<string, unknown>;
    const data = parseReviewData(fields['Client Review Data']);

    const existing = data[feedbackKey] ?? { approved: false, comments: '' };

    // Merge updates
    if (approved !== undefined) {
      existing.approved = !!approved;
    }
    if (comments !== undefined) {
      // Cap comment length to prevent abuse
      existing.comments = String(comments).slice(0, 5000);
    }

    data[feedbackKey] = existing;

    await osBase(AIRTABLE_TABLES.PROJECTS).update(recordId, {
      'Client Review Data': JSON.stringify(data),
    });

    // On any approval toggle, update the Creative Review Sets record
    // Always overwrite: timestamp and author info are written for both approve and un-approve
    if (approved !== undefined) {
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
          // Always overwrite all fields on every toggle (true or false)
          const updateFields: Record<string, unknown> = {
            'Client Approved': !!approved,
            'Approved At': new Date().toISOString(),
            'Approved By Name': authorName.trim(),
            'Approved By Email': authorEmail.trim(),
          };

          await osBase(AIRTABLE_TABLES.CREATIVE_REVIEW_SETS).update(
            setRecords[0].id,
            updateFields as any,
          );
        }
      } catch (setErr: any) {
        // Log but don't fail the main operation
        console.warn('[review/feedback] Creative Review Sets update failed:', setErr?.message ?? setErr);
      }
    }

    return NextResponse.json({ ok: true, data });
  } catch (err: any) {
    console.error('[review/feedback] POST error:', err?.message ?? err);
    return NextResponse.json({ error: 'Failed to save feedback' }, { status: 500 });
  }
}
