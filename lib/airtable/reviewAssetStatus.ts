// lib/airtable/reviewAssetStatus.ts
// Creative Review Asset Status table: per-asset state (New/Seen/Approved/Needs Changes).
// Key = Review Token + "::" + Drive File ID (unique per asset per review).

import { getBase } from '@/lib/airtable';
import { AIRTABLE_TABLES } from '@/lib/airtable/tables';

const TABLE = AIRTABLE_TABLES.CREATIVE_REVIEW_ASSET_STATUS;

export type AssetStatusValue = 'New' | 'Seen' | 'Approved' | 'Needs Changes';

export interface StatusRecord {
  recordId: string;
  status: AssetStatusValue;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  approvedAt: string | null;
  approvedByName: string | null;
  approvedByEmail: string | null;
  lastActivityAt: string | null;
  notes: string | null;
}

function keyFrom(token: string, driveFileId: string): string {
  return `${token}::${driveFileId}`;
}

function parseStatus(raw: unknown): AssetStatusValue {
  const s = typeof raw === 'string' ? raw.trim() : '';
  if (s === 'New' || s === 'Seen' || s === 'Approved' || s === 'Needs Changes') return s;
  return 'New';
}

function recordToStatus(r: { id: string; fields: Record<string, unknown> }, token: string, driveFileId: string): StatusRecord {
  const f = r.fields;
  return {
    recordId: r.id,
    status: parseStatus(f['Status']),
    firstSeenAt: (f['First Seen At'] as string) ?? null,
    lastSeenAt: (f['Last Seen At'] as string) ?? null,
    approvedAt: (f['Approved At'] as string) ?? null,
    approvedByName: (f['Approved By Name'] as string) ?? null,
    approvedByEmail: (f['Approved By Email'] as string) ?? null,
    lastActivityAt: (f['Last Activity At'] as string) ?? null,
    notes: (f['Notes'] as string) ?? null,
  };
}

/**
 * List all asset statuses for a review token. Returns Map keyed by token::driveFileId.
 */
export async function listAssetStatuses(token: string): Promise<Map<string, StatusRecord>> {
  const osBase = getBase();
  const escaped = String(token).replace(/\\/g, '\\\\').replace(/"/g, '\\"').trim();
  if (!escaped) return new Map();

  const formula = `{Review Token} = "${escaped}"`;
  const records = await osBase(TABLE)
    .select({ filterByFormula: formula })
    .all();

  const map = new Map<string, StatusRecord>();
  for (const r of records) {
    const fields = r.fields as Record<string, unknown>;
    const driveFileId = (fields['Drive File ID'] as string) ?? '';
    if (driveFileId) {
      const key = keyFrom(token, driveFileId);
      map.set(key, recordToStatus(r as { id: string; fields: Record<string, unknown> }, token, driveFileId));
    }
  }
  return map;
}

/**
 * Find existing record by Review Token + Drive File ID.
 */
async function findExisting(token: string, driveFileId: string): Promise<{ id: string; fields: Record<string, unknown> } | null> {
  const osBase = getBase();
  const tokenEsc = String(token).replace(/\\/g, '\\\\').replace(/"/g, '\\"').trim();
  const fileEsc = String(driveFileId).replace(/\\/g, '\\\\').replace(/"/g, '\\"').trim();
  const formula = `AND({Review Token} = "${tokenEsc}", {Drive File ID} = "${fileEsc}")`;
  const records = await osBase(TABLE)
    .select({ filterByFormula: formula, maxRecords: 1 })
    .firstPage();
  if (records.length === 0) return null;
  return { id: records[0].id, fields: records[0].fields as Record<string, unknown> };
}

export interface UpsertSeenArgs {
  token: string;
  projectId: string;
  driveFileId: string;
  filename: string;
  tactic: string;
  variant: string;
  authorName?: string;
  authorEmail?: string;
}

/**
 * Mark asset as seen. Creates record with Status=Seen if new; otherwise updates Status (New→Seen) and timestamps.
 */
export async function upsertSeen(args: UpsertSeenArgs): Promise<void> {
  const osBase = getBase();
  const now = new Date().toISOString();
  const existing = await findExisting(args.token, args.driveFileId);

  if (!existing) {
    await osBase(TABLE).create({
      'Review Token': args.token,
      Project: [args.projectId],
      'Drive File ID': args.driveFileId,
      Filename: (args.filename ?? '').slice(0, 500),
      Tactic: args.tactic,
      Variant: args.variant,
      Status: 'Seen',
      'First Seen At': now,
      'Last Seen At': now,
      'Last Activity At': now,
    } as any);
    return;
  }

  const currentStatus = parseStatus(existing.fields['Status']);
  const updates: Record<string, unknown> = {
    'Last Seen At': now,
    'Last Activity At': now,
    Filename: (args.filename ?? '').slice(0, 500),
  };
  if (currentStatus === 'New') {
    updates['Status'] = 'Seen';
  }
  await osBase(TABLE).update(existing.id, updates as any);
}

export interface UpsertStatusArgs {
  token: string;
  projectId: string;
  driveFileId: string;
  status: AssetStatusValue;
  approvedByName?: string;
  approvedByEmail?: string;
  notes?: string;
}

/**
 * Set asset status (Approved / Needs Changes). Creates record if missing; otherwise updates.
 */
export async function upsertStatus(args: UpsertStatusArgs): Promise<void> {
  const osBase = getBase();
  const now = new Date().toISOString();
  const existing = await findExisting(args.token, args.driveFileId);

  const updates: Record<string, unknown> = {
    Status: args.status,
    'Last Activity At': now,
  };
  if (args.notes !== undefined) {
    updates['Notes'] = String(args.notes).slice(0, 5000);
  }
  if (args.status === 'Approved') {
    updates['Approved At'] = now;
    if (args.approvedByName !== undefined) updates['Approved By Name'] = args.approvedByName.slice(0, 100);
    if (args.approvedByEmail !== undefined) updates['Approved By Email'] = args.approvedByEmail.slice(0, 200);
  }

  if (!existing) {
    await osBase(TABLE).create({
      'Review Token': args.token,
      Project: [args.projectId],
      'Drive File ID': args.driveFileId,
      Filename: '',
      Tactic: '',
      Variant: '',
      ...updates,
    } as any);
    return;
  }

  await osBase(TABLE).update(existing.id, updates as any);
}
