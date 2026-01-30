// app/api/os/creative/scaffold/route.ts
// Creative Review Hub v1 – scaffold endpoint
//
// Called from an Airtable "Run script" button. Creates the folder tree
// under the Production Assets root and copies the Creative Review Sheet
// template into the Client Review folder.
//
// Auth: Per-company OAuth2 (refresh token stored in Airtable Hive DB base).
//
// Airtable bases:
//   AIRTABLE_OS_BASE_ID  – Projects table (OS base)
//   AIRTABLE_DB_BASE_ID  – CompanyIntegrations table (Hive DB base)
//
// Required env vars:
//   HIVE_OS_INTERNAL_API_KEY            – shared secret for endpoint auth
//   CREATIVE_REVIEW_SHEET_TEMPLATE_ID   – Google Sheet template file ID
//   CAR_TOYS_PRODUCTION_ASSETS_FOLDER_ID – root folder on Shared Drive
//   GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET – for OAuth2 token refresh
//   AIRTABLE_DB_BASE_ID                 – Hive DB base (CompanyIntegrations)
//
// Required in request body:
//   recordId – Airtable Projects record ID (companyId derived from linked Client field)
//
// Subfolders created under root: Evergreen/, Promotions/, Client Review/

import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import Airtable from 'airtable';
import { getBase } from '@/lib/airtable';
import { AIRTABLE_TABLES } from '@/lib/airtable/tables';
import type { drive_v3 } from 'googleapis';

export const dynamic = 'force-dynamic';

// ============================================================================
// Constants
// ============================================================================

const SUBFOLDERS = ['Evergreen', 'Promotions', 'Client Review'] as const;
const COMPANY_FIELD_CANDIDATES = ['Client', 'Company'] as const;

// ============================================================================
// Airtable DB base (CompanyIntegrations lives here, not in OS base)
// ============================================================================

function getDbBase(): Airtable.Base {
  const apiKey = process.env.AIRTABLE_API_KEY || process.env.AIRTABLE_ACCESS_TOKEN || '';
  const baseId = process.env.AIRTABLE_DB_BASE_ID || '';
  if (!apiKey || !baseId) {
    throw new Error('AIRTABLE_DB_BASE_ID or AIRTABLE_API_KEY not configured');
  }
  return new Airtable({ apiKey }).base(baseId);
}

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
  const osBaseId = process.env.AIRTABLE_OS_BASE_ID || process.env.AIRTABLE_BASE_ID || '(unset)';
  const dbBaseId = process.env.AIRTABLE_DB_BASE_ID || '(unset)';

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

  // ── Resolve companyId from Project record (OS base) ────────────────
  let projectFields: Record<string, unknown>;
  try {
    const osBase = getBase(); // AIRTABLE_OS_BASE_ID
    const record = await osBase(AIRTABLE_TABLES.PROJECTS).find(recordId);
    projectFields = record.fields as Record<string, unknown>;
  } catch (err: any) {
    return NextResponse.json(
      {
        ok: false,
        error: `Project not found for recordId ${recordId}: ${err?.message ?? err}`,
        debug: { base: 'OS', baseId: osBaseId, table: AIRTABLE_TABLES.PROJECTS },
      },
      { status: 400 },
    );
  }

  let companyId: string | null = null;
  let companyFieldNameUsed: string | null = null;

  for (const fieldName of COMPANY_FIELD_CANDIDATES) {
    const v = projectFields[fieldName];
    const id = getLinkedRecordId(v);
    if (id) {
      companyId = id;
      companyFieldNameUsed = fieldName;
      break;
    }
  }

  if (!companyId) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Project is missing linked Company/Client (Companies record ID required)',
        debug: { recordId, companyFieldNamesTried: COMPANY_FIELD_CANDIDATES, base: 'OS', baseId: osBaseId },
      },
      { status: 400 },
    );
  }

  console.log(`[creative/scaffold] Project ${recordId} → company ${companyId} (via "${companyFieldNameUsed}")`);

  const rootFolderId = process.env.CAR_TOYS_PRODUCTION_ASSETS_FOLDER_ID!;
  const templateId = process.env.CREATIVE_REVIEW_SHEET_TEMPLATE_ID!;

  // ── Fetch OAuth tokens from CompanyIntegrations (DB base) ──────────
  let auth: InstanceType<typeof google.auth.OAuth2>;
  try {
    auth = await buildOAuthClient(companyId);
  } catch (oauthErr: any) {
    console.error('[creative/scaffold] OAuth lookup failed:', oauthErr?.message ?? oauthErr);

    const debug = await diagnoseOAuthLookup(companyId);
    return NextResponse.json(
      {
        ok: false,
        sheetUrl: null,
        productionAssetsRootUrl: null,
        clientReviewFolderUrl: null,
        scaffoldStatus: 'error',
        error: `Google OAuth not connected for company ${companyId}: ${oauthErr?.message ?? oauthErr}`,
        debug,
      },
      { status: 200 }, // 200 so Airtable script can read the body
    );
  }

  console.log(`[creative/scaffold] Authenticated via OAuth for company ${companyId}`);

  // ── Scaffold ────────────────────────────────────────────────────────
  try {
    const drive = google.drive({ version: 'v3', auth });

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
// OAuth from CompanyIntegrations (DB base)
// ============================================================================

/**
 * Fetch Google OAuth tokens from CompanyIntegrations in the DB base
 * and return an authenticated OAuth2 client.
 */
async function buildOAuthClient(
  companyId: string,
): Promise<InstanceType<typeof google.auth.OAuth2>> {
  const dbBase = getDbBase();

  // Find CompanyIntegrations record where CompanyId = companyId
  const records = await dbBase('CompanyIntegrations')
    .select({
      filterByFormula: `{CompanyId} = '${companyId.replace(/'/g, "\\'")}'`,
      maxRecords: 1,
    })
    .firstPage();

  if (records.length === 0) {
    throw new Error(
      `No CompanyIntegrations record found for CompanyId "${companyId}" in DB base (AIRTABLE_DB_BASE_ID).`
    );
  }

  const fields = records[0].fields as Record<string, unknown>;
  const connected = fields['GoogleConnected'] as boolean | undefined;
  const refreshToken = fields['GoogleRefreshToken'] as string | undefined;

  if (!connected || !refreshToken) {
    throw new Error(
      `Google OAuth not connected for CompanyId "${companyId}". ` +
      `GoogleConnected=${connected}, hasRefreshToken=${!!refreshToken}`
    );
  }

  const clientId = process.env.GOOGLE_CLIENT_ID!;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
  oauth2Client.setCredentials({
    refresh_token: refreshToken,
    access_token: (fields['GoogleAccessToken'] as string) || undefined,
  });

  return oauth2Client;
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

/**
 * Diagnose why OAuth lookup failed for a companyId.
 * Searches CompanyIntegrations in the DB base by companyId, name, and domain.
 * Returns counts and record IDs only (no secrets).
 */
async function diagnoseOAuthLookup(
  companyId: string,
): Promise<Record<string, unknown>> {
  const osBaseId = process.env.AIRTABLE_OS_BASE_ID || process.env.AIRTABLE_BASE_ID || '(unset)';
  const dbBaseId = process.env.AIRTABLE_DB_BASE_ID || '(unset)';

  const debug: Record<string, unknown> = {
    companyId,
    companyName: null,
    companyDomain: null,
    oauthLookupKey: 'CompanyId (exact match on CompanyIntegrations.CompanyId)',
    bases: {
      osBaseId,
      dbBaseId,
      projectFetchedFrom: `OS base (${osBaseId}) → Projects table`,
      companyIntegrationsFetchedFrom: `DB base (${dbBaseId}) → CompanyIntegrations table`,
    },
  };

  // 1. Fetch the Company record from OS base to get name + domain
  try {
    const osBase = getBase();
    const companyRecord = await osBase('Companies').find(companyId);
    const cf = companyRecord.fields as Record<string, unknown>;
    debug.companyName = (cf['Name'] as string) || (cf['Company Name'] as string) || null;
    const website = (cf['Website'] as string) || (cf['URL'] as string) || '';
    debug.companyDomain = (cf['Domain'] as string) ||
      (website
        ? (() => { try { return new URL(website.startsWith('http') ? website : `https://${website}`).hostname.replace(/^www\./, ''); } catch { return null; } })()
        : null);
  } catch {
    debug.companyName = '(failed to fetch Company record from OS base)';
  }

  // 2a. Search CompanyIntegrations by companyId in DB base
  try {
    const dbBase = getDbBase();
    const records = await dbBase('CompanyIntegrations')
      .select({
        filterByFormula: `{CompanyId} = '${companyId.replace(/'/g, "\\'")}'`,
        maxRecords: 1,
      })
      .firstPage();

    if (records.length > 0) {
      const f = records[0].fields as Record<string, unknown>;
      debug.byCompanyId = {
        found: true,
        base: 'DB',
        baseId: dbBaseId,
        recordId: records[0].id,
        googleConnected: f['GoogleConnected'] ?? false,
        hasRefreshToken: !!f['GoogleRefreshToken'],
        connectedEmail: f['GoogleConnectedEmail'] || null,
      };
    } else {
      debug.byCompanyId = { found: false, base: 'DB', baseId: dbBaseId };
    }
  } catch {
    debug.byCompanyId = { found: false, base: 'DB', baseId: dbBaseId, error: 'query failed' };
  }

  // 2b. Search by company name (if we have one)
  if (debug.companyName && typeof debug.companyName === 'string' && !debug.companyName.startsWith('(')) {
    try {
      const osBase = getBase();
      const companiesByName = await osBase('Companies')
        .select({
          filterByFormula: `{Name} = '${(debug.companyName as string).replace(/'/g, "\\'")}'`,
          maxRecords: 5,
          fields: ['Name', 'Domain'],
        })
        .firstPage();

      const matchingIds = companiesByName.map((r) => r.id).filter((id) => id !== companyId);
      const matches: Array<{ companyRecordId: string; integrationRecordId?: string; googleConnected?: boolean }> = [];

      const dbBase = getDbBase();
      for (const altId of matchingIds) {
        const altRecords = await dbBase('CompanyIntegrations')
          .select({
            filterByFormula: `{CompanyId} = '${altId.replace(/'/g, "\\'")}'`,
            maxRecords: 1,
          })
          .firstPage();
        if (altRecords.length > 0) {
          matches.push({
            companyRecordId: altId,
            integrationRecordId: altRecords[0].id,
            googleConnected: (altRecords[0].fields as any)['GoogleConnected'] ?? false,
          });
        }
      }

      debug.byCompanyName = {
        nameSearched: debug.companyName,
        companiesBase: 'OS',
        integrationsBase: 'DB',
        otherCompanyRecordsWithSameName: matchingIds.length,
        matches: matches.length > 0 ? matches : 'none',
      };
    } catch {
      debug.byCompanyName = { error: 'query failed' };
    }
  }

  // 2c. Search by domain (if we have one)
  if (debug.companyDomain && typeof debug.companyDomain === 'string') {
    try {
      const osBase = getBase();
      const companiesByDomain = await osBase('Companies')
        .select({
          filterByFormula: `{Domain} = '${(debug.companyDomain as string).replace(/'/g, "\\'")}'`,
          maxRecords: 5,
          fields: ['Name', 'Domain'],
        })
        .firstPage();

      const matchingIds = companiesByDomain.map((r) => r.id).filter((id) => id !== companyId);
      const matches: Array<{ companyRecordId: string; integrationRecordId?: string; googleConnected?: boolean }> = [];

      const dbBase = getDbBase();
      for (const altId of matchingIds) {
        const altRecords = await dbBase('CompanyIntegrations')
          .select({
            filterByFormula: `{CompanyId} = '${altId.replace(/'/g, "\\'")}'`,
            maxRecords: 1,
          })
          .firstPage();
        if (altRecords.length > 0) {
          matches.push({
            companyRecordId: altId,
            integrationRecordId: altRecords[0].id,
            googleConnected: (altRecords[0].fields as any)['GoogleConnected'] ?? false,
          });
        }
      }

      debug.byDomain = {
        domainSearched: debug.companyDomain,
        companiesBase: 'OS',
        integrationsBase: 'DB',
        otherCompanyRecordsWithSameDomain: matchingIds.length,
        matches: matches.length > 0 ? matches : 'none',
      };
    } catch {
      debug.byDomain = { error: 'query failed' };
    }
  }

  return debug;
}

/**
 * Extract a record ID from an Airtable linked-record field value.
 * Handles both [{id, name}] arrays and plain "recXXX" strings.
 */
function getLinkedRecordId(value: unknown): string | null {
  if (Array.isArray(value) && value.length > 0) {
    const first = value[0];
    if (typeof first === 'object' && first !== null && 'id' in first) {
      return (first as { id: string }).id;
    }
    if (typeof first === 'string' && first.startsWith('rec')) {
      return first;
    }
  }
  if (typeof value === 'string' && value.startsWith('rec')) {
    return value;
  }
  return null;
}

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
  if (!(process.env.AIRTABLE_API_KEY || process.env.AIRTABLE_ACCESS_TOKEN)) {
    missing.push('AIRTABLE_API_KEY');
  }
  if (!process.env.AIRTABLE_DB_BASE_ID) {
    missing.push('AIRTABLE_DB_BASE_ID');
  }

  return missing;
}
