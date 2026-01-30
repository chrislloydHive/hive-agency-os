// Airtable Automation / Button "Run script" — Creative Review Scaffold
//
// Paste this into an Airtable "Run script" action attached to a Button
// field or an Automation trigger.
//
// Input variables (configure in the Airtable script settings panel):
//   recordId       – input.config().recordId   (the current record ID)
//
// Airtable field names expected on the record:
//   "Creative Mode"          – single-line text (e.g. "Evergreen", "Promo")
//   "Promo Name"             – single-line text (optional, e.g. "Summer Sale 2025")
//   "Company"                – linked record to Companies table
//   "Scaffold Status"        – single-line text (written back)
//   "Review Sheet URL"       – URL field (written back)
//   "Production Assets URL"  – URL field (written back)
//   "Client Review URL"      – URL field (written back)
//   "Scaffold Error"         – long text  (written back, cleared on success)
//
// Environment:
//   HIVE_OS_BASE_URL         – e.g. https://your-app.vercel.app
//   HIVE_OS_INTERNAL_API_KEY – shared secret

// ─── Config ──────────────────────────────────────────────────────────
const config = input.config();
const recordId = config.recordId;

const BASE_URL = 'YOUR_HIVE_OS_BASE_URL';          // ← replace
const API_KEY  = 'YOUR_HIVE_OS_INTERNAL_API_KEY';   // ← replace

const ENDPOINT = `${BASE_URL}/api/os/creative/scaffold`;

// ─── Read record fields ──────────────────────────────────────────────
const table = base.getTable('Creative Review');  // ← adjust table name
const record = await table.selectRecordAsync(recordId, {
    fields: ['Creative Mode', 'Promo Name', 'Company'],
});

if (!record) {
    output.text(`Record ${recordId} not found.`);
    throw new Error(`Record ${recordId} not found`);
}

const creativeMode = record.getCellValueAsString('Creative Mode') || '';
const promoName    = record.getCellValueAsString('Promo Name') || '';

// Resolve companyId from linked Company record
const companyLinks = record.getCellValue('Company');
if (!companyLinks || !Array.isArray(companyLinks) || companyLinks.length === 0) {
    const errMsg = 'No Company linked to this record. Link a Company first.';
    await table.updateRecordAsync(recordId, {
        'Scaffold Status': 'error',
        'Scaffold Error': errMsg,
    });
    output.text(`❌ ${errMsg}`);
    throw new Error(errMsg);
}
const companyId = companyLinks[0].id;

output.text(`Scaffolding for record ${recordId}  company=${companyId}  mode=${creativeMode}  promo=${promoName}`);

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
            companyId,
            creativeMode,
            promoName,
        }),
    });

    result = await response.json();
} catch (err) {
    result = { ok: false, scaffoldStatus: 'error', error: `Fetch failed: ${err.message}` };
}

output.text(`Response: ${JSON.stringify(result)}`);

// ─── Write results back to Airtable ─────────────────────────────────
const updates = {
    'Scaffold Status': result.scaffoldStatus || (result.ok ? 'complete' : 'error'),
    'Scaffold Error':  result.ok ? '' : (result.error || 'Unknown error'),
};

if (result.sheetUrl) {
    updates['Review Sheet URL'] = result.sheetUrl;
}
if (result.productionAssetsRootUrl) {
    updates['Production Assets URL'] = result.productionAssetsRootUrl;
}
if (result.clientReviewFolderUrl) {
    updates['Client Review URL'] = result.clientReviewFolderUrl;
}

await table.updateRecordAsync(recordId, updates);

output.text(result.ok ? '✅ Scaffold complete' : `❌ ${result.error}`);
