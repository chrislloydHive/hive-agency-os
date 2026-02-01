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
//   CREATIVE_REVIEW_SHEET_TEMPLATE_ID   – Google Sheet template file ID (optional override; has hardcoded default)
//   CAR_TOYS_PRODUCTION_ASSETS_FOLDER_ID – root folder on Shared Drive
//   GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET – for OAuth2 token refresh
//   AIRTABLE_DB_BASE_ID                 – Hive DB base (CompanyIntegrations)
//
// Required in request body:
//   recordId – Airtable Projects record ID (companyId derived from linked Client field)
//
// Subfolders created under root: Evergreen/, Promotions/, Client Review/

import { randomBytes } from 'crypto';
import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getBase } from '@/lib/airtable';
import { AIRTABLE_TABLES } from '@/lib/airtable/tables';
import { getCompanyGoogleOAuthFromDBBase, findCompanyIntegration } from '@/lib/airtable/companyIntegrations';
import { getCompanyOAuthClient } from '@/lib/integrations/googleDrive';
import { getGoogleOAuthUrl, getAppBaseUrl, GOOGLE_OAUTH_SCOPE_VERSION } from '@/lib/google/oauth';
import type { drive_v3, sheets_v4 } from 'googleapis';

export const dynamic = 'force-dynamic';

// ============================================================================
// Constants
// ============================================================================

const SUBFOLDERS = ['Evergreen', 'Promotions', 'Client Review'] as const;
const COMPANY_FIELD_CANDIDATES = ['Client', 'Company'] as const;

/** Canonical tactic list — one row per tactic, each gets a "Default – Set A" folder. */
const TACTICS = ['Display', 'Social', 'Video', 'Audio', 'OOH', 'PMAX', 'Geofence'] as const;

/** Default set folder created inside each tactic folder. */
const DEFAULT_SET_NAME = 'Default – Set A';

/** Tab name preferences for the destination sheet. */
const REVIEW_TAB_NAMES = ['Client Review & Approvals', 'Creative Review', 'Review', 'Approvals'] as const;

/**
 * Expected header columns in the real template — used for dynamic column mapping.
 * Header row (row 1):
 *   Tactic | Tactic Detail | Concept | Set Name | Contents (sizes/lengths) |
 *   Format | Folder Link | Status | Client Approval | Client Comments |
 *   Version | Final File Link | Asset ID
 */
const HEADER_FIELDS = [
  'Tactic', 'Tactic Detail', 'Concept', 'Set Name',
  'Contents (sizes/lengths)', 'Format', 'Folder Link',
  'Status', 'Client Approval', 'Client Comments',
  'Version', 'Final File Link', 'Asset ID',
] as const;

/**
 * Canonical Creative Review template Sheet ID.
 * Env var CREATIVE_REVIEW_SHEET_TEMPLATE_ID overrides if set,
 * but the hardcoded default is the authoritative source of truth.
 */
const CREATIVE_REVIEW_TEMPLATE_SHEET_ID =
  process.env.CREATIVE_REVIEW_SHEET_TEMPLATE_ID ||
  '1EO3TdPG3N9zISMjdggVXTq3ZPvdpPE4kxR0fZWl5mAA';

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
      { ok: false, error: 'Server misconfigured – missing env vars', missing },
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
    // Build debug info: show all field keys and the raw values of candidate fields
    const availableFieldKeys = Object.keys(projectFields);
    const candidateFieldValues: Record<string, unknown> = {};
    for (const fieldName of COMPANY_FIELD_CANDIDATES) {
      candidateFieldValues[fieldName] = projectFields[fieldName] ?? '(not present)';
    }

    console.error(
      `[creative/scaffold] companyId resolution failed for record ${recordId}.`,
      `Available fields: ${availableFieldKeys.join(', ')}`,
      `Candidate values:`, candidateFieldValues,
    );

    return NextResponse.json(
      {
        ok: false,
        error: 'Project is missing linked Company/Client (Companies record ID required)',
        debug: {
          recordId,
          companyFieldNamesTried: COMPANY_FIELD_CANDIDATES,
          availableFieldKeys,
          candidateFieldValues,
          base: 'OS',
          baseId: osBaseId,
        },
      },
      { status: 400 },
    );
  }

  console.log(`[creative/scaffold] resolved companyId`, companyId, `from Project.${companyFieldNameUsed}`);

  // ── Resolve clientCode + companyName from Company record (OS base) ─
  let clientCode: string | undefined;
  let companyName: string | undefined;

  // Prefer Client Code from Project itself (future-proof)
  const projectClientCode = projectFields['Client Code'] ?? projectFields['ClientCode'];
  if (typeof projectClientCode === 'string' && projectClientCode.length > 0) {
    clientCode = projectClientCode;
  }

  try {
    const osBase = getBase();
    const companyRecord = await osBase('Companies').find(companyId);
    const cf = companyRecord.fields as Record<string, unknown>;
    if (!clientCode) {
      const code = cf['Client Code'] ?? cf['ClientCode'];
      if (typeof code === 'string' && code.length > 0) {
        clientCode = code;
      }
    }
    companyName = (cf['Company Name'] as string) || (cf['Name'] as string) || undefined;
  } catch (err: any) {
    console.warn(`[creative/scaffold] Could not fetch Company record ${companyId}:`, err?.message ?? err);
  }

  // Resolve project name — canonical field only (no fallbacks)
  const CANONICAL_PROJECT_NAME_FIELD = 'Project Name (Job #)';
  const rawName = projectFields[CANONICAL_PROJECT_NAME_FIELD];
  const projectName =
    typeof rawName === 'string' && rawName.trim().length > 0
      ? rawName.trim()
      : '';

  if (!projectName) {
    return NextResponse.json(
      {
        ok: false,
        sheetUrl: null,
        productionAssetsRootUrl: null,
        clientReviewFolderUrl: null,
        scaffoldStatus: 'error',
        error:
          'Project record is missing Project Name (Job #) — cannot name the Creative Review hub',
        debug: {
          recordId,
          fieldsTried: [CANONICAL_PROJECT_NAME_FIELD],
          projectNameResolvedFrom: null,
          projectNameResolvedValue: null,
        },
      },
      { status: 200 },
    );
  }

  // Canonical hub name — reused for both the Google Sheet and Creative Assets folder
  const hubName = `${projectName} – Creative Review`;

  const rootFolderId = process.env.CAR_TOYS_PRODUCTION_ASSETS_FOLDER_ID!;
  const templateId = CREATIVE_REVIEW_TEMPLATE_SHEET_ID;

  // ── Fetch OAuth tokens ─────────────────────────────────────────────
  //
  // CompanyIntegrations must contain a row with CompanyId matching the
  // OS Companies record ID, and GoogleConnected=true with a valid
  // GoogleRefreshToken. This row is created by the admin "Connect Google"
  // flow — scaffold intentionally fails if no row exists.
  //
  // 1. Try findCompanyIntegration (DB base → OS base fallback) with
  //    multi-key lookup: CompanyId → RECORD_ID() → Client Code → Company Name
  // 2. Fallback: existing per-company OAuth (getCompanyOAuthClient)
  // 3. If both fail, return structured error + full debug payload
  //
  let auth: InstanceType<typeof google.auth.OAuth2> | null = null;
  let oauthSource: string | null = null;
  let lookupDebug: unknown = null;
  let storedScopeVersion: string | null = null;

  // ── Step 1: Multi-base CompanyIntegrations lookup ───────────────────
  try {
    const oauth = await getCompanyGoogleOAuthFromDBBase(companyId, { clientCode, companyName });

    if (oauth) {
      lookupDebug = oauth.debug;
      if (oauth.googleRefreshToken) {
        const cid = process.env.GOOGLE_CLIENT_ID!;
        const csecret = process.env.GOOGLE_CLIENT_SECRET!;
        const oauth2Client = new google.auth.OAuth2(cid, csecret);
        oauth2Client.setCredentials({ refresh_token: oauth.googleRefreshToken });
        auth = oauth2Client;
        oauthSource = `CompanyIntegrations (matched by ${oauth.matchedBy})`;
        storedScopeVersion = oauth.googleOAuthScopeVersion ?? null;
        console.log(`[creative/scaffold] OAuth matched by "${oauth.matchedBy}" recordId=${oauth.recordId} scopeVersion=${storedScopeVersion}`);
      } else {
        // Record found but Google not connected
        console.warn(
          `[creative/scaffold] CompanyIntegrations found (matchedBy=${oauth.matchedBy}, recordId=${oauth.recordId}) ` +
          `but GoogleConnected=${oauth.googleConnected}, hasRefreshToken=${!!oauth.googleRefreshToken}`,
        );
      }
    } else {
      // No record found at all — run the raw lookup to capture debug
      const raw = await findCompanyIntegration({ companyId, clientCode, companyName });
      lookupDebug = raw.debug;
    }
  } catch (dbErr: any) {
    console.warn('[creative/scaffold] CompanyIntegrations lookup failed:', dbErr?.message ?? dbErr);
  }

  // ── Step 2: Fallback to existing per-company OAuth ──────────────────
  if (!oauthSource) {
    try {
      auth = await getCompanyOAuthClient(companyId);
      oauthSource = 'getCompanyOAuthClient fallback';
      console.log(`[creative/scaffold] OAuth from fallback (getCompanyOAuthClient)`);
    } catch (fallbackErr: any) {
      console.warn('[creative/scaffold] Fallback OAuth also failed:', fallbackErr?.message ?? fallbackErr);
    }
  }

  // ── Step 3: Both failed → return error with connectUrl ──────────────
  if (!auth || !oauthSource) {
    let connectUrl: string | null = null;
    try {
      connectUrl = getGoogleOAuthUrl(companyId);
    } catch {
      connectUrl = `${getAppBaseUrl()}/api/os/google/connect?companyId=${encodeURIComponent(companyId)}`;
    }

    return NextResponse.json(
      {
        ok: false,
        sheetUrl: null,
        productionAssetsRootUrl: null,
        clientReviewFolderUrl: null,
        scaffoldStatus: 'error',
        error: 'Google not connected',
        debug: {
          companyId,
          companyName: companyName ?? null,
          clientCode: clientCode ?? null,
          connectUrl,
          dbBaseId,
          osBaseId,
          lookup: 'CompanyId → RECORD_ID() → Client Code → Company Name (DB base, then OS base), then getCompanyOAuthClient',
          lookupAttempts: lookupDebug,
          suggestion: 'Open the connectUrl in a browser to authorize Google for this company.',
        },
      },
      { status: 200 }, // 200 so Airtable script can read the body
    );
  }

  console.log(`[creative/scaffold] Authenticated via ${oauthSource}`);

  // ── Stale scope check ───────────────────────────────────────────────
  // If tokens were obtained with an older scope set (e.g. drive.file
  // instead of drive), the scaffold will fail with "insufficient
  // authentication scopes". Detect this early and return a clear error.
  if (storedScopeVersion !== GOOGLE_OAUTH_SCOPE_VERSION) {
    let connectUrl: string | null = null;
    try {
      connectUrl = getGoogleOAuthUrl(companyId);
    } catch {
      connectUrl = `${getAppBaseUrl()}/api/os/google/connect?companyId=${encodeURIComponent(companyId)}`;
    }

    console.warn(
      `[creative/scaffold] Stale scope version: stored=${storedScopeVersion}, required=${GOOGLE_OAUTH_SCOPE_VERSION}`,
    );

    return NextResponse.json(
      {
        ok: false,
        sheetUrl: null,
        productionAssetsRootUrl: null,
        clientReviewFolderUrl: null,
        scaffoldStatus: 'error',
        error: 'Google OAuth scopes outdated — please reconnect Google',
        debug: {
          companyId,
          storedScopeVersion,
          requiredScopeVersion: GOOGLE_OAUTH_SCOPE_VERSION,
          connectUrl,
          suggestion: 'Open the connectUrl in a browser to re-authorize Google with updated scopes.',
        },
      },
      { status: 200 },
    );
  }

  // ── Scaffold ────────────────────────────────────────────────────────
  try {
    const drive = google.drive({ version: 'v3', auth });
    const sheets = google.sheets({ version: 'v4', auth });

    // 1. Ensure top-level subfolders under root (Evergreen, Promotions, Client Review)
    const folders: Record<string, { id: string; url: string }> = {};
    for (const name of SUBFOLDERS) {
      const f = await ensureChildFolder(drive, rootFolderId, name);
      folders[name] = { id: f.id, url: folderUrl(f.id) };
    }
    const clientReviewFolder = folders['Client Review'];

    // 2. Ensure Creative Assets/<hubName>/
    const creativeAssetsRoot = await ensureChildFolder(drive, rootFolderId, 'Creative Assets');
    const projectCreativeAssetsFolder = await ensureChildFolder(drive, creativeAssetsRoot.id, hubName);

    // 3. Create tactic folders with default set inside project folder
    //    Structure: Creative Assets/<hubName>/<Tactic>/Default – Set A/
    const tacticRows: TacticRowData[] = [];

    for (const tactic of TACTICS) {
      const tacticFolder = await ensureChildFolder(drive, projectCreativeAssetsFolder.id, tactic);
      const defaultSetFolder = await ensureChildFolder(drive, tacticFolder.id, DEFAULT_SET_NAME);
      tacticRows.push({
        tactic,
        setName: DEFAULT_SET_NAME,
        folderId: defaultSetFolder.id,
        folderUrl: folderUrl(defaultSetFolder.id),
      });
    }

    // 4. Copy sheet template into Client Review folder
    const copied = await copyTemplate(drive, templateId, clientReviewFolder.id, hubName);
    const sheetUrl = copied.url;

    // 4b. Rename the copied sheet to hubName using Drive API
    if (copied.name !== hubName) {
      await drive.files.update({
        fileId: copied.id,
        requestBody: { name: hubName },
        supportsAllDrives: true,
      });
    }

    // 5. Populate sheet with one row per tactic
    await populateReviewSheet(sheets, copied.id, tacticRows);

    // 6. Generate Client Review Portal token (reuse existing if present)
    const existingToken = typeof projectFields['Client Review Portal Token'] === 'string'
      ? projectFields['Client Review Portal Token'].trim()
      : '';
    const reviewToken = existingToken || randomBytes(32).toString('hex');
    const reviewPortalUrl = `${getAppBaseUrl()}/review/${reviewToken}`;

    // Write token + portal URL back to the Project record
    if (!existingToken) {
      const osBase = getBase();
      await osBase(AIRTABLE_TABLES.PROJECTS).update(recordId, {
        'Client Review Portal Token': reviewToken,
        'Client Review Portal URL': reviewPortalUrl,
      });
    }

    console.log(`[creative/scaffold] recordId=${recordId}, projectName="${projectName}", hubName="${hubName}", sheetId=${copied.id}, projectCreativeAssetsFolderId=${projectCreativeAssetsFolder.id}, rowsWritten=${tacticRows.length}, reviewToken=${reviewToken}, reviewPortalUrl=${reviewPortalUrl}`);

    return NextResponse.json({
      ok: true,
      sheetUrl,
      productionAssetsRootUrl: folderUrl(rootFolderId),
      clientReviewFolderUrl: clientReviewFolder.url,
      creativeAssetsFolderUrl: folderUrl(creativeAssetsRoot.id),
      scaffoldStatus: 'complete',
      rowCount: tacticRows.length,
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

  // Step 1: Copy the template (set parents hint, but Shared Drives may ignore it)
  const res = await drive.files.copy({
    fileId: templateId,
    requestBody: {
      name: newName,
      parents: [destFolderId],
    },
    fields: 'id, name, mimeType, parents',
    supportsAllDrives: true,
  });
  const f = res.data;
  const copiedId = f.id!;

  // Step 2: Ensure the copy is in the correct folder.
  // On Shared Drives the copy may land in the template's parent instead.
  const currentParents = (f.parents ?? []).join(',');
  if (!currentParents.includes(destFolderId)) {
    console.log(`[creative/scaffold] Moving copied sheet ${copiedId} into folder ${destFolderId}`);
    await drive.files.update({
      fileId: copiedId,
      addParents: destFolderId,
      removeParents: currentParents,
      supportsAllDrives: true,
    });
  }

  return {
    id: copiedId,
    name: f.name!,
    mimeType: f.mimeType || '',
    url: documentUrl(copiedId, f.mimeType || undefined),
  };
}

// ============================================================================
// Sheet population
// ============================================================================

interface TacticRowData {
  tactic: string;
  setName: string;
  folderId: string;
  folderUrl: string;
}

/**
 * Populate the Creative Review sheet with one row per tactic.
 *
 * Tab: "Client Review & Approvals"
 * Header row (row 1):
 *   Tactic | Tactic Detail | Concept | Set Name | Contents (sizes/lengths) |
 *   Format | Folder Link | Status | Client Approval | Client Comments |
 *   Version | Final File Link | Asset ID
 *
 * 1. Find the target tab by name preference.
 * 2. Read row 1 as headers, dynamically map column indexes.
 * 3. Clear existing data rows (keep header).
 * 4. Write one row per tactic starting at row 2.
 */
async function populateReviewSheet(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  rows: TacticRowData[],
): Promise<void> {
  // Get spreadsheet metadata to find the right tab
  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets.properties',
  });
  const allSheets = meta.data.sheets ?? [];

  // Find target tab by name preference
  let targetSheet: (typeof allSheets)[number] | undefined;
  for (const preferred of REVIEW_TAB_NAMES) {
    targetSheet = allSheets.find(
      (s) => s.properties?.title?.toLowerCase() === preferred.toLowerCase(),
    );
    if (targetSheet) break;
  }
  if (!targetSheet && allSheets.length > 0) {
    targetSheet = allSheets[0];
  }
  if (!targetSheet?.properties?.title) {
    console.warn('[CreativeScaffold] No tabs found in sheet — skipping population');
    return;
  }

  const tabName = targetSheet.properties.title;
  console.log(`[CreativeScaffold] Destination tab: "${tabName}", sheetId=${spreadsheetId}`);

  // Read header row (row 1)
  const headerRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${tabName}'!1:1`,
  });
  const headerRow = headerRes.data.values?.[0] ?? [];

  // Build column index map from header text (case-insensitive)
  const colMap: Record<string, number> = {};
  for (let i = 0; i < headerRow.length; i++) {
    const h = String(headerRow[i]).trim();
    for (const field of HEADER_FIELDS) {
      if (h.toLowerCase() === field.toLowerCase()) {
        colMap[field] = i;
      }
    }
  }

  console.log(`[CreativeScaffold] Header columns mapped: ${JSON.stringify(colMap)}`);

  // Determine the width (number of columns)
  const maxCol = Math.max(headerRow.length, ...Object.values(colMap).map((i) => i + 1));

  // Clear existing data rows (fixed range A2:M200 — idempotent, no crawling)
  const clearRange = `'${tabName}'!A2:M200`;
  await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range: clearRange,
  });

  // Build row data — one row per tactic
  const dataRows: (string | boolean)[][] = rows.map((row) => {
    const cells: (string | boolean)[] = new Array(maxCol).fill('');

    if ('Tactic' in colMap)                   cells[colMap['Tactic']] = row.tactic;
    if ('Tactic Detail' in colMap)            cells[colMap['Tactic Detail']] = '';
    if ('Concept' in colMap)                  cells[colMap['Concept']] = 'Default';
    if ('Set Name' in colMap)                 cells[colMap['Set Name']] = row.setName;
    if ('Contents (sizes/lengths)' in colMap) cells[colMap['Contents (sizes/lengths)']] = '';
    if ('Format' in colMap)                   cells[colMap['Format']] = 'Folder';
    if ('Folder Link' in colMap)              cells[colMap['Folder Link']] = `=HYPERLINK("${row.folderUrl}","Open Folder")`;
    if ('Status' in colMap)                   cells[colMap['Status']] = 'Needs Review';
    if ('Client Approval' in colMap)          cells[colMap['Client Approval']] = '';
    if ('Client Comments' in colMap)          cells[colMap['Client Comments']] = '';
    if ('Version' in colMap)                  cells[colMap['Version']] = 'v1';
    if ('Final File Link' in colMap)          cells[colMap['Final File Link']] = '';
    if ('Asset ID' in colMap)                 cells[colMap['Asset ID']] = '';

    return cells;
  });

  // Write rows starting at A2 using batchUpdate
  const writeRange = `'${tabName}'!A2:M${1 + dataRows.length}`;
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: 'USER_ENTERED', // needed for HYPERLINK formulas
      data: [{ range: writeRange, values: dataRows }],
    },
  });

  console.log(`[CreativeScaffold] sheetId=${spreadsheetId}, destinationTabName="${tabName}", clearedRange="${clearRange}", rowsWritten=${dataRows.length}`);
}

/** Convert 1-based column number to letter (1→A, 26→Z, 27→AA). */
function colLetter(n: number): string {
  let s = '';
  let num = n;
  while (num > 0) {
    num--;
    s = String.fromCharCode(65 + (num % 26)) + s;
    num = Math.floor(num / 26);
  }
  return s || 'A';
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Extract a record ID from an Airtable linked-record field value.
 * Handles both [{id, name}] arrays and plain "recXXX" strings.
 */
/**
 * Extract a record ID from an Airtable linked-record field value.
 * Handles all known shapes:
 *   - [{id: "rec..."}]  (Airtable REST API)
 *   - ["rec..."]         (some SDK wrappers)
 *   - "rec..."           (defensive / pre-resolved)
 *   - {id: "rec..."}     (single object, defensive)
 * Uses first element when multiple are linked.
 */
function getLinkedRecordId(value: unknown): string | null {
  if (Array.isArray(value) && value.length > 0) {
    const first = value[0];
    if (typeof first === 'string' && first.length > 0) {
      return first;
    }
    if (typeof first === 'object' && first !== null && 'id' in first) {
      return (first as { id: string }).id;
    }
  }
  if (typeof value === 'string' && value.length > 0) {
    return value;
  }
  if (typeof value === 'object' && value !== null && 'id' in value) {
    return (value as { id: string }).id;
  }
  return null;
}

/**
 * Return list of missing env var names. Empty array = all good.
 */
function checkRequiredEnv(): string[] {
  const required: Array<{ key: string; alt?: string }> = [
    { key: 'AIRTABLE_API_KEY', alt: 'AIRTABLE_ACCESS_TOKEN' },
    { key: 'AIRTABLE_OS_BASE_ID', alt: 'AIRTABLE_BASE_ID' },
    { key: 'AIRTABLE_DB_BASE_ID' },
    { key: 'CAR_TOYS_PRODUCTION_ASSETS_FOLDER_ID' },
    { key: 'HIVE_OS_INTERNAL_API_KEY' },
  ];

  return required
    .filter(({ key, alt }) => !process.env[key] && !(alt && process.env[alt]))
    .map(({ key }) => key);
}
