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
//   "Creative Mode"              – single-line text (e.g. "Evergreen", "Promo")
//   "Promo Name"                 – single-line text (optional, e.g. "Summer Sale 2025")
//   "Scaffold Status"            – single-line text (written back)
//   "Creative Scaffold Last Run" – Date/DateTime (written back, ISO 8601 UTC) [fld8kvbELvf3p9618]
//   "Review Sheet URL"           – URL field (written back)
//   "Production Assets URL"      – URL field (written back)
//   "Client Review URL"          – URL field (written back)
//   "Scaffold Error"             – long text  (written back, cleared on success)
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

// ─── Build updates: only write URLs/IDs when response.ok === true ─────
const updates = {};

// Always write status and error (so user sees success or failure)
updates['Scaffold Status'] = result.scaffoldStatus || (result.ok ? 'complete' : 'error');
updates['Scaffold Error'] = result.ok ? '' : (result.error || 'Unknown error');

// Only write URLs and lastRunAt when response is OK and values are present
if (result.ok === true) {
    if (typeof result.sheetUrl === 'string' && result.sheetUrl.trim()) {
        updates['Review Sheet URL'] = result.sheetUrl.trim();
    }
    if (typeof result.productionAssetsRootUrl === 'string' && result.productionAssetsRootUrl.trim()) {
        updates['Production Assets URL'] = result.productionAssetsRootUrl.trim();
    }
    if (typeof result.clientReviewFolderUrl === 'string' && result.clientReviewFolderUrl.trim()) {
        updates['Client Review URL'] = result.clientReviewFolderUrl.trim();
    }

    // Creative Scaffold Last Run (fld8kvbELvf3p9618) — DateTime field, ISO 8601
    const lastRunField = FIELD_MAP['fld8kvbELvf3p9618'];
    if (lastRunField && result.lastRunAt) {
        const value = lastRunField.toValue(result.lastRunAt);
        if (value) {
            updates[lastRunField.name] = value;
        }
    }
}

// ─── Log before update: fieldName, fieldType, value ───────────────────
const LOG_FIELD_TYPES = {
    'Scaffold Status': 'singleLineText',
    'Scaffold Error': 'multilineText',
    'Review Sheet URL': 'url',
    'Production Assets URL': 'url',
    'Client Review URL': 'url',
    'Creative Scaffold Last Run': 'dateTime',
};

for (const [fieldName, value] of Object.entries(updates)) {
    const fieldType = LOG_FIELD_TYPES[fieldName] || 'unknown';
    console.log(`[CreativeScaffold] update: fieldName="${fieldName}", fieldType="${fieldType}", value=${JSON.stringify(value)}`);
}

// ─── Write to Airtable ───────────────────────────────────────────────
await table.updateRecordAsync(effectiveRecordId, updates);

output.text(result.ok ? '✅ Scaffold complete' : `❌ ${result.error}`);
