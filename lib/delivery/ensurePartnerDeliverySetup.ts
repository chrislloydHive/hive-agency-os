// lib/delivery/ensurePartnerDeliverySetup.ts
// One-time, idempotent provisioning for a project's Partner Delivery pipeline.
//
// Division of labor:
//   - This module: create one Partner Delivery Batches row per project, with
//     `Create Partner Batch = true` to trigger the Airtable automation.
//   - Airtable automation `Initialize Partner Delivery Batch`: runs a script
//     that creates the Drive folders, links assets, and sets `Status`.
//   - Human flips `Make Active` when ready to deliver; `Start Delivery`
//     automation handles the actual handoff.
//
// Safe to call from multiple ingest events at once: an in-process promise lock
// collapses concurrent calls per projectId, and `hasAnyBatchForProject` is the
// authoritative existence check before any write.

import { getBase } from '@/lib/airtable';
import { AIRTABLE_TABLES } from '@/lib/airtable/tables';

const TABLE = AIRTABLE_TABLES.PARTNER_DELIVERY_BATCHES;

const PARTNER_NAME = 'Brkthru';

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

      // 1) Skip if ANY batch row exists for this project. Use a direct count
      // query — do NOT rely on listBatchesByProjectId, which filters out rows
      // with an empty Destination Folder ID and would let us create duplicates
      // every tick when folder provisioning is failing.
      try {
        const exists = await hasAnyBatchForProject(args.projectId);
        if (exists) {
          console.log('[delivery-init] batch exists — skipping');
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
 * Direct existence check: returns true if ANY row in Partner Delivery Batches
 * is linked to the given project, regardless of whether other fields are set.
 * Bypasses the field-validation filter in listBatchesByProjectId.
 */
async function hasAnyBatchForProject(projectId: string): Promise<boolean> {
  const base = getBase();
  const escaped = projectId.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const formula = `FIND("${escaped}", ARRAYJOIN({Project})) > 0`;
  const records = await base(TABLE)
    .select({ filterByFormula: formula, maxRecords: 1, fields: [] })
    .firstPage();
  return records.length > 0;
}

interface CreateBatchArgs {
  projectId: string;
  projectName: string;
}

async function createBatchRecord(args: CreateBatchArgs): Promise<string> {
  const base = getBase();
  // Primary field is "Batch ID". Make it human-readable.
  const batchId = `${args.projectName} - ${PARTNER_NAME}`;

  // CRITICAL: Airtable's "When record matches conditions" trigger does NOT
  // fire on records that already match at creation time — only on records
  // that TRANSITION from not-matching to matching. So we must create the row
  // first with Create Partner Batch = false, then update it to true in a
  // second call. The update is the transition the Initialize Partner Delivery
  // Batch automation watches for.
  const createFields: Record<string, unknown> = {
    'Batch ID': batchId,
    Project: [args.projectId],
    'Vendor Name': PARTNER_NAME,
    'Create Partner Batch': false,
  };

  let recordId: string;
  try {
    const created = await base(TABLE).create(createFields as any);
    recordId = (created as any).id as string;
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
      const created = await base(TABLE).create(minimal as any);
      recordId = (created as any).id as string;
    } else {
      throw err;
    }
  }

  // Second write: flip Create Partner Batch to true. THIS is what fires the
  // Initialize Partner Delivery Batch automation in Airtable.
  try {
    await base(TABLE).update(recordId, {
      'Create Partner Batch': true,
    } as any);
    console.log('[delivery-init] flipped Create Partner Batch to true', { recordId });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(
      '[delivery-init] failed to flip Create Partner Batch (folders will not provision):',
      msg
    );
    // Don't throw — the row exists, you can flip the checkbox manually.
  }

  return recordId;
}
