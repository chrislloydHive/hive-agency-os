// app/api/os/pmos/tasks/[id]/route.ts
// PATCH endpoint for quick-editing PM OS task fields (status, priority, due date, owner).
//
// PATCH /api/os/pmos/tasks/:recordId
// Body: { status?, priority?, dueDate?, owner? }
//
// Writes directly to the PM OS Tasks table in Airtable via REST API.

import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// ── PM OS Airtable config ────────────────────────────────────────────────────
const PMOS_BASE_ID = 'appQLwoVH8JyGSTIo';
const PMOS_TASKS_TABLE_ID = 'tblK43BwLU7wliWYE';

// Field IDs for the Tasks table
const TF = {
  STATUS: 'flduodOMgGIyqNQjt',
  PRIORITY: 'fldctTvd20uhyx9fd',
  DUE_DATE: 'fldw21scc071u1442',
  OWNER: 'fldcWtrVnLn0wBRKe',
} as const;

// Valid select options (from Airtable schema)
const VALID_STATUSES = [
  'New', 'Not Started', 'In Progress', 'Blocked', 'Done', 'Reviewed', 'Promoted', 'Archived',
] as const;

const VALID_PRIORITIES = ['High', 'Medium', 'Low'] as const;

const VALID_OWNERS = [
  'Adam', 'Chris', 'Grace', 'Shannon', 'Andy', 'Louie', 'Jim', 'Production Partner',
] as const;

// ── Airtable helpers ────────────────────────────────────────────────────────

function airtableHeaders(): Record<string, string> {
  const token = process.env.AIRTABLE_API_KEY || process.env.AIRTABLE_PAT || '';
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

// ── Types ────────────────────────────────────────────────────────────────────

interface PatchBody {
  status?: string;
  priority?: string;
  dueDate?: string | null;
  owner?: string | null;
}

// ── Handler ──────────────────────────────────────────────────────────────────

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: recordId } = await params;

  if (!recordId || !recordId.startsWith('rec')) {
    return NextResponse.json({ error: 'Invalid record ID' }, { status: 400 });
  }

  let body: PatchBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // Build the Airtable fields object from the patch body.
  const fields: Record<string, unknown> = {};

  if (body.status !== undefined) {
    if (!VALID_STATUSES.includes(body.status as typeof VALID_STATUSES[number])) {
      return NextResponse.json(
        { error: `Invalid status: ${body.status}. Valid: ${VALID_STATUSES.join(', ')}` },
        { status: 400 },
      );
    }
    fields[TF.STATUS] = { name: body.status };
  }

  if (body.priority !== undefined) {
    if (body.priority === null) {
      fields[TF.PRIORITY] = null;
    } else if (!VALID_PRIORITIES.includes(body.priority as typeof VALID_PRIORITIES[number])) {
      return NextResponse.json(
        { error: `Invalid priority: ${body.priority}. Valid: ${VALID_PRIORITIES.join(', ')}` },
        { status: 400 },
      );
    } else {
      fields[TF.PRIORITY] = { name: body.priority };
    }
  }

  if (body.dueDate !== undefined) {
    fields[TF.DUE_DATE] = body.dueDate || null;
  }

  if (body.owner !== undefined) {
    if (body.owner === null) {
      fields[TF.OWNER] = [];
    } else if (!VALID_OWNERS.includes(body.owner as typeof VALID_OWNERS[number])) {
      return NextResponse.json(
        { error: `Invalid owner: ${body.owner}. Valid: ${VALID_OWNERS.join(', ')}` },
        { status: 400 },
      );
    } else {
      fields[TF.OWNER] = [{ name: body.owner }];
    }
  }

  if (Object.keys(fields).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  try {
    const url = `https://api.airtable.com/v0/${PMOS_BASE_ID}/${PMOS_TASKS_TABLE_ID}/${recordId}`;
    const res = await fetch(url, {
      method: 'PATCH',
      headers: airtableHeaders(),
      body: JSON.stringify({ fields }),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      throw new Error(`Airtable ${res.status}: ${errBody.slice(0, 200)}`);
    }

    const data = await res.json();
    return NextResponse.json({ ok: true, record: data });
  } catch (err) {
    console.error('[api/os/pmos/tasks/[id]] PATCH error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to update PM OS task' },
      { status: 500 },
    );
  }
}
