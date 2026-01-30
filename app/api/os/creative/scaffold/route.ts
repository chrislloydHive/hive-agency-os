// app/api/os/creative/scaffold/route.ts
// Creative Review Hub v1 – scaffold endpoint
//
// Called from an Airtable "Run script" button. Creates the folder tree
// under the Production Assets root and copies the Creative Review Sheet
// template into the Client Review folder.
//
// Required env vars:
//   HIVE_OS_INTERNAL_API_KEY          – shared secret for auth
//   GOOGLE_SERVICE_ACCOUNT_JSON       – (or EMAIL + PRIVATE_KEY)
//   CREATIVE_REVIEW_TEMPLATE_ID       – Google Sheet template file ID
//   CAR_TOYS_PRODUCTION_ASSETS_FOLDER_ID – root folder on Shared Drive
//
// Subfolders created under root: Evergreen/, Promotions/, Client Review/

import { NextResponse } from 'next/server';
import {
  getDriveClient,
  ensureChildFolder,
  copyDocTemplate,
  findDocumentInFolder,
  folderUrl,
} from '@/lib/google/driveClient';

export const dynamic = 'force-dynamic';

// ============================================================================
// Constants
// ============================================================================

const SUBFOLDERS = ['Evergreen', 'Promotions', 'Client Review'] as const;

// ============================================================================
// Auth
// ============================================================================

const API_KEY = process.env.HIVE_OS_INTERNAL_API_KEY || '';

function unauthorized(reason: string) {
  return NextResponse.json(
    { ok: false, error: reason },
    { status: 401 },
  );
}

// ============================================================================
// Route Handler
// ============================================================================

export async function POST(req: Request) {
  // ── Auth ────────────────────────────────────────────────────────────
  if (!API_KEY) {
    console.error('[creative/scaffold] HIVE_OS_INTERNAL_API_KEY is not set');
    return NextResponse.json(
      { ok: false, error: 'Server misconfigured' },
      { status: 500 },
    );
  }

  const providedKey = req.headers.get('x-hive-api-key') || '';
  if (!providedKey || providedKey !== API_KEY) {
    return unauthorized('Missing or invalid x-hive-api-key');
  }

  // ── Parse body ──────────────────────────────────────────────────────
  let body: { recordId?: string; creativeMode?: string; promoName?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Invalid JSON body' },
      { status: 400 },
    );
  }

  const { recordId, creativeMode, promoName } = body;
  if (!recordId) {
    return NextResponse.json(
      { ok: false, error: 'recordId is required' },
      { status: 400 },
    );
  }

  // ── Env ─────────────────────────────────────────────────────────────
  const rootFolderId = process.env.CAR_TOYS_PRODUCTION_ASSETS_FOLDER_ID;
  const templateId = process.env.CREATIVE_REVIEW_TEMPLATE_ID;

  if (!rootFolderId || !templateId) {
    console.error(
      '[creative/scaffold] Missing env: CAR_TOYS_PRODUCTION_ASSETS_FOLDER_ID or CREATIVE_REVIEW_TEMPLATE_ID',
    );
    return NextResponse.json(
      { ok: false, error: 'Server misconfigured – missing folder/template env vars' },
      { status: 500 },
    );
  }

  // ── Scaffold ────────────────────────────────────────────────────────
  try {
    getDriveClient(); // warm up / fail fast on bad creds

    // 1. Ensure subfolders under root
    const folders: Record<string, { id: string; url: string }> = {};
    for (const name of SUBFOLDERS) {
      const f = await ensureChildFolder(rootFolderId, name);
      folders[name] = { id: f.id, url: f.url };
    }

    const clientReviewFolder = folders['Client Review'];

    // 2. Build sheet name from inputs
    const sheetName = buildSheetName(creativeMode, promoName);

    // 3. Copy template (idempotent – skip if sheet with same name exists)
    let sheetUrl: string;
    const existing = await findDocumentInFolder(clientReviewFolder.id, sheetName);
    if (existing) {
      console.log(`[creative/scaffold] Sheet already exists: "${sheetName}" (${existing.id})`);
      sheetUrl = existing.url;
    } else {
      const doc = await copyDocTemplate(templateId, clientReviewFolder.id, sheetName);
      sheetUrl = doc.url;
    }

    console.log(`[creative/scaffold] Done for record ${recordId}`);

    return NextResponse.json({
      ok: true,
      sheetUrl,
      productionAssetsRootUrl: folderUrl(rootFolderId),
      clientReviewFolderUrl: clientReviewFolder.url,
      scaffoldStatus: 'complete',
    });
  } catch (err: any) {
    const code = err?.code ?? err?.status;
    console.error('[creative/scaffold] Error:', err?.message ?? err);

    let message = err?.message ?? 'Unknown error';
    if (code === 403) {
      message =
        'Service account lacks access. Share the Shared Drive / folder with the SA as Content Manager.';
    } else if (code === 404) {
      message =
        'Root folder or template not found (404). Check CAR_TOYS_PRODUCTION_ASSETS_FOLDER_ID and CREATIVE_REVIEW_TEMPLATE_ID.';
    }

    return NextResponse.json(
      {
        ok: false,
        sheetUrl: null,
        productionAssetsRootUrl: null,
        clientReviewFolderUrl: null,
        scaffoldStatus: 'error',
        error: message,
      },
      { status: 200 }, // 200 so Airtable script can read the body
    );
  }
}

// ============================================================================
// Helpers
// ============================================================================

function buildSheetName(
  creativeMode?: string,
  promoName?: string,
): string {
  const parts: string[] = ['Creative Review'];
  if (creativeMode) parts.push(creativeMode);
  if (promoName) parts.push(promoName);
  return parts.join(' – ');
}
