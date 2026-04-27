// lib/delivery/ensurePartnerDeliverySetup.ts
// One-time, idempotent provisioning for a project's Partner Delivery pipeline.
//
// Division of labor:
//   - This module: create one Partner Delivery Batches row per project, with
//     `Create Partner Batch = true` to trigger the Airtable automation.
//   - Airtable automation `Initialize Partner Delivery Batch`: runs a script
//     that creates Drive folders / links (behavior may vary by base version).
//   - **After** that handshake, this code promotes the row to **Status =
//     "Delivering"** and **Make Active = true** so Airtable’s “Auto-assign
//     assets…” script (which gates on `Status = "Delivering"`) can link newly
//     approved CRAS rows. Canonical “accepting new approvals” state is
//     **Delivering**, not **Active** (naming in some automations still says
//     “Active batch” historically).
//
// Safe to call from multiple ingest events at once: an in-process promise lock
// collapses concurrent calls per projectId. Existence is determined by
// findExistingPartnerDeliveryBatchForProject (Project + Partner link ids), not
// Batch ID text — scaffold and ingest must use the same project display name
// (see projectFolderMap "Project Name (Job #)") so Batch IDs stay aligned.
//
// PDB promotion env (optional):
// - PARTNER_PDB_STATUS_DELIVERING_VALUE — single-select label (default: Delivering)
// - PARTNER_PDB_STATUS_FIELD_NAME — if the workflow column is not literally "Status"

import type { FieldSet } from 'airtable';

import { airtableFetch } from '@/lib/airtable/airtableFetch';
import { getBase, getProjectsBase } from '@/lib/airtable';
import { resolveProjectsBaseId } from '@/lib/airtable/bases';
import { findExistingPartnerDeliveryBatchForProject } from '@/lib/airtable/partnerDeliveryBatches';
import { AIRTABLE_TABLES } from '@/lib/airtable/tables';
import {
  getDriveClient,
  ensureChildFolderWithDrive,
} from '@/lib/google/driveClient';

const TABLE = AIRTABLE_TABLES.PARTNER_DELIVERY_BATCHES;

const PARTNER_NAME = 'Brkthru';

/** Single-select option name for PDB workflow (Airtable expects the label, not sel… id). */
function partnerPdbStatusDeliveringValue(): string {
  return process.env.PARTNER_PDB_STATUS_DELIVERING_VALUE?.trim() || 'Delivering';
}

/** Primary workflow field on Partner Delivery Batches (override if your base renames it). */
function partnerPdbStatusFieldName(): string {
  return process.env.PARTNER_PDB_STATUS_FIELD_NAME?.trim() || 'Status';
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function logAirtableThrownError(PROM: string, label: string, recordId: string, e: unknown): void {
  const err = e as {
    message?: string;
    statusCode?: number;
    error?: string;
  };
  const extra =
    e && typeof e === 'object'
      ? Object.fromEntries(
          Object.getOwnPropertyNames(e).map((k) => {
            try {
              return [k, (e as Record<string, unknown>)[k]];
            } catch {
              return [k, '(unreadable)'];
            }
          }),
        )
      : {};
  console.error(`${PROM} thrown error detail`, {
    label,
    recordId,
    message: err?.message ?? String(e),
    statusCode: err?.statusCode,
    error: err?.error,
    ownKeys: e && typeof e === 'object' ? Object.getOwnPropertyNames(e) : [],
    extra,
  });
}

/** Parent folder in Drive: Operations/Partners/Brkthru */
const BRKTHRU_PARENT_FOLDER_ID = '1jlxinp9VsGNMajmC-o8YLhzDVIOch7Md';

/** Per-process lock so concurrent ingestions don't race. */
const inflight = new Map<string, Promise<EnsureDeliverySetupResult>>();

export interface EnsureDeliverySetupArgs {
  projectId: string;
  projectName: string;
}

export type EnsureDeliverySetupResult =
  | { status: 'exists'; existingBatchRecordId?: string }
  | { status: 'created'; batchRecordId: string }
  | { status: 'error'; error: string };

export async function ensurePartnerDeliverySetup(
  args: EnsureDeliverySetupArgs
): Promise<EnsureDeliverySetupResult> {
  const key = args.projectId;
  const existing = inflight.get(key);
  if (existing) return existing;

  const promise = (async (): Promise<EnsureDeliverySetupResult> => {
    try {
      console.log('[delivery-init] checking batch for project:', {
        projectName: args.projectName,
        projectId: args.projectId,
      });

      const partnerCompanyId = await getBrkthruCompanyId();
      try {
        const existing = await findExistingPartnerDeliveryBatchForProject(
          args.projectId,
          partnerCompanyId,
          { partnerNameTokenForBatchIdSuffix: PARTNER_NAME },
        );
        if (existing) {
          console.log('[delivery-init] batch already exists for project+partner — skipping create', {
            batchRecordId: existing.batchRecordId,
            batchId: existing.batchId,
            projectId: args.projectId,
          });
          return { status: 'exists', existingBatchRecordId: existing.batchRecordId };
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(
          '[delivery-init] existing-batch lookup failed (NOT creating to avoid duplicates):',
          msg,
        );
        return { status: 'error', error: msg };
      }

      const expectedBatchId = `${args.projectName} - ${PARTNER_NAME}`;
      try {
        if (await hasBatchWithBatchId(expectedBatchId)) {
          console.log('[delivery-init] batch with same Batch ID primary already exists — skipping', {
            batchId: expectedBatchId,
          });
          return { status: 'exists' };
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn('[delivery-init] Batch ID lookup failed:', msg);
      }

      console.log('[delivery-init] creating batch (Create Partner Batch=true → Airtable script will provision folders)');

      // Create the Airtable batch row. Setting `Create Partner Batch: true`
      // triggers the `Initialize Partner Delivery Batch` automation which
      // runs a script that creates Drive folders and sets Status.
      try {
        const batchRecordId = await createBatchRecord({
          projectId: args.projectId,
          projectName: args.projectName,
        });
        console.log('[delivery-init] batch created', { batchRecordId });
        return { status: 'created', batchRecordId };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[delivery-init] batch creation failed:', msg);
        return { status: 'error', error: msg };
      }
    } finally {
      // Release the lock once this run resolves so a future ingestion (e.g.
      // after a manual delete) can re-provision.
      setTimeout(() => inflight.delete(key), 0);
    }
  })();

  inflight.set(key, promise);
  return promise;
}

/**
 * Returns true if a row already exists in Partner Delivery Batches with the
 * given Batch ID. Uses the table's primary field, so the lookup is fast and
 * always works regardless of other fields' state.
 */
async function hasBatchWithBatchId(batchId: string): Promise<boolean> {
  const projectsBase = getProjectsBase();
  const escaped = batchId.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const formula = `{Batch ID} = "${escaped}"`;
  const records = await projectsBase(TABLE)
    .select({ filterByFormula: formula, maxRecords: 1 })
    .firstPage();
  return records.length > 0;
}

interface CreateBatchArgs {
  projectId: string;
  projectName: string;
}

/**
 * Cached lookup of the Brkthru company record ID. The Airtable
 * `Initialize Partner Delivery Batch` script reads the Partner linked field
 * to determine which partner the batch is for; without it the script throws
 * "Could not determine Partner". We resolve it once per process and reuse.
 */
let brkthruCompanyIdCache: string | null = null;

/**
 * Promote a freshly scaffolded PDB row to the state Airtable auto-assign expects:
 * Status (and Delivery Status when present) = Delivering, Make Active = true.
 *
 * Write order: some Airtable automations set Status to Active when Make Active
 * becomes true. We set Status and Delivery Status before Make Active, then
 * re-assert Status after Make Active and after optional Destination Folder ID.
 */
async function promotePartnerBatchRowToDelivering(
  projectsBase: ReturnType<typeof getProjectsBase>,
  recordId: string,
  extras: Record<string, unknown> = {},
): Promise<void> {
  const PROM = '[promote]';
  const delivering = partnerPdbStatusDeliveringValue();
  const statusField = partnerPdbStatusFieldName();

  const getBatch = async () => {
    const rec = await projectsBase(TABLE).find(recordId);
    const f = rec.fields as Record<string, unknown>;
    const statusRaw = f[statusField];
    const status = typeof statusRaw === 'string' ? statusRaw.trim() : String(statusRaw ?? '').trim();
    const deliveryRaw = f['Delivery Status'];
    const deliveryStatus =
      typeof deliveryRaw === 'string' ? deliveryRaw.trim() : String(deliveryRaw ?? '').trim();
    return {
      statusFieldName: statusField,
      Status: status,
      'Delivery Status': deliveryStatus,
      'Make Active': f['Make Active'] === true,
    };
  };

  const verify = async (step: string): Promise<{ ok: boolean; snapshot: Awaited<ReturnType<typeof getBatch>> }> => {
    const snapshot = await getBatch();
    const ok = snapshot.Status.toLowerCase() === delivering.toLowerCase();
    console.log(`${PROM} read-after-write`, {
      step,
      recordId,
      statusFieldName: snapshot.statusFieldName,
      Status: snapshot.Status,
      expectedStatus: delivering,
      statusWriteOk: ok,
      'Delivery Status': snapshot['Delivery Status'],
      'Make Active': snapshot['Make Active'],
    });
    if (!ok) {
      console.error(`${PROM} Status mismatch after step`, {
        step,
        got: snapshot.Status,
        expected: delivering,
        statusFieldName: statusField,
      });
    }
    return { ok, snapshot };
  };

  const patchSdk = async (
    label: string,
    body: Record<string, unknown>,
  ): Promise<{ ok: boolean }> => {
    console.log(`${PROM} PATCH body (SDK) =`, JSON.stringify(body));
    console.log(`${PROM} choice value being written (Status-related keys) =`, {
      [statusField]: body[statusField] ?? body.Status ?? '(omitted)',
      'Delivery Status': body['Delivery Status'] ?? '(omitted)',
    });
    try {
      const result = await projectsBase(TABLE).update(recordId, body as Partial<FieldSet>);
      const rf = result.fields as Record<string, unknown>;
      const stNow = rf[statusField] ?? rf.Status;
      console.log(`${PROM} Airtable SDK update result (subset) =`, {
        label,
        recordId,
        [statusField]: stNow,
        'Delivery Status': rf['Delivery Status'],
        'Make Active': rf['Make Active'],
        returnedFieldKeys: Object.keys(rf),
      });
      return { ok: true };
    } catch (e) {
      logAirtableThrownError(PROM, label, recordId, e);
      console.error(`${PROM} Airtable SDK update errors =`, {
        label,
        recordId,
        message: e instanceof Error ? e.message : String(e),
      });
      return { ok: false };
    }
  };

  /** REST PATCH: prefer typecast for single-select so Airtable coerces option names reliably. */
  const patchRest = async (
    label: string,
    fields: Record<string, unknown>,
    opts: { typecast: boolean },
  ): Promise<boolean> => {
    const baseId = resolveProjectsBaseId()?.trim();
    if (!baseId || !process.env.AIRTABLE_API_KEY) {
      console.error(`${PROM} REST PATCH skipped (no base id or AIRTABLE_API_KEY)`, { label });
      return false;
    }
    const url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(TABLE)}/${recordId}`;
    const payload = { fields, typecast: opts.typecast };
    console.log(`${PROM} REST PATCH body =`, JSON.stringify(payload));
    console.log(`${PROM} REST choice value (workflow status) =`, {
      [statusField]: fields[statusField] ?? fields.Status ?? '(omitted)',
      typecast: opts.typecast,
    });
    const res = await airtableFetch(url, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    let parsed: { fields?: Record<string, unknown>; error?: unknown } | null = null;
    try {
      parsed = JSON.parse(text) as { fields?: Record<string, unknown>; error?: unknown };
    } catch {
      parsed = null;
    }
    if (!res.ok) {
      console.error(`${PROM} REST PATCH errors =`, {
        label,
        status: res.status,
        body: text.slice(0, 1200),
        parsedError: parsed?.error ?? null,
      });
      return false;
    }
    const rf = parsed?.fields;
    console.log(`${PROM} REST PATCH result =`, {
      label,
      [statusField]: rf?.[statusField] ?? rf?.Status,
      'Delivery Status': rf?.['Delivery Status'],
      'Make Active': rf?.['Make Active'],
      rawKeys: rf ? Object.keys(rf) : [],
    });
    return true;
  };

  const patchDeliveringStatusRest = async (label: string, includeDeliveryStatus: boolean): Promise<boolean> => {
    const fields: Record<string, unknown> = {
      [statusField]: delivering,
    };
    if (includeDeliveryStatus) {
      fields['Delivery Status'] = delivering;
    }
    const ok = await patchRest(label, fields, { typecast: true });
    if (!ok && includeDeliveryStatus) {
      return patchRest(`${label}-retry-status-only`, { [statusField]: delivering }, { typecast: true });
    }
    return ok;
  };

  // ── 1) Workflow status via REST+typecast (single-select); omit Make Active here
  await patchDeliveringStatusRest('1-rest-status+delivery', true);
  let { ok: stOk } = await verify('after-1-status');

  // ── 2) Make Active — SDK only; do not send Status in this PATCH
  await patchSdk('2-make-active', { 'Make Active': true });
  ({ ok: stOk } = await verify('after-2-make-active'));

  // ── 3) Re-assert Delivering after Make Active (REST+typecast wins over automations that set Active)
  await patchDeliveringStatusRest('3-rest-status+delivery-after-make-active', true);
  ({ ok: stOk } = await verify('after-3-reassert-status'));

  // ── 4) Destination folder (typecast off — plain field ids / text)
  if (Object.keys(extras).length > 0) {
    await patchRest('4-extras-destination-folder', { ...extras }, { typecast: false });
    ({ ok: stOk } = await verify('after-4-extras'));
  }

  if (!stOk) {
    await patchDeliveringStatusRest('5-rest-final-status', true);
    ({ ok: stOk } = await verify('after-5-rest-final'));
  }

  if (!stOk) {
    await patchSdk('5b-sdk-status-only', { [statusField]: delivering } as Record<string, unknown>);
    ({ ok: stOk } = await verify('after-5b-sdk-status'));
  }

  if (!stOk) {
    await sleep(1200);
    await patchDeliveringStatusRest('6-rest-delayed-status', false);
    ({ ok: stOk } = await verify('after-6-delayed'));
  }

  if (!stOk) {
    const finalSnap = await getBatch();
    console.error(`${PROM} FATAL: Status still not Delivering after all retries`, {
      recordId,
      expectedStatus: delivering,
      statusFieldName: statusField,
      snapshot: finalSnap,
    });
  }
}

async function getBrkthruCompanyId(): Promise<string | null> {
  if (brkthruCompanyIdCache) return brkthruCompanyIdCache;

  const envId = process.env.BRKTHRU_PARTNER_COMPANY_RECORD_ID?.trim();
  if (envId) {
    brkthruCompanyIdCache = envId;
    return brkthruCompanyIdCache;
  }

  const formula = `LOWER({Company Name}) = "${PARTNER_NAME.toLowerCase()}"`;

  // Partner Delivery Batches.Partner links to Companies in the **same** base (Client PM OS).
  try {
    const projectsBase = getProjectsBase();
    const pmRecords = await projectsBase('Companies')
      .select({ filterByFormula: formula, maxRecords: 1 })
      .firstPage();
    if (pmRecords.length > 0) {
      brkthruCompanyIdCache = (pmRecords[0] as { id: string }).id;
      console.log(
        `[delivery-init] Brkthru Companies row from projects base: ${brkthruCompanyIdCache}`,
      );
      return brkthruCompanyIdCache;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(
      '[delivery-init] Companies lookup in projects base failed (missing table or 403):',
      msg,
    );
  }

  try {
    const base = getBase();
    const records = await base('Companies')
      .select({ filterByFormula: formula, maxRecords: 1 })
      .firstPage();
    if (records.length === 0) {
      console.warn(
        `[delivery-init] no Companies row found for Name="${PARTNER_NAME}" in OS base`,
      );
      return null;
    }
    brkthruCompanyIdCache = (records[0] as { id: string }).id;
    console.warn(
      `[delivery-init] Brkthru id from Hive/OS Companies (${brkthruCompanyIdCache}) — if PDB Partner link fails, set BRKTHRU_PARTNER_COMPANY_RECORD_ID to the Client PM Companies row.`,
    );
    return brkthruCompanyIdCache;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[delivery-init] Brkthru OS-base lookup failed:', msg);
    return null;
  }
}

async function createBatchRecord(args: CreateBatchArgs): Promise<string> {
  const projectsBase = getProjectsBase();
  // Primary field is "Batch ID". Make it human-readable.
  const batchId = `${args.projectName} - ${PARTNER_NAME}`;

  // Look up the Brkthru company so we can populate the Partner linked field.
  // The Initialize Partner Delivery Batch script in Airtable requires it.
  const partnerCompanyId = await getBrkthruCompanyId();

  // CRITICAL: Airtable's "When record matches conditions" trigger does NOT
  // fire on records that already match at creation time — only on records
  // that TRANSITION from not-matching to matching. So we must create the row
  // first with Create Partner Batch = false, then update it to true in a
  // second call. The update is the transition the Initialize Partner Delivery
  // Batch automation watches for.
  // Note: don't set Vendor Name — the Partner Delivery Batches table in this
  // base doesn't have that field, and including it forces a UNKNOWN_FIELD
  // retry on every create. The partner identity is encoded in the Batch ID
  // ("{Project Name} - Brkthru") which is enough.
  const createFields: Record<string, unknown> = {
    'Batch ID': batchId,
    Project: [args.projectId],
    'Create Partner Batch': false,
  };
  if (partnerCompanyId) {
    createFields.Partner = [partnerCompanyId];
  }

  let recordId: string;
  try {
    const created = await projectsBase(TABLE).create(createFields as Partial<FieldSet>);
    recordId = created.id;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (
      msg.includes('UNKNOWN_FIELD') ||
      msg.includes('unknown field') ||
      msg.includes('Cannot create field')
    ) {
      console.warn(
        '[delivery-init] retrying batch create with reduced field set:',
        msg
      );
      const minimal: Record<string, unknown> = {
        'Batch ID': batchId,
        Project: [args.projectId],
        'Create Partner Batch': false,
      };
      if (partnerCompanyId) {
        minimal.Partner = [partnerCompanyId];
      }
      const created = await projectsBase(TABLE).create(minimal as Partial<FieldSet>);
      recordId = created.id;
    } else {
      throw err;
    }
  }

  // Second write: flip Create Partner Batch to true. THIS is what fires the
  // Initialize Partner Delivery Batch automation in Airtable.
  try {
    await projectsBase(TABLE).update(recordId, {
      'Create Partner Batch': true,
    } as Partial<FieldSet>);
    console.log('[delivery-init] flipped Create Partner Batch to true', { recordId });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(
      '[delivery-init] failed to flip Create Partner Batch (folders will not provision):',
      msg
    );
    // Don't throw — the row exists, you can flip the checkbox manually.
  }

  // Provision the Drive destination folder under Brkthru parent (when possible)
  // and promote the batch to **Delivering** + **Make Active** so Airtable
  // scripts that assign approved CRAS rows to a batch can find this row.
  let destinationFolderExtras: Record<string, unknown> = {};
  try {
    const oidcToken = process.env.VERCEL_OIDC_TOKEN || undefined;
    const drive = await getDriveClient({ vercelOidcToken: oidcToken });
    const folder = await ensureChildFolderWithDrive(
      drive,
      BRKTHRU_PARENT_FOLDER_ID,
      args.projectName
    );
    destinationFolderExtras = { 'Destination Folder ID': folder.id };
    console.log('[delivery-init] provisioned destination folder', {
      recordId,
      folderId: folder.id,
      folderName: args.projectName,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(
      '[delivery-init] failed to provision destination folder (set Destination Folder ID manually):',
      msg
    );
    // Don't throw — batch row exists, folder can be created manually.
  }

  await promotePartnerBatchRowToDelivering(projectsBase, recordId, destinationFolderExtras);

  return recordId;
}
