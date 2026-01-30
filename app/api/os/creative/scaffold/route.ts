// app/api/os/creative/scaffold/route.ts
// Creative Review Hub v1 – scaffold endpoint
//
// Called from an Airtable "Run script" button. Creates the folder tree
// under the Production Assets root and copies the Creative Review Sheet
// template into the Client Review folder.
//
// Auth: Per-company OAuth2 (refresh token stored in Airtable).
//   Same auth path used by GoogleDriveClient for Docs/Sheets/Slides.
//
// Required env vars:
//   HIVE_OS_INTERNAL_API_KEY            – shared secret for endpoint auth
//   CREATIVE_REVIEW_SHEET_TEMPLATE_ID   – Google Sheet template file ID
//   CAR_TOYS_PRODUCTION_ASSETS_FOLDER_ID – root folder on Shared Drive
//   GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET – for OAuth2 token refresh
//
// Required in request body:
//   recordId – Airtable Projects record ID (companyId derived from linked Company field)
//
// Subfolders created under root: Evergreen/, Promotions/, Client Review/

import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getCompanyOAuthClient } from '@/lib/integrations/googleDrive';
import { getProjectById } from '@/lib/airtable/projects';
import type { drive_v3 } from 'googleapis';

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
  let body: {
    recordId?: string;
    creativeMode?: string;
    promoName?: string;
  };
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

  // ── Resolve companyId from Project record ──────────────────────────
  const COMPANY_FIELD = 'Company';
  const project = await getProjectById(recordId);

  if (!project) {
    return NextResponse.json(
      { ok: false, error: `Project not found for recordId ${recordId}` },
      { status: 400 },
    );
  }

  const companyId = project.companyId;
  if (!companyId) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Project is missing linked Company/Client (Companies record ID required)',
        debug: { recordId, companyFieldNameTried: COMPANY_FIELD },
      },
      { status: 400 },
    );
  }

  console.log(`[creative/scaffold] Project ${recordId} → company ${companyId}`);

  const rootFolderId = process.env.CAR_TOYS_PRODUCTION_ASSETS_FOLDER_ID!;
  const templateId = process.env.CREATIVE_REVIEW_SHEET_TEMPLATE_ID!;

  // ── Scaffold ────────────────────────────────────────────────────────
  try {
    // Build Drive client from company OAuth tokens
    const auth = await getCompanyOAuthClient(companyId);
    const drive = google.drive({ version: 'v3', auth });

    console.log(`[creative/scaffold] Authenticated via OAuth for company ${companyId}`);

    // 1. Ensure subfolders under root
    const folders: Record<string, { id: string; url: string }> = {};
    for (const name of SUBFOLDERS) {
      const f = await ensureChildFolder(drive, rootFolderId, name);
      folders[name] = { id: f.id, url: folderUrl(f.id) };
    }

    const clientReviewFolder = folders['Client Review'];

    // 2. Build sheet name from inputs
    const sheetName = buildSheetName(creativeMode, promoName);

    // 3. Copy template (idempotent – skip if sheet with same name exists)
    let sheetUrl: string;
    const existing = await findFileInFolder(drive, clientReviewFolder.id, sheetName);
    if (existing) {
      console.log(`[creative/scaffold] Sheet already exists: "${sheetName}" (${existing.id})`);
      sheetUrl = existing.url;
    } else {
      const copied = await copyTemplate(drive, templateId, clientReviewFolder.id, sheetName);
      sheetUrl = copied.url;
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
// Drive helpers (inline, Shared-Drive-safe)
// ============================================================================

interface FileRef {
  id: string;
  name: string;
  url: string;
  mimeType: string;
}

function folderUrl(folderId: string): string {
  return `https://drive.google.com/drive/folders/${folderId}`;
}

function documentUrl(fileId: string, mimeType?: string): string {
  if (mimeType === 'application/vnd.google-apps.spreadsheet') {
    return `https://docs.google.com/spreadsheets/d/${fileId}/edit`;
  }
  if (mimeType === 'application/vnd.google-apps.document') {
    return `https://docs.google.com/document/d/${fileId}/edit`;
  }
  return `https://drive.google.com/file/d/${fileId}/view`;
}

/** Find a child folder by exact name (Shared Drive safe). */
async function findChildFolder(
  drive: drive_v3.Drive,
  parentId: string,
  name: string,
): Promise<{ id: string; name: string } | null> {
  const escaped = name.replace(/'/g, "\\'");
  const res = await drive.files.list({
    q: `'${parentId}' in parents and name = '${escaped}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: 'files(id, name)',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  const files = res.data.files ?? [];
  return files.length > 0 ? { id: files[0].id!, name: files[0].name! } : null;
}

/** Create a folder under a parent (Shared Drive safe). */
async function createFolder(
  drive: drive_v3.Drive,
  parentId: string,
  name: string,
): Promise<{ id: string; name: string }> {
  const res = await drive.files.create({
    requestBody: {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    },
    fields: 'id, name',
    supportsAllDrives: true,
  });
  console.log(`[creative/scaffold] Created folder: "${name}" (${res.data.id})`);
  return { id: res.data.id!, name: res.data.name! };
}

/** Ensure a folder exists (find-or-create, Shared Drive safe). */
async function ensureChildFolder(
  drive: drive_v3.Drive,
  parentId: string,
  name: string,
): Promise<{ id: string; name: string }> {
  const existing = await findChildFolder(drive, parentId, name);
  if (existing) {
    console.log(`[creative/scaffold] Found folder: "${name}" (${existing.id})`);
    return existing;
  }
  return createFolder(drive, parentId, name);
}

/** Find a file (non-folder) by exact name in a folder. */
async function findFileInFolder(
  drive: drive_v3.Drive,
  folderId: string,
  name: string,
): Promise<FileRef | null> {
  const escaped = name.replace(/'/g, "\\'");
  const res = await drive.files.list({
    q: `'${folderId}' in parents and name = '${escaped}' and mimeType != 'application/vnd.google-apps.folder' and trashed = false`,
    fields: 'files(id, name, mimeType)',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  const files = res.data.files ?? [];
  if (files.length === 0) return null;
  const f = files[0];
  return {
    id: f.id!,
    name: f.name!,
    mimeType: f.mimeType || '',
    url: documentUrl(f.id!, f.mimeType || undefined),
  };
}

/** Copy a template file into a destination folder (Shared Drive safe). */
async function copyTemplate(
  drive: drive_v3.Drive,
  templateId: string,
  destFolderId: string,
  newName: string,
): Promise<FileRef> {
  console.log(`[creative/scaffold] Copying template ${templateId} → "${newName}"`);
  const res = await drive.files.copy({
    fileId: templateId,
    requestBody: {
      name: newName,
      parents: [destFolderId],
    },
    fields: 'id, name, mimeType',
    supportsAllDrives: true,
  });
  const f = res.data;
  return {
    id: f.id!,
    name: f.name!,
    mimeType: f.mimeType || '',
    url: documentUrl(f.id!, f.mimeType || undefined),
  };
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
  if (!process.env.GOOGLE_CLIENT_ID) {
    missing.push('GOOGLE_CLIENT_ID');
  }
  if (!process.env.GOOGLE_CLIENT_SECRET) {
    missing.push('GOOGLE_CLIENT_SECRET');
  }

  return missing;
}
