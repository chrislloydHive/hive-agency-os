// Airtable Automation / Button "Run script" — Creative Review Scaffold
//
// Paste this into an Airtable "Run script" action attached to a Button
// field or an Automation trigger.
//
// Input variables (configure in the Airtable script settings panel):
//   airtableProjectRecordId – input.config().airtableProjectRecordId (canonical Projects record ID)
//   recordId                 – input.config().recordId (legacy, accepted for backward compatibility)
//
// Airtable field names expected on the record (Projects table):
//   "Creative Mode"                 – single-line text (e.g. "Evergreen", "Promo")
//   "Promo Name"                    – single-line text (optional)
//   "Creative Scaffold Status"     – single-select (only set to "complete" on success; never set on error to avoid missing-option failure)
//   "Creative Scaffold Error"      – long text (written on failure, cleared on success)
//   "Creative Scaffold Connect URL" – URL (connectUrl from API or null; use real null, not string "null")
//   "Creative Scaffold Last Run"    – Date/DateTime (always set to ISO 8601 when we have a response)
//   "Creative Review Sheet URL"     – URL (written on success)
//   "Production Assets Root Folder" – URL (written on success)
//   "Client Review Folder URL"      – URL (written on success)
//
// Note: companyId is resolved server-side from the Project's linked Company field.
//
// Environment:
//   HIVE_OS_BASE_URL         – e.g. https://your-app.vercel.app
//   HIVE_OS_INTERNAL_API_KEY – shared secret

// ─── Field names ───────────────────────────────────────────────────────
const FIELDS = { mode: 'Creative Mode', promoName: 'Promo Name' };

// ─── Field mapping (Airtable field ID → name + type) ──────────────────
// Ensures correct value shape for each field type
const FIELD_MAP = {
  'fld8kvbELvf3p9618': {
    name: 'Creative Scaffold Last Run',
    type: 'dateTime',
    toValue: (v) => (typeof v === 'string' ? v : null), // ISO 8601 string for DateTime
  },
};

// ─── Config ──────────────────────────────────────────────────────────
const inputConfig = input.config();
// Canonical: airtableProjectRecordId; legacy: recordId, recId
const recordId = (inputConfig.airtableProjectRecordId ?? inputConfig.recordId ?? inputConfig.recId ?? '').trim();

if (!recordId || typeof recordId !== 'string' || !recordId.trim().startsWith('rec')) {
    output.text('Missing or invalid record ID. Set input variable airtableProjectRecordId to the current Projects record ID (recordId is also accepted for backward compatibility).');
    throw new Error('Missing or invalid airtableProjectRecordId (or recordId)');
}

const BASE_URL = 'YOUR_HIVE_OS_BASE_URL';          // ← replace
const API_KEY  = 'YOUR_HIVE_OS_INTERNAL_API_KEY';   // ← replace

// Client Projects folder ID: job folder is created directly under this. Per-client override.
const CLIENT_PROJECTS_FOLDER_ID = '1NLCt-piSxfAFeeINuFyzb3Pxp-kKXTw_'; // Car Toys

const ENDPOINT = `${BASE_URL}/api/os/creative/scaffold`;

// ─── Read record fields ──────────────────────────────────────────────
const table = base.getTable('Projects');  // ← adjust table name if different
let record = await table.selectRecordAsync(recordId, {
  fields: [FIELDS.mode, FIELDS.promoName, 'Project Name (Job #)', 'Client Code'],
});

if (!record) {
  const projectName = (inputConfig.projectName || inputConfig.projectNameJob || inputConfig['Project Name (Job #)'] || '').toString().trim();
  const clientCode = (inputConfig.clientCode || inputConfig['Client Code'] || '').toString().trim();

  console.log('[CreativeScaffold] recordId not found; fallback lookup', { recordId, projectName, clientCode });

  if (!projectName) {
    throw new Error(
      `Project record not found for id=${recordId}. Also missing projectName for fallback. This usually means a recordId from the other base was passed.`
    );
  }

  const query = await table.selectRecordsAsync({
    fields: ['Project Name (Job #)', 'Client Code', FIELDS.mode, FIELDS.promoName],
  });

  const matches = query.records.filter((r) => {
    const pn = (r.getCellValueAsString('Project Name (Job #)') || '').trim();
    const cc = (r.getCellValueAsString('Client Code') || '').trim();
    if (clientCode) return pn === projectName && cc === clientCode;
    return pn === projectName;
  });

  if (matches.length === 0) {
    throw new Error(
      `No Projects record matched Project Name (Job #)="${projectName}"` +
        (clientCode ? ` and Client Code="${clientCode}"` : '') +
        `. Incoming recordId=${recordId} appears to be from the other base.`
    );
  }

  if (matches.length > 1) {
    throw new Error(
      `Multiple Projects records matched Project Name (Job #)="${projectName}"` +
        (clientCode ? ` and Client Code="${clientCode}"` : '') +
        `. Make projectName unique or pass clientCode. Matched: ${matches.map((m) => m.id).join(', ')}`
    );
  }

  record = matches[0];
  console.log('[CreativeScaffold] Fallback resolved Projects recordId:', record.id);
}

const effectiveRecordId = record.id;
const creativeMode = record.getCellValueAsString(FIELDS.mode) || '';
const promoName = record.getCellValueAsString(FIELDS.promoName) || '';

output.text(`Scaffolding for record ${effectiveRecordId}  mode=${creativeMode}  promo=${promoName}`);

// ─── Call scaffold endpoint ──────────────────────────────────────────
let result;
try {
    const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-hive-api-key': API_KEY,
        },
        body: JSON.stringify({
            recordId: effectiveRecordId,
            creativeMode,
            promoName,
            clientProjectsFolderId: CLIENT_PROJECTS_FOLDER_ID,
        }),
    });

    if (!response.ok) {
        result = {
            ok: false,
            scaffoldStatus: 'error',
            error: `HTTP ${response.status}: ${response.statusText}`,
        };
    } else {
        result = await response.json();
        if (!result || typeof result !== 'object') {
            result = { ok: false, scaffoldStatus: 'error', error: 'Invalid JSON response' };
        }
    }
} catch (err) {
    result = { ok: false, scaffoldStatus: 'error', error: `Fetch failed: ${err.message}` };
}

output.text(`Response: ${JSON.stringify(result)}`);

// ─── Build updates: avoid single-select values that may not exist; use real null for Connect URL ─────
const updates = {};

// Last Run: always set to a real datetime (never {}). Use server lastRunAt when present, else now.
const lastRunIso = (result && result.lastRunAt && typeof result.lastRunAt === 'string')
    ? result.lastRunAt
    : new Date().toISOString();
updates['Creative Scaffold Last Run'] = lastRunIso;

if (result && result.ok === true) {
    // Success: set status to existing option "complete"; clear error; set URLs and job folder ID/URL.
    updates['Creative Scaffold Status'] = 'complete';
    updates['Creative Scaffold Error'] = '';
    updates['Creative Scaffold Connect URL'] = null;
    if (typeof result.sheetUrl === 'string' && result.sheetUrl.trim()) {
        updates['Creative Review Sheet URL'] = result.sheetUrl.trim();
    }
    if (typeof result.productionAssetsRootFolderUrl === 'string' && result.productionAssetsRootFolderUrl.trim()) {
        updates['Production Assets Root Folder'] = result.productionAssetsRootFolderUrl.trim();
    }
    if (typeof result.clientReviewFolderUrl === 'string' && result.clientReviewFolderUrl.trim()) {
        updates['Client Review Folder URL'] = result.clientReviewFolderUrl.trim();
    }
    if (typeof result.creativeReviewHubFolderId === 'string' && result.creativeReviewHubFolderId.trim()) {
        updates['Creative Review Hub Folder ID'] = result.creativeReviewHubFolderId.trim();
    }
    if (typeof result.creativeReviewHubFolderUrl === 'string' && result.creativeReviewHubFolderUrl.trim()) {
        updates['Creative Review Hub Folder URL'] = result.creativeReviewHubFolderUrl.trim();
    }
} else {
    // Failure: do NOT set Creative Scaffold Status (avoids missing single-select option "Error").
    // Only set error text and connect URL (real null if absent).
    updates['Creative Scaffold Error'] = (result && result.error) ? String(result.error) : 'Unknown error';
    const connectUrl = result && result.debug && result.debug.connectUrl;
    updates['Creative Scaffold Connect URL'] = (connectUrl != null && connectUrl !== '') ? connectUrl : null;
}

// ─── Log before update: fieldName, fieldType, value ───────────────────
const LOG_FIELD_TYPES = {
    'Creative Scaffold Status': 'singleSelect',
    'Creative Scaffold Error': 'multilineText',
    'Creative Scaffold Connect URL': 'url',
    'Creative Scaffold Last Run': 'dateTime',
    'Creative Review Sheet URL': 'url',
    'Production Assets Root Folder': 'url',
    'Client Review Folder URL': 'url',
    'Creative Review Hub Folder ID': 'singleLineText',
    'Creative Review Hub Folder URL': 'url',
};

for (const [fieldName, value] of Object.entries(updates)) {
    const fieldType = LOG_FIELD_TYPES[fieldName] || 'unknown';
    console.log(`[CreativeScaffold] update: fieldName="${fieldName}", fieldType="${fieldType}", value=${JSON.stringify(value)}`);
}

// ─── Write to Airtable ───────────────────────────────────────────────
await table.updateRecordAsync(effectiveRecordId, updates);

output.text(result.ok ? '✅ Scaffold complete' : `❌ ${result.error}`);
