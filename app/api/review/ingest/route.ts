// app/api/review/ingest/route.ts
// POST: Creative ingestion endpoint. Accepts one or more detected Drive files
// and creates CRAS records for any whose parent folder (or any ancestor folder)
// matches a Project's "Creative Review Hub Folder ID" in Airtable.
//
// Request body (single):
//   { fileId, fileName?, folderId, parentFolderIds?, tactic?, variant? }
// Request body (batch):
//   { files: [ { ... }, ... ] }
//
// Behavior:
// - Looks up Projects with a populated Creative Review Hub Folder ID.
// - Matches each file's folderId or any ancestor in parentFolderIds against
//   that map. Subfolders at any depth are supported.
// - On match: creates a CRAS record linked to the Project (token may be empty).
// - On no match: logs `[ingest] no project mapping for folderId: X`.
// - No hardcoded folder IDs; supports multiple projects dynamically.
//
// GET (debug): pings the endpoint with a synthetic file payload so you can
// verify the route is wired up. Use ?fileId=...&folderId=... to provide values.

import { NextRequest, NextResponse } from 'next/server';
import { getDriveClient } from '@/lib/google/driveClient';
import {
  ingestFileToCras,
  ingestFilesToCras,
  type IngestFileInput,
} from '@/lib/review/ingestFileToCras';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' } as const;

function isValidFile(x: unknown): x is IngestFileInput {
  if (!x || typeof x !== 'object') return false;
  const f = x as Record<string, unknown>;
  return (
    typeof f.fileId === 'string' &&
    !!f.fileId &&
    typeof f.folderId === 'string' &&
    !!f.folderId
  );
}

async function tryIngestDriveClient() {
  try {
    return await getDriveClient({ vercelOidcToken: process.env.VERCEL_OIDC_TOKEN ?? null });
  } catch {
    return undefined;
  }
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Invalid JSON' },
      { status: 400, headers: NO_STORE }
    );
  }

  const b = body as Record<string, unknown>;
  const drive = await tryIngestDriveClient();
  const ingestOpts = drive ? { drive } : {};

  // Batch form
  if (Array.isArray(b.files)) {
    const files = b.files.filter(isValidFile);
    if (files.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'files[] is empty or missing fileId/folderId' },
        { status: 400, headers: NO_STORE }
      );
    }
    const summary = await ingestFilesToCras(files, ingestOpts);
    return NextResponse.json({ ok: true, ...summary }, { headers: NO_STORE });
  }

  // Single form
  if (isValidFile(b)) {
    const result = await ingestFileToCras(b, undefined, ingestOpts);
    return NextResponse.json({ ok: true, result }, { headers: NO_STORE });
  }

  return NextResponse.json(
    {
      ok: false,
      error: 'Body must be { fileId, folderId, ... } or { files: [...] }',
    },
    { status: 400, headers: NO_STORE }
  );
}

/**
 * Manual test helper: GET /api/review/ingest?fileId=foo&folderId=bar
 * Runs the ingestion path with the supplied (or sample) payload so you can
 * verify the route is reachable and the matching logic is wired up.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const fileId = searchParams.get('fileId') ?? 'test-file-id';
  const folderId = searchParams.get('folderId') ?? 'test-folder-id';
  const fileName = searchParams.get('fileName') ?? 'manual-test.png';

  console.log('[ingest] manual test invocation', { fileId, folderId, fileName });
  const result = await ingestFileToCras({ fileId, fileName, folderId });
  return NextResponse.json(
    {
      ok: true,
      hint: 'This is a manual test endpoint. POST { fileId, folderId } for real ingestion.',
      result,
    },
    { headers: NO_STORE }
  );
}
