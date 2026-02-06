// app/api/dev/migrate-source-folder-id/route.ts
// One-off migration: fix Creative Review Asset Status records where "Source Folder ID"
// is a file ID by replacing it with the file's parent folder ID.
//
// POST /api/dev/migrate-source-folder-id          – run updates
// POST /api/dev/migrate-source-folder-id?dryRun=1 – preview only (no Airtable writes)
//
// Auth: X-Migration-Secret header must match MIGRATE_SOURCE_FOLDER_SECRET (or DELIVERY_WEBHOOK_SECRET).
// Uses Vercel env and WIF (OIDC token from request). Remove or disable after running.

import { NextRequest, NextResponse } from 'next/server';
import { getBase } from '@/lib/airtable';
import { getDriveClient } from '@/lib/google/driveWif';
import { AIRTABLE_TABLES } from '@/lib/airtable/tables';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

const TABLE = AIRTABLE_TABLES.CREATIVE_REVIEW_ASSET_STATUS;
const SOURCE_FOLDER_ID_FIELD = 'Source Folder ID';
const FOLDER_MIMETYPE = 'application/vnd.google-apps.folder';

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' } as const;

export async function POST(req: NextRequest) {
  const secret = process.env.MIGRATE_SOURCE_FOLDER_SECRET || process.env.DELIVERY_WEBHOOK_SECRET;
  const headerSecret = req.headers.get('X-Migration-Secret')?.trim();

  if (!secret || headerSecret !== secret) {
    return NextResponse.json(
      { ok: false, error: 'Unauthorized. Set X-Migration-Secret to MIGRATE_SOURCE_FOLDER_SECRET or DELIVERY_WEBHOOK_SECRET.' },
      { status: 401, headers: NO_STORE }
    );
  }

  const dryRun = req.nextUrl.searchParams.get('dryRun') === '1' || req.nextUrl.searchParams.get('dryRun') === 'true';
  const oidcToken = req.headers.get('x-vercel-oidc-token')?.trim() || undefined;

  const base = getBase();
  let drive: Awaited<ReturnType<typeof getDriveClient>>;
  try {
    drive = await getDriveClient({ oidcToken: oidcToken ?? undefined });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { ok: false, error: `Drive client failed: ${msg}` },
      { status: 500, headers: NO_STORE }
    );
  }

  const records: { id: string; sourceFolderId: string }[] = [];
  const formula = `NOT({${SOURCE_FOLDER_ID_FIELD}} = "")`;

  try {
    await base(TABLE)
      .select({ filterByFormula: formula })
      .eachPage((page, next) => {
        for (const r of page) {
          const raw = (r.fields as Record<string, unknown>)[SOURCE_FOLDER_ID_FIELD];
          const sourceFolderId = typeof raw === 'string' ? raw.trim() : '';
          if (sourceFolderId) records.push({ id: r.id, sourceFolderId });
        }
        next();
      });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { ok: false, error: `Airtable select failed: ${msg}` },
      { status: 500, headers: NO_STORE }
    );
  }

  let updated = 0;
  let skipped = 0;
  const errors: string[] = [];
  const updates: { recordId: string; from: string; to: string; mimeType: string }[] = [];

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
        errors.push(`Record ${recordId}: file has no parents (mimeType=${mimeType})`);
        continue;
      }

      updates.push({ recordId, from: sourceFolderId, to: parentFolderId, mimeType });

      if (!dryRun) {
        await base(TABLE).update(recordId, { [SOURCE_FOLDER_ID_FIELD]: parentFolderId });
        updated++;
      } else {
        updated++;
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`Record ${recordId} fileId=${sourceFolderId}: ${msg}`);
    }
  }

  return NextResponse.json(
    {
      ok: true,
      dryRun,
      totalWithSourceFolderId: records.length,
      updated,
      skipped,
      errors: errors.length > 0 ? errors : undefined,
      updates: dryRun ? updates : undefined,
    },
    { headers: NO_STORE }
  );
}
