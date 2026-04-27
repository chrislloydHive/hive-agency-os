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
// collapses concurrent calls per projectId, and `hasAnyBatchForProject` is the
// authoritative existence check before any write.

import type { FieldSet } from 'airtable';

import { getBase, getProjectsBase } from '@/lib/airtable';
import { AIRTABLE_TABLES } from '@/lib/airtable/tables';
import {
  getDriveClient,
  ensureChildFolderWithDrive,
} from '@/lib/google/driveClient';

const TABLE = AIRTABLE_TABLES.PARTNER_DELIVERY_BATCHES;

const PARTNER_NAME = 'Brkthru';

/** Parent folder in Drive: Operations/Partners/Brkthru */
const BRKTHRU_PARENT_FOLDER_ID = '1jlxinp9VsGNMajmC-o8YLhzDVIOch7Md';

/** Per-process lock so concurrent ingestions don't race. */
const inflight = new Map<string, Promise<EnsureDeliverySetupResult>>();

export interface EnsureDeliverySetupArgs {
  projectId: string;
  projectName: string;
}

export type EnsureDeliverySetupResult =
  | { status: 'exists' }
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

      // 1) Skip if a batch row already exists for this project. Look up by
      // Batch ID (the primary field) — we set it deterministically below to
      // "{Project Name} - Brkthru". A primary-field lookup is fast and
      // reliable.
      //
      // DO NOT try to filter on the {Project} linked field — Airtable's
      // ARRAYJOIN({Project}) returns the linked records' primary-field values
      // (project names), not record IDs, so FIND("rec...", ARRAYJOIN(...))
      // never matches and you get unbounded duplicate creation.
      const expectedBatchId = `${args.projectName} - ${PARTNER_NAME}`;
      try {
        const exists = await hasBatchWithBatchId(expectedBatchId);
        if (exists) {
          console.log('[delivery-init] batch exists — skipping', {
            batchId: expectedBatchId,
          });
          return { status: 'exists' };
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(
          '[delivery-init] batch lookup failed (NOT creating to avoid duplicates):',
          msg
        );
        // Bail rather than create — better to skip a tick than spam duplicates.
        return { status: 'error', error: msg };
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
 * Merges optional fields (e.g. Destination Folder ID) in one write when provided.
 */
async function promotePartnerBatchRowToDelivering(
  projectsBase: ReturnType<typeof getProjectsBase>,
  recordId: string,
  extras: Record<string, unknown> = {},
): Promise<void> {
  const deliveringPayload = {
    ...extras,
    Status: 'Delivering',
    'Delivery Status': 'Delivering',
    'Make Active': true,
  } as Partial<FieldSet>;

  try {
    await projectsBase(TABLE).update(recordId, deliveringPayload);
    console.log('[delivery-init] PDB promoted: Status+Delivery Status=Delivering, Make Active=true', {
      recordId,
    });
    return;
  } catch (bothErr) {
    const bothMsg = bothErr instanceof Error ? bothErr.message : String(bothErr);
    try {
      await projectsBase(TABLE).update(recordId, {
        ...extras,
        Status: 'Delivering',
        'Make Active': true,
      } as Partial<FieldSet>);
      console.log('[delivery-init] PDB promoted (no Delivery Status field): Delivering + Make Active', {
        recordId,
      });
      return;
    } catch {
      try {
        await projectsBase(TABLE).update(recordId, {
          ...extras,
          Status: 'Delivering',
        } as Partial<FieldSet>);
        console.log('[delivery-init] PDB promoted: Status=Delivering only (Make Active / Delivery Status skipped)', {
          recordId,
        });
        return;
      } catch (e2) {
        console.error(
          '[delivery-init] Could not promote PDB to Delivering (CRAS auto-assign may fail until fixed manually):',
          e2 instanceof Error ? e2.message : String(e2),
          { firstError: bothMsg },
        );
      }
    }
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
