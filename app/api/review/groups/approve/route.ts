// app/api/review/groups/approve/route.ts
// POST: Record as-of group approval (tactic::variant). Updates Approved At each time.

import { NextRequest, NextResponse } from 'next/server';
import { resolveReviewProject } from '@/lib/review/resolveProject';
import { upsertGroupApproval } from '@/lib/airtable/reviewGroupApprovals';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' } as const;

const VALID_TACTICS = new Set([
  'Audio', 'Display', 'Geofence', 'OOH', 'PMAX', 'Social', 'Video', 'Search',
]);
const VALID_VARIANTS = new Set(['Prospecting', 'Retargeting']);

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(req: NextRequest) {
  let body: {
    token?: string;
    tactic?: string;
    variant?: string;
    approvedByName?: string;
    approvedByEmail?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const token = (body.token ?? '').toString().trim();
  const tactic = (body.tactic ?? '').toString().trim();
  const variant = (body.variant ?? '').toString().trim();
  const approvedByName = (body.approvedByName ?? '').toString().trim();
  const approvedByEmail = (body.approvedByEmail ?? '').toString().trim();

  if (!token) {
    return NextResponse.json({ error: 'Missing token' }, { status: 400 });
  }
  if (!tactic || !VALID_TACTICS.has(tactic)) {
    return NextResponse.json({ error: 'Invalid tactic' }, { status: 400 });
  }
  if (!variant || !VALID_VARIANTS.has(variant)) {
    return NextResponse.json({ error: 'Invalid variant' }, { status: 400 });
  }
  if (!approvedByName) {
    return NextResponse.json({ error: 'approvedByName is required' }, { status: 400 });
  }
  if (!approvedByEmail || !isValidEmail(approvedByEmail)) {
    return NextResponse.json({ error: 'Valid approvedByEmail is required' }, { status: 400 });
  }

  const resolved = await resolveReviewProject(token);
  if (!resolved) {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 404 });
  }

  const now = new Date().toISOString();
  try {
    await upsertGroupApproval({
      token,
      tactic,
      variant,
      approvedAt: now,
      approvedByName,
      approvedByEmail,
    });
    return NextResponse.json(
      { ok: true, approvedAt: now },
      { headers: NO_STORE }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[review/groups/approve] Error:', message);
    return NextResponse.json({ error: 'Failed to save group approval' }, { status: 500, headers: NO_STORE });
  }
}
