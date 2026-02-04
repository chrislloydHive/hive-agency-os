// lib/airtable/reviewAssetStatus.ts
// Creative Review Asset Status table: per-asset state (New/Seen/Approved/Needs Changes).
// Key = Review Token + "::" + Drive File ID (unique per asset per review).

import { getBase } from '@/lib/airtable';
import { AIRTABLE_TABLES } from '@/lib/airtable/tables';

const TABLE = AIRTABLE_TABLES.CREATIVE_REVIEW_ASSET_STATUS;

/** Airtable field name for client approval checkbox. Change here if your base uses a different name. */
export const ASSET_APPROVED_CLIENT_FIELD = 'Asset Approved (Client)';

/** Airtable field name for when client first saw the asset. Do not overwrite once set. */
export const FIRST_SEEN_BY_CLIENT_AT_FIELD = 'First Seen By Client At';

export type AssetStatusValue = 'New' | 'Seen' | 'Approved' | 'Needs Changes';

export interface StatusRecord {
  recordId: string;
  status: AssetStatusValue;
  /** Client approval checkbox; used for bulk approve and to avoid re-updating. */
  assetApprovedClient: boolean;
  /** When client first saw this asset (portal load); null = never seen, show "New". */
  firstSeenByClientAt: string | null;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  approvedAt: string | null;
  approvedByName: string | null;
  approvedByEmail: string | null;
  lastActivityAt: string | null;
  notes: string | null;
  /** Per-asset override (Creative Review Asset Status: Landing Page URL Override). */
  landingPageOverrideUrl: string | null;
  /** Effective URL from Airtable formula/lookup when present. */
  effectiveLandingPageUrl: string | null;
}

function keyFrom(token: string, driveFileId: string): string {
  return `${token}::${driveFileId}`;
}

function parseStatus(raw: unknown): AssetStatusValue {
  const s = typeof raw === 'string' ? raw.trim() : '';
  if (s === 'New' || s === 'Seen' || s === 'Approved' || s === 'Needs Changes') return s;
  return 'New';
}

function parseUrl(raw: unknown): string | null {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  return raw.trim();
}

function parseAssetApprovedClient(raw: unknown): boolean {
  if (raw === true) return true;
  if (raw === 'true' || raw === 1) return true;
  return false;
}

function parseOptionalIsoString(raw: unknown): string | null {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  return raw.trim();
}

function recordToStatus(r: { id: string; fields: Record<string, unknown> }, token: string, driveFileId: string): StatusRecord {
  const f = r.fields;
  return {
    recordId: r.id,
    status: parseStatus(f['Status']),
    assetApprovedClient: parseAssetApprovedClient(f[ASSET_APPROVED_CLIENT_FIELD]),
    firstSeenByClientAt: parseOptionalIsoString(f[FIRST_SEEN_BY_CLIENT_AT_FIELD]),
    firstSeenAt: (f['First Seen At'] as string) ?? null,
    lastSeenAt: (f['Last Seen At'] as string) ?? null,
    approvedAt: (f['Approved At'] as string) ?? null,
    approvedByName: (f['Approved By Name'] as string) ?? null,
    approvedByEmail: (f['Approved By Email'] as string) ?? null,
    lastActivityAt: (f['Last Activity At'] as string) ?? null,
    notes: (f['Notes'] as string) ?? null,
    landingPageOverrideUrl: parseUrl(f['Landing Page URL Override']),
    effectiveLandingPageUrl: parseUrl(f['Effective Landing Page URL']),
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
  /** When status is Approved, use this timestamp if provided (e.g. from client to avoid server TZ skew). */
  approvedAt?: string;
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
  const approvedAt = args.status === 'Approved' && args.approvedAt ? args.approvedAt : now;
  const existing = await findExisting(args.token, args.driveFileId);

  const updates: Record<string, unknown> = {
    Status: args.status,
    'Last Activity At': now,
  };
  if (args.notes !== undefined) {
    updates['Notes'] = String(args.notes).slice(0, 5000);
  }
  if (args.status === 'Approved') {
    updates['Approved At'] = approvedAt;
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

// ============================================================================
// Bulk approve (Asset Approved (Client) = true only; Airtable automation sets the rest)
// ============================================================================

const BULK_APPROVE_CHUNK_SIZE = 10;

export interface BulkApproveRecordResult {
  toUpdate: string[];
  alreadyApproved: number;
  noRecord: number;
}

/**
 * For a list of asset file IDs (e.g. currently displayed), return Airtable record IDs
 * that need updating (not yet approved) and counts for already approved / no record.
 */
export async function getRecordIdsForBulkApprove(
  token: string,
  fileIds: string[]
): Promise<BulkApproveRecordResult> {
  const statusMap = await listAssetStatuses(token);
  const toUpdate: string[] = [];
  let alreadyApproved = 0;
  let noRecord = 0;
  for (const fileId of fileIds) {
    const key = keyFrom(token, fileId);
    const rec = statusMap.get(key);
    if (!rec) {
      noRecord += 1;
      continue;
    }
    if (rec.assetApprovedClient || rec.status === 'Approved') {
      alreadyApproved += 1;
      continue;
    }
    toUpdate.push(rec.recordId);
  }
  return { toUpdate, alreadyApproved, noRecord };
}

export interface BatchSetAssetApprovedClientResult {
  updated: number;
  failedAt: number | null;
  error?: string;
  airtableError?: unknown;
}

export interface BatchSetAssetApprovedClientOptions {
  /** Client-sent approval time (ISO) so "Approved At" reflects when the user clicked. */
  approvedAt?: string;
  approvedByName?: string;
  approvedByEmail?: string;
}

/**
 * Set Asset Approved (Client) = true on the given Airtable record IDs.
 * Optionally sets Approved At / Approved By on each record so timestamps match the user's action.
 * Updates in chunks of 10 (Airtable limit). Stops on first batch failure.
 */
export async function batchSetAssetApprovedClient(
  recordIds: string[],
  options?: BatchSetAssetApprovedClientOptions
): Promise<BatchSetAssetApprovedClientResult> {
  const osBase = getBase();
  const fields: Record<string, unknown> = { [ASSET_APPROVED_CLIENT_FIELD]: true };
  if (options?.approvedAt) {
    fields['Approved At'] = options.approvedAt;
    if (options.approvedByName !== undefined) fields['Approved By Name'] = String(options.approvedByName).slice(0, 100);
    if (options.approvedByEmail !== undefined) fields['Approved By Email'] = String(options.approvedByEmail).slice(0, 200);
  }
  let updated = 0;
  for (let i = 0; i < recordIds.length; i += BULK_APPROVE_CHUNK_SIZE) {
    const chunk = recordIds.slice(i, i + BULK_APPROVE_CHUNK_SIZE);
    try {
      await Promise.all(chunk.map((id) => osBase(TABLE).update(id, fields as any)));
      updated += chunk.length;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const airtableError = err;
      return {
        updated,
        failedAt: i,
        error: message,
        airtableError,
      };
    }
  }
  return { updated, failedAt: null };
}

export interface SetSingleAssetApprovedClientArgs {
  token: string;
  driveFileId: string;
  /** Client-sent approval time (ISO string) so "Approved At" reflects when the user clicked. */
  approvedAt?: string;
  approvedByName?: string;
  approvedByEmail?: string;
}

/**
 * Set Asset Approved (Client) = true for a single asset by token + driveFileId.
 * Optionally sets Approved At / Approved By so the timestamp reflects the user's action time.
 * Does not write Status; Airtable automation can set Needs Delivery etc.
 * Returns alreadyApproved if the checkbox was already true.
 */
export async function setSingleAssetApprovedClient(
  args: SetSingleAssetApprovedClientArgs
): Promise<
  | { ok: true }
  | { alreadyApproved: true }
  | { error: string; airtableError?: unknown }
> {
  const { token, driveFileId, approvedAt, approvedByName, approvedByEmail } = args;
  const existing = await findExisting(token, driveFileId);
  if (!existing) {
    return { error: 'Record not found' };
  }
  if (parseAssetApprovedClient(existing.fields[ASSET_APPROVED_CLIENT_FIELD])) {
    return { alreadyApproved: true };
  }
  const osBase = getBase();
  const fields: Record<string, unknown> = { [ASSET_APPROVED_CLIENT_FIELD]: true };
  if (approvedAt) {
    fields['Approved At'] = approvedAt;
    if (approvedByName !== undefined) fields['Approved By Name'] = String(approvedByName).slice(0, 100);
    if (approvedByEmail !== undefined) fields['Approved By Email'] = String(approvedByEmail).slice(0, 200);
  }
  try {
    await osBase(TABLE).update(existing.id, fields as any);
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { error: message, airtableError: err };
  }
}

// ============================================================================
// First Seen By Client At (set once on portal load for unseen assets)
// ============================================================================

const FIRST_SEEN_CHUNK_SIZE = 10;

/**
 * Return Airtable record IDs for assets that have never been seen by client
 * (First Seen By Client At is null). Used to batch-set timestamp on portal load.
 */
export async function getRecordIdsForFirstSeen(
  token: string,
  fileIds: string[]
): Promise<{ toUpdate: string[] }> {
  const statusMap = await listAssetStatuses(token);
  const toUpdate: string[] = [];
  for (const fileId of fileIds) {
    const key = keyFrom(token, fileId);
    const rec = statusMap.get(key);
    if (!rec) continue;
    if (rec.firstSeenByClientAt != null && rec.firstSeenByClientAt !== '') continue;
    toUpdate.push(rec.recordId);
  }
  return { toUpdate };
}

/**
 * Set First Seen By Client At = now on the given record IDs. Chunks of 10.
 * Only call with records that currently have null (do not overwrite).
 */
export async function batchSetFirstSeenByClientAt(
  recordIds: string[]
): Promise<{ updated: number; failedAt: number | null; error?: string }> {
  const osBase = getBase();
  const now = new Date().toISOString();
  const fields = { [FIRST_SEEN_BY_CLIENT_AT_FIELD]: now } as Record<string, unknown>;
  let updated = 0;
  for (let i = 0; i < recordIds.length; i += FIRST_SEEN_CHUNK_SIZE) {
    const chunk = recordIds.slice(i, i + FIRST_SEEN_CHUNK_SIZE);
    try {
      await Promise.all(chunk.map((id) => osBase(TABLE).update(id, fields as any)));
      updated += chunk.length;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { updated, failedAt: i, error: message };
    }
  }
  return { updated, failedAt: null };
}
