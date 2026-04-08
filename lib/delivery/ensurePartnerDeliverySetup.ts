// lib/delivery/ensurePartnerDeliverySetup.ts
// One-time, idempotent provisioning for a project's Partner Delivery pipeline.
//
// On the first CRAS record for a project we want to be ready to deliver to the
// partner with no manual Airtable steps. This module:
//
//   1. Checks Partner Delivery Batches for an existing batch on the project.
//   2. If none exists, creates the Drive folder tree
//        Operations/Partners/Brkthru/{Project Name}/
//          ├── Display/Prospecting
//          ├── Display/Retargeting
//          ├── Video
//          └── Audio
//   3. Creates a Partner Delivery Batch record linked to the project with the
//      newly-created root folder ID.
//
// Safe to call from multiple ingest events at once: an in-process promise lock
// collapses concurrent calls per projectId so we never double-create a batch.
// Drive folder creation is also idempotent (ensureChildFolderWithDrive handles
// races and dedupes by name).

import { getBase } from '@/lib/airtable';
import { AIRTABLE_TABLES } from '@/lib/airtable/tables';
import {
  getDriveClient,
  ensureChildFolderWithDrive,
  type DriveFolder,
} from '@/lib/google/driveClient';

const TABLE = AIRTABLE_TABLES.PARTNER_DELIVERY_BATCHES;

const PARTNER_NAME = 'Brkthru';

/**
 * Drive folder under which all partner delivery roots live. Required for
 * folder provisioning; if unset we still create the Airtable batch but skip
 * folder creation (and log).
 *
 * Set this to the Drive ID of the "Operations/Partners/Brkthru" folder, or to
 * the parent that the Operations/Partners/Brkthru chain should hang from.
 */
const PARTNER_DELIVERY_ROOT_ENV = 'PARTNER_DELIVERY_ROOT_FOLDER_ID';

/** Per-process lock so concurrent ingestions don't race. */
const inflight = new Map<string, Promise<EnsureDeliverySetupResult>>();

export interface EnsureDeliverySetupArgs {
  projectId: string;
  projectName: string;
}

export type EnsureDeliverySetupResult =
  | { status: 'exists' }
  | { status: 'created'; batchRecordId: string; destinationFolderId: string | null }
  | { status: 'skipped-no-root' }
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

      console.log('[delivery-init] creating batch');

      // 2) Create the Drive folder tree.
      let destinationFolderId: string | null = null;
      try {
        destinationFolderId = await createPartnerDeliveryFolderTree(
          args.projectName
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[delivery-init] folder creation failed:', msg);
        // Continue: we still want the Airtable batch even if folders failed.
      }

      // 3) Create the Airtable batch record.
      try {
        const batchRecordId = await createBatchRecord({
          projectId: args.projectId,
          projectName: args.projectName,
          destinationFolderId,
        });
        console.log('[delivery-init] batch created', {
          batchRecordId,
          destinationFolderId,
        });
        return { status: 'created', batchRecordId, destinationFolderId };
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
 * Create (or find) the partner delivery folder tree for a project and return
 * the project root folder ID. Returns null if the partner root env var is
 * unset — caller logs and continues.
 */
export async function createPartnerDeliveryFolderTree(
  projectName: string
): Promise<string | null> {
  const partnerRootId = process.env[PARTNER_DELIVERY_ROOT_ENV]?.trim();
  if (!partnerRootId) {
    console.warn(
      `[delivery-init] ${PARTNER_DELIVERY_ROOT_ENV} not set — skipping Drive folder creation`
    );
    return null;
  }

  console.log('[delivery-init] creating drive folder', {
    parent: partnerRootId,
    partner: PARTNER_NAME,
    projectName,
  });

  const oidcToken = process.env.VERCEL_OIDC_TOKEN || undefined;
  const drive = await getDriveClient({ vercelOidcToken: oidcToken });

  // Project root: Operations/Partners/Brkthru/{Project Name}
  const projectFolder: DriveFolder = await ensureChildFolderWithDrive(
    drive,
    partnerRootId,
    projectName
  );

  // Subfolders. Display has Prospecting/Retargeting; Video and Audio are flat.
  const display = await ensureChildFolderWithDrive(drive, projectFolder.id, 'Display');
  await ensureChildFolderWithDrive(drive, display.id, 'Prospecting');
  await ensureChildFolderWithDrive(drive, display.id, 'Retargeting');
  await ensureChildFolderWithDrive(drive, projectFolder.id, 'Video');
  await ensureChildFolderWithDrive(drive, projectFolder.id, 'Audio');

  console.log('[delivery-init] folder created:', { folderId: projectFolder.id });
  return projectFolder.id;
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
  destinationFolderId: string | null;
}

async function createBatchRecord(args: CreateBatchArgs): Promise<string> {
  const base = getBase();
  // The Partner Delivery Batches table's primary field is "Batch ID", not
  // "Name". Use a human-friendly Batch ID so the row label is readable in
  // the Airtable UI without needing a separate Name field.
  const batchId = `${args.projectName} - ${PARTNER_NAME}`;

  const fullFields: Record<string, unknown> = {
    'Batch ID': batchId,
    Project: [args.projectId],
    Status: 'Active',
    'Vendor Name': PARTNER_NAME,
  };
  if (args.destinationFolderId) {
    fullFields['Destination Folder ID'] = args.destinationFolderId;
  }

  try {
    const created = await base(TABLE).create(fullFields as any);
    return (created as any).id as string;
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
      };
      if (args.destinationFolderId) {
        minimal['Destination Folder ID'] = args.destinationFolderId;
      }
      const created = await base(TABLE).create(minimal as any);
      return (created as any).id as string;
    }
    throw err;
  }
}
