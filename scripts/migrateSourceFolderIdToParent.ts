#!/usr/bin/env npx tsx
/**
 * One-time migration: fix Creative Review Asset Status records where
 * "Source Folder ID" is a file ID (e.g. image/jpeg) by replacing it with
 * the file's parent folder ID.
 *
 * Usage:
 *   npx tsx scripts/migrateSourceFolderIdToParent.ts           # run updates
 *   npx tsx scripts/migrateSourceFolderIdToParent.ts --dry-run # log only, no Airtable writes
 *
 * Requires: AIRTABLE_API_KEY (or AIRTABLE_ACCESS_TOKEN), AIRTABLE_OS_BASE_ID,
 *           and Google Drive credentials (GOOGLE_APPLICATION_CREDENTIALS_JSON or ADC).
 *
 * Creative Review Asset Status lives in the OS base, so we use AIRTABLE_OS_BASE_ID only.
 */

import Airtable from 'airtable';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const TABLE = 'Creative Review Asset Status';
const SOURCE_FOLDER_ID_FIELD = 'Source Folder ID';
const FOLDER_MIMETYPE = 'application/vnd.google-apps.folder';

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  if (dryRun) {
    console.log('[migrate] DRY RUN – no Airtable updates will be made.\n');
  }

  const apiKey = (process.env.AIRTABLE_API_KEY ?? process.env.AIRTABLE_ACCESS_TOKEN ?? '').trim();
  const baseId = (process.env.AIRTABLE_OS_BASE_ID ?? '').trim();
  if (!apiKey || !baseId) {
    console.error(
      '[migrate] Missing Airtable config. Set AIRTABLE_API_KEY (or AIRTABLE_ACCESS_TOKEN) and AIRTABLE_OS_BASE_ID in .env.local.'
    );
    process.exit(1);
  }
  console.log('[migrate] Airtable base (AIRTABLE_OS_BASE_ID):', baseId.slice(0, 6) + '…\n');

  const base = new Airtable({ apiKey }).base(baseId);
  const { getDriveClient } = await import('../lib/google/driveWif');
  const drive = await getDriveClient();

  // Fetch all records that have Source Folder ID set
  const formula = `NOT({${SOURCE_FOLDER_ID_FIELD}} = "")`;
  const records: { id: string; sourceFolderId: string }[] = [];
  await base(TABLE)
    .select({ filterByFormula: formula })
    .eachPage((page, next) => {
      for (const r of page) {
        const raw = (r.fields as Record<string, unknown>)[SOURCE_FOLDER_ID_FIELD];
        const sourceFolderId = typeof raw === 'string' ? raw.trim() : '';
        if (sourceFolderId) {
          records.push({ id: r.id, sourceFolderId });
        }
      }
      next();
    });

  console.log(`[migrate] Found ${records.length} record(s) with Source Folder ID set.\n`);

  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const { id: recordId, sourceFolderId } of records) {
    try {
      const res = await drive.files.get({
        fileId: sourceFolderId,
        fields: 'mimeType,parents',
        supportsAllDrives: true,
      });

      const mimeType = res.data.mimeType ?? '';
      const parents = res.data.parents ?? [];

      if (mimeType === FOLDER_MIMETYPE) {
        skipped++;
        continue;
      }

      const parentFolderId = parents[0];
      if (!parentFolderId) {
        console.warn(`[migrate] Record ${recordId}: file has no parents, skipping. fileId=${sourceFolderId} mimeType=${mimeType}`);
        errors++;
        continue;
      }

      if (dryRun) {
        console.log(`[migrate] Would update ${recordId}: ${sourceFolderId} (${mimeType}) → ${parentFolderId}`);
        updated++;
        continue;
      }

      await base(TABLE).update(recordId, {
        [SOURCE_FOLDER_ID_FIELD]: parentFolderId,
      });
      console.log(`[migrate] Updated ${recordId}: ${sourceFolderId} (${mimeType}) → ${parentFolderId}`);
      updated++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[migrate] Record ${recordId} fileId=${sourceFolderId}: ${msg}`);
      errors++;
    }
  }

  console.log(`\n[migrate] Done. Updated=${updated} skipped (already folder)=${skipped} errors=${errors}${dryRun ? ' (dry run)' : ''}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
