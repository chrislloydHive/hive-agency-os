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
//   (CAR_TOYS_PRODUCTION_ASSETS_FOLDER_ID no longer used by scaffold; job folder is under clientProjectsFolderId)
//   GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET – for OAuth2 token refresh
//   AIRTABLE_DB_BASE_ID                 – Hive DB base (CompanyIntegrations)
//
// Required in request body:
//   recordId – Airtable Projects record ID (companyId derived from linked Client field)
//
// Optional: clientProjectsFolderId – client's Projects folder ID. Job folder is created
//   directly under it with name = Project Name (Job #). If omitted, Car Toys Projects
//   folder is used (temporary per-client override).

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

/** Canonical variant list — Prospecting and Retargeting audiences. */
const VARIANTS = ['Prospecting', 'Retargeting'] as const;

/** Canonical tactic list — top-level folders under job folder. Order matches folder tree. */
const TACTICS = ['Audio', 'Display', 'Geofence', 'OOH', 'PMAX', 'Social', 'Video'] as const;

/** Car Toys client Projects folder ID. Used when clientProjectsFolderId is not provided (temporary). */
const CAR_TOYS_PROJECTS_FOLDER_ID = '1NLCt-piSxfAFeeINuFyzb3Pxp-kKXTw_';

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
    clientProjectsFolderId?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Invalid JSON body' },
      { status: 400 },
    );
  }

  const { recordId, creativeMode, promoName, clientProjectsFolderId: bodyClientProjectsFolderId } = body;
  const clientProjectsFolderId =
    (typeof bodyClientProjectsFolderId === 'string' && bodyClientProjectsFolderId.trim())
      ? bodyClientProjectsFolderId.trim()
      : CAR_TOYS_PROJECTS_FOLDER_ID;
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

  // Canonical hub name — used for the copied sheet name (job folder name is projectName)
  const hubName = `${projectName} – Creative Review`;

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

    const cache: FolderCache = new Map();

    // Job folder: directly under client Projects folder (no wrapper: no Creative Review root, no Creative Assets).
    // Folder name = Project Name (Job #) e.g. "229CAR Test Production".
    const jobFolder = await getOrCreateFolderCached(drive, clientProjectsFolderId, projectName, cache);

    // Tactic → variant only. No Creative Assets, no Default – Set A, no top-level Prospecting/Retargeting.
    //    Create 7 tactic folders in parallel; within each create Prospecting + Retargeting in parallel.
    const tacticFolders = await Promise.all(
      TACTICS.map((tactic) => getOrCreateFolderCached(drive, jobFolder.id, tactic, cache)),
    );
    const tacticRowsArrays = await Promise.all(
      TACTICS.map(async (tactic, i) => {
        const variantFolders = await Promise.all(
          VARIANTS.map((v) => getOrCreateFolderCached(drive, tacticFolders[i].id, v, cache)),
        );
        return VARIANTS.map((v, j) => ({
          variant: v,
          tactic,
          folderId: variantFolders[j].id,
          folderUrl: folderUrl(variantFolders[j].id),
        }));
      }),
    );
    const tacticRows: TacticRowData[] = tacticRowsArrays.flat();

    // Copy sheet template into job folder (same folder as tactic/variant tree)
    const copied = await copyTemplate(drive, templateId, jobFolder.id, hubName);
    const sheetUrl = copied.url;

    // Rename the copied sheet to hubName using Drive API
    if (copied.name !== hubName) {
      await drive.files.update({
        fileId: copied.id,
        requestBody: { name: hubName },
        supportsAllDrives: true,
      });
    }

    // 6. Populate sheet with one row per tactic
    await populateReviewSheet(sheets, copied.id, tacticRows);

    // 7. Upsert Creative Review Sets (one per variant×tactic), keyed by (Project, Variant, Tactic)
    const setsTable = AIRTABLE_TABLES.CREATIVE_REVIEW_SETS;
    const osBase = getBase();
    let setsUpserted = 0;
    for (const row of tacticRows) {
      const formula = `AND(FIND("${recordId}", ARRAYJOIN({Project})) > 0, {Variant} = "${row.variant}", {Tactic} = "${row.tactic}")`;
      const existing = await osBase(setsTable)
        .select({ filterByFormula: formula, maxRecords: 1 })
        .firstPage();
      const folderUrlValue = `https://drive.google.com/drive/folders/${row.folderId}`;
      if (existing.length > 0) {
        await osBase(setsTable).update(existing[0].id, {
          'Folder ID': row.folderId,
          'Folder URL': folderUrlValue,
        } as any);
      } else {
        await osBase(setsTable).create({
          Project: [recordId],
          Variant: row.variant,
          Tactic: row.tactic,
          'Set Name': '',
          'Folder ID': row.folderId,
          'Folder URL': folderUrlValue,
          'Client Approved': false,
          'Approved At': null,
          'Approved By Name': '',
          'Approved By Email': '',
          'Client Comments': '',
        } as any);
      }
      setsUpserted += 1;
    }
    // Log summary: folders created + records upserted
    const foldersCreatedCount = tacticRows.length; // 14 total (7 tactics × 2 variants)
    console.log(`[creative/scaffold] Summary: hubName="${hubName}", sheetId=${copied.id}, foldersCreated=${foldersCreatedCount}, recordsUpserted=${setsUpserted}`);

    // 8. Backfill: Ensure both variants exist for all tactics
    const backfillStats = await backfillMissingVariants(
      osBase,
      setsTable,
      recordId,
      jobFolder.id,
      drive,
    );
    console.log(`[creative/scaffold] Backfill: existingRows=${backfillStats.existingRows}, createdRows=${backfillStats.createdRows}, skippedDuplicates=${backfillStats.skippedDuplicates}, missingFolderCount=${backfillStats.missingFolderCount}`);

    // 9. Generate Client Review Portal token (reuse existing if present)
    const existingToken = typeof projectFields['Client Review Portal Token'] === 'string'
      ? projectFields['Client Review Portal Token'].trim()
      : '';
    const reviewToken = existingToken || randomBytes(32).toString('hex');
    const reviewPortalUrl = `${getAppBaseUrl()}/review/${reviewToken}`;

    const jobFolderUrl = folderUrl(jobFolder.id);

    // Write token, portal URL, and job folder ID/URL back to the Project record
    const projectUpdates: Record<string, string> = {
      'Creative Review Hub Folder ID': jobFolder.id,
      'Creative Review Hub Folder URL': jobFolderUrl,
    };
    if (!existingToken) {
      projectUpdates['Client Review Portal Token'] = reviewToken;
      projectUpdates['Client Review Portal URL'] = reviewPortalUrl;
    }
    await osBase(AIRTABLE_TABLES.PROJECTS).update(recordId, projectUpdates as any);

    console.log(`[creative/scaffold] recordId=${recordId}, projectName="${projectName}", hubName="${hubName}", sheetId=${copied.id}, jobFolderId=${jobFolder.id}, clientProjectsFolderId=${clientProjectsFolderId}, rowsWritten=${tacticRows.length}, reviewToken=${reviewToken}, reviewPortalUrl=${reviewPortalUrl}`);

    return NextResponse.json({
      ok: true,
      sheetUrl,
      clientReviewFolderUrl: jobFolderUrl,
      creativeReviewHubFolderId: jobFolder.id,
      creativeReviewHubFolderUrl: jobFolderUrl,
      scaffoldStatus: 'complete',
      rowCount: tacticRows.length,
      lastRunAt: new Date().toISOString(),
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
// Backfill helper: Ensure both variants exist for all tactics
// ============================================================================

interface BackfillStats {
  existingRows: number;
  createdRows: number;
  skippedDuplicates: number;
  missingFolderCount: number;
}

/**
 * Backfill missing variant rows in Creative Review Sets.
 * Keys by (Variant, Tactic) only. Folder = job folder → tactic → variant (no Default – Set A).
 */
async function backfillMissingVariants(
  osBase: ReturnType<typeof getBase>,
  setsTable: string,
  projectRecordId: string,
  jobFolderId: string,
  drive: drive_v3.Drive,
): Promise<BackfillStats> {
  const stats: BackfillStats = {
    existingRows: 0,
    createdRows: 0,
    skippedDuplicates: 0,
    missingFolderCount: 0,
  };

  const formula = `FIND("${projectRecordId}", ARRAYJOIN({Project})) > 0`;
  const existingRecords = await osBase(setsTable)
    .select({ filterByFormula: formula })
    .all();

  stats.existingRows = existingRecords.length;

  const existingKeys = new Set<string>();
  for (const record of existingRecords) {
    const fields = record.fields as Record<string, unknown>;
    const variant = fields['Variant'] as string;
    const tactic = fields['Tactic'] as string;
    if (variant && tactic) {
      existingKeys.add(`${variant}:${tactic}`);
    }
  }

  for (const tactic of TACTICS) {
    const prospectingKey = `Prospecting:${tactic}`;
    const retargetingKey = `Retargeting:${tactic}`;

    if (!existingKeys.has(retargetingKey)) {
      let folderId = '';
      let folderUrlValue = '';
      try {
        const tacticFolder = await findChildFolder(drive, jobFolderId, tactic);
        if (tacticFolder) {
          const variantFolder = await findChildFolder(drive, tacticFolder.id, 'Retargeting');
          if (variantFolder) {
            folderId = variantFolder.id;
            folderUrlValue = `https://drive.google.com/drive/folders/${variantFolder.id}`;
          }
        }
      } catch {
        // leave blank
      }
      if (!folderId) {
        stats.missingFolderCount++;
        console.warn(`[creative/scaffold] Backfill: Retargeting folder not found for tactic=${tactic}, project=${projectRecordId}`);
      }
      await osBase(setsTable).create({
        Project: [projectRecordId],
        Variant: 'Retargeting',
        Tactic: tactic,
        'Set Name': '',
        'Folder ID': folderId,
        'Folder URL': folderUrlValue,
        'Client Approved': false,
        'Approved At': null,
        'Approved By Name': '',
        'Approved By Email': '',
        'Client Comments': '',
      } as any);
      stats.createdRows++;
      existingKeys.add(retargetingKey);
    }

    if (!existingKeys.has(prospectingKey)) {
      let folderId = '';
      let folderUrlValue = '';
      try {
        const tacticFolder = await findChildFolder(drive, jobFolderId, tactic);
        if (tacticFolder) {
          const variantFolder = await findChildFolder(drive, tacticFolder.id, 'Prospecting');
          if (variantFolder) {
            folderId = variantFolder.id;
            folderUrlValue = `https://drive.google.com/drive/folders/${variantFolder.id}`;
          }
        }
      } catch {
        // leave blank
      }
      if (!folderId) {
        stats.missingFolderCount++;
        console.warn(`[creative/scaffold] Backfill: Prospecting folder not found for tactic=${tactic}, project=${projectRecordId}`);
      }
      await osBase(setsTable).create({
        Project: [projectRecordId],
        Variant: 'Prospecting',
        Tactic: tactic,
        'Set Name': '',
        'Folder ID': folderId,
        'Folder URL': folderUrlValue,
        'Client Approved': false,
        'Approved At': null,
        'Approved By Name': '',
        'Approved By Email': '',
        'Client Comments': '',
      } as any);
      stats.createdRows++;
      existingKeys.add(prospectingKey);
    }
  }

  return stats;
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

/** Cache: parentId -> (name -> folder). One list per parent, then get-or-create from cache. */
type FolderCache = Map<string, Map<string, { id: string; name: string }>>;

/** List all child folders of parent once; store in cache. Shared Drive safe. */
async function listChildrenCached(
  drive: drive_v3.Drive,
  parentId: string,
  cache: FolderCache,
): Promise<void> {
  if (cache.has(parentId)) return;
  const res = await drive.files.list({
    q: `'${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: 'files(id, name)',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  const byName = new Map<string, { id: string; name: string }>();
  for (const f of res.data.files ?? []) {
    if (f.id && f.name) byName.set(f.name, { id: f.id, name: f.name });
  }
  cache.set(parentId, byName);
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

/** Get or create folder using cache; one list per parent. Idempotent, Shared Drive safe. */
async function getOrCreateFolderCached(
  drive: drive_v3.Drive,
  parentId: string,
  name: string,
  cache: FolderCache,
): Promise<{ id: string; name: string }> {
  await listChildrenCached(drive, parentId, cache);
  const byName = cache.get(parentId)!;
  const existing = byName.get(name);
  if (existing) {
    console.log(`[creative/scaffold] Found folder: "${name}" (${existing.id})`);
    return existing;
  }
  const created = await createFolder(drive, parentId, name);
  byName.set(name, created);
  return created;
}

/** Find a child folder by exact name (Shared Drive safe). Used by backfill only. */
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
  variant: string;
  tactic: string;
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
    if ('Set Name' in colMap)                 cells[colMap['Set Name']] = '';
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
    { key: 'HIVE_OS_INTERNAL_API_KEY' },
  ];

  return required
    .filter(({ key, alt }) => !process.env[key] && !(alt && process.env[alt]))
    .map(({ key }) => key);
}
