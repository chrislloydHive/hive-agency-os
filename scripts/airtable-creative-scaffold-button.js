// Airtable Automation / Button "Run script" — Creative Review Scaffold
//
// Paste this into an Airtable "Run script" action attached to a Button
// field or an Automation trigger.
//
// Input variables (configure in the Airtable script settings panel):
//   recordId       – input.config().recordId   (the current record ID)
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
const config = input.config();
const recordId = config.recordId;

const BASE_URL = 'YOUR_HIVE_OS_BASE_URL';          // ← replace
const API_KEY  = 'YOUR_HIVE_OS_INTERNAL_API_KEY';   // ← replace

const ENDPOINT = `${BASE_URL}/api/os/creative/scaffold`;

// ─── Read record fields ──────────────────────────────────────────────
const table = base.getTable('Projects');  // ← adjust table name if different
const record = await table.selectRecordAsync(recordId, {
    fields: ['Creative Mode', 'Promo Name'],
});

if (!record) {
    output.text(`Record ${recordId} not found.`);
    throw new Error(`Record ${recordId} not found`);
}

const creativeMode = record.getCellValueAsString('Creative Mode') || '';
const promoName    = record.getCellValueAsString('Promo Name') || '';

output.text(`Scaffolding for record ${recordId}  mode=${creativeMode}  promo=${promoName}`);

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
            recordId,
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
await table.updateRecordAsync(recordId, updates);

output.text(result.ok ? '✅ Scaffold complete' : `❌ ${result.error}`);
