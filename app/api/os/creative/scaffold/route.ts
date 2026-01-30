// app/api/os/creative/scaffold/route.ts
// Creative Review Hub v1 – scaffold endpoint
//
// Called from an Airtable "Run script" button. Creates the folder tree
// under the Production Assets root and copies the Creative Review Sheet
// template into the Client Review folder.
//
// Auth: ADC (Application Default Credentials) – no service account keys.
//   Local dev: gcloud auth application-default login
//   Vercel prod: Workload Identity Federation / attached SA
//
// Required env vars:
//   HIVE_OS_INTERNAL_API_KEY            – shared secret for auth
//   CREATIVE_REVIEW_SHEET_TEMPLATE_ID   – Google Sheet template file ID
//   CAR_TOYS_PRODUCTION_ASSETS_FOLDER_ID – root folder on Shared Drive
//
// Subfolders created under root: Evergreen/, Promotions/, Client Review/

import { NextResponse } from 'next/server';
import {
  ensureFolder,
  copyFile,
  findFileInFolder,
  folderUrl,
} from '@/lib/integrations/google/driveClient';

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
  // ── Env preflight ───────────────────────────────────────────────────
  const missing = checkRequiredEnv();
  if (missing.length > 0) {
    console.error('[creative/scaffold] Missing env vars:', missing);
    return NextResponse.json(
      { ok: false, error: 'Server misconfigured', missing },
      { status: 500 },
    );
  }

  // ── Auth ────────────────────────────────────────────────────────────
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

  const rootFolderId = process.env.CAR_TOYS_PRODUCTION_ASSETS_FOLDER_ID!;
  const templateId = process.env.CREATIVE_REVIEW_SHEET_TEMPLATE_ID!;

  // ── Scaffold ────────────────────────────────────────────────────────
  try {
    // 1. Ensure subfolders under root
    const folders: Record<string, { id: string; url: string }> = {};
    for (const name of SUBFOLDERS) {
      const f = await ensureFolder(rootFolderId, name);
      folders[name] = { id: f.id, url: f.url };
    }

    const clientReviewFolder = folders['Client Review'];

    // 2. Build sheet name from inputs
    const sheetName = buildSheetName(creativeMode, promoName);

    // 3. Copy template (idempotent – skip if sheet with same name exists)
    let sheetUrl: string;
    const existing = await findFileInFolder(clientReviewFolder.id, sheetName);
    if (existing) {
      console.log(`[creative/scaffold] Sheet already exists: "${sheetName}" (${existing.id})`);
      sheetUrl = existing.url;
    } else {
      const doc = await copyFile(templateId, clientReviewFolder.id, sheetName);
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
    console.error('[creative/scaffold] Error:', err?.message ?? err);

    return NextResponse.json(
      {
        ok: false,
        sheetUrl: null,
        productionAssetsRootUrl: null,
        clientReviewFolderUrl: null,
        scaffoldStatus: 'error',
        error: err?.message ?? 'Unknown error',
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

/**
 * Return list of missing env var names. Empty array = all good.
 *
 * Google auth uses ADC – no key env vars required.
 */
function checkRequiredEnv(): string[] {
  const missing: string[] = [];

  if (!process.env.HIVE_OS_INTERNAL_API_KEY) {
    missing.push('HIVE_OS_INTERNAL_API_KEY');
  }
  if (!process.env.CAR_TOYS_PRODUCTION_ASSETS_FOLDER_ID) {
    missing.push('CAR_TOYS_PRODUCTION_ASSETS_FOLDER_ID');
  }
  if (!process.env.CREATIVE_REVIEW_SHEET_TEMPLATE_ID) {
    missing.push('CREATIVE_REVIEW_SHEET_TEMPLATE_ID');
  }

  return missing;
}
