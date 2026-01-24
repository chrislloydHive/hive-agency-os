import { NextResponse } from "next/server";

/**
 * Gmail Inbound Endpoint
 * POST /api/os/inbound/gmail
 *
 * Creates Opportunities linked to Companies in Airtable OS base.
 * Uses Meta API to resolve the correct linked-record field ID.
 *
 * Required env vars:
 * - AIRTABLE_API_KEY (PAT with data.records:read, data.records:write, schema.bases:read)
 * - AIRTABLE_OS_BASE_ID
 * - HIVE_INBOUND_SECRET (or HIVE_INBOUND_EMAIL_SECRET for backwards compat)
 *
 * Optional:
 * - AIRTABLE_COMPANIES_TABLE (default: "Companies")
 * - AIRTABLE_OPPORTUNITIES_TABLE (default: "Opportunities")
 */

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY!;
const AIRTABLE_OS_BASE_ID = process.env.AIRTABLE_OS_BASE_ID!;
const HIVE_INBOUND_SECRET =
  process.env.HIVE_INBOUND_SECRET ||
  process.env.HIVE_INBOUND_EMAIL_SECRET!;

const COMPANIES_TABLE_NAME =
  process.env.AIRTABLE_COMPANIES_TABLE || "Companies";
const OPPORTUNITIES_TABLE_NAME =
  process.env.AIRTABLE_OPPORTUNITIES_TABLE || "Opportunities";

const AIRTABLE_DATA_BASE = `https://api.airtable.com/v0/${AIRTABLE_OS_BASE_ID}`;
const AIRTABLE_META_BASE = `https://api.airtable.com/v0/meta/bases/${AIRTABLE_OS_BASE_ID}`;

// ============================================================================
// Helpers
// ============================================================================

function asStr(v: unknown): string {
  return v === undefined || v === null ? "" : String(v);
}

function safeLog(obj: unknown): string {
  try {
    return JSON.stringify(obj, (_k, val) => {
      if (typeof val === "string" && val.length > 800)
        return val.slice(0, 800) + "…";
      return val;
    });
  } catch {
    return String(obj);
  }
}

function escapeAirtableFormulaString(s: string): string {
  return `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function extractDomain(email: string): string {
  const e = (email || "").toLowerCase().trim();
  const at = e.lastIndexOf("@");
  if (at === -1) return "";
  return e
    .slice(at + 1)
    .replace(/>$/, "")
    .trim();
}

// ============================================================================
// Airtable API Helpers
// ============================================================================

async function airtableFetch(url: string, init?: RequestInit, debugId?: string): Promise<any> {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${AIRTABLE_API_KEY}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });

  const text = await res.text();

  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    // ignore parse errors
  }

  if (!res.ok) {
    console.log("[GMAIL_INBOUND_AIRTABLE_ERROR]", safeLog({
      debugId,
      url,
      status: res.status,
      body: text,
    }));

    const msg =
      json?.error?.message ||
      json?.error ||
      text ||
      `Airtable error (${res.status})`;
    const err: any = new Error(msg);
    err.status = res.status;
    err.payload = json || text;
    err.url = url;
    err.body = text;
    throw err;
  }

  return json;
}

async function airtableSelectFirstByFormula(
  tableName: string,
  filterByFormula: string,
  debugId?: string
): Promise<any> {
  const qs = new URLSearchParams();
  qs.set("maxRecords", "1");
  qs.set("pageSize", "1");
  qs.set("filterByFormula", filterByFormula);

  const url = `${AIRTABLE_DATA_BASE}/${encodeURIComponent(tableName)}?${qs.toString()}`;
  const data = await airtableFetch(url, { method: "GET" }, debugId);
  return Array.isArray(data?.records) && data.records.length
    ? data.records[0]
    : null;
}

async function airtableFindRecord(
  tableName: string,
  recordId: string,
  debugId?: string
): Promise<any> {
  const url = `${AIRTABLE_DATA_BASE}/${encodeURIComponent(tableName)}/${encodeURIComponent(recordId)}`;
  return airtableFetch(url, { method: "GET" }, debugId);
}

async function airtableCreateRecord(
  tableName: string,
  fields: Record<string, unknown>,
  debugId?: string
): Promise<any> {
  const url = `${AIRTABLE_DATA_BASE}/${encodeURIComponent(tableName)}`;
  return airtableFetch(url, {
    method: "POST",
    body: JSON.stringify({ records: [{ fields }] }),
  }, debugId);
}

// ============================================================================
// Meta API: Resolve Company Link Field
// ============================================================================

/**
 * Meta API: Find table IDs and the correct linked-record FIELD ID on Opportunities
 * We locate the Opportunities field with type "multipleRecordLinks" whose
 * linkedTableId == Companies table id.
 */
async function resolveCompanyLinkFieldId(debugId: string): Promise<{
  linkFieldId: string;
  linkFieldName: string;
}> {
  const url = `${AIRTABLE_META_BASE}/tables`;
  const meta = await airtableFetch(url, { method: "GET" }, debugId);

  const tables: any[] = meta?.tables || [];
  const companiesTable = tables.find((t) => t?.name === COMPANIES_TABLE_NAME);
  const oppTable = tables.find((t) => t?.name === OPPORTUNITIES_TABLE_NAME);

  if (!companiesTable || !oppTable) {
    const names = tables.map((t) => t?.name).filter(Boolean);
    throw new Error(
      `Meta tables missing. Found tables: ${names.join(", ")}. Expected "${COMPANIES_TABLE_NAME}" and "${OPPORTUNITIES_TABLE_NAME}".`
    );
  }

  const companiesTableId = companiesTable.id;
  const oppFields: any[] = oppTable.fields || [];

  // Primary strategy: linked field pointing to Companies by tableId match
  const linkField = oppFields.find(
    (f) =>
      f?.type === "multipleRecordLinks" &&
      f?.options?.linkedTableId === companiesTableId
  );

  if (linkField?.id) {
    console.log(
      "[GMAIL_INBOUND] ✅ Resolved Company link field via meta",
      safeLog({
        debugId,
        companiesTableId,
        opportunitiesTableId: oppTable.id,
        linkFieldId: linkField.id,
        linkFieldName: linkField.name,
      })
    );
    return {
      linkFieldId: linkField.id as string,
      linkFieldName: linkField.name as string,
    };
  }

  // Fallback: look for common field names that are multipleRecordLinks
  const fallbackNames = new Set([
    "Company",
    "Companies",
    "Account",
    "Accounts",
    "Client",
    "Clients",
  ]);
  const namedLink = oppFields.find(
    (f) => fallbackNames.has(f?.name) && f?.type === "multipleRecordLinks"
  );

  if (namedLink?.id) {
    console.log(
      "[GMAIL_INBOUND] ⚠️ Resolved Company link field via name fallback",
      safeLog({
        debugId,
        linkFieldId: namedLink.id,
        linkFieldName: namedLink.name,
        linkedTableId: namedLink?.options?.linkedTableId,
      })
    );
    return {
      linkFieldId: namedLink.id as string,
      linkFieldName: namedLink.name as string,
    };
  }

  // Helpful diagnostics: list candidate fields + types
  const fieldSummaries = oppFields.map((f) => ({
    name: f?.name,
    id: f?.id,
    type: f?.type,
    linkedTableId: f?.options?.linkedTableId,
  }));

  console.log(
    "[GMAIL_INBOUND_ERROR] ❌ Could not resolve linked field on Opportunities that points to Companies",
    safeLog({
      debugId,
      companiesTableId,
      opportunitiesTable: OPPORTUNITIES_TABLE_NAME,
      companiesTable: COMPANIES_TABLE_NAME,
      fields: fieldSummaries,
    })
  );

  throw new Error(
    `Could not find a linked-record field on "${OPPORTUNITIES_TABLE_NAME}" pointing to "${COMPANIES_TABLE_NAME}". Check field types.`
  );
}

// ============================================================================
// Company Management
// ============================================================================

async function ensureCompanyInOS(
  debugId: string,
  companyKey: string,
  companyName: string
): Promise<string> {
  let rec: any = null;

  // Try lookup by Company Key first
  if (companyKey) {
    rec = await airtableSelectFirstByFormula(
      COMPANIES_TABLE_NAME,
      `{Company Key} = ${escapeAirtableFormulaString(companyKey)}`,
      debugId
    );
    console.log(
      "[GMAIL_INBOUND] ensureCompany lookup by key",
      safeLog({ debugId, companyKey, found: !!rec, recId: rec?.id })
    );
  }

  // Fallback: lookup by Company Name
  if (!rec && companyName) {
    rec = await airtableSelectFirstByFormula(
      COMPANIES_TABLE_NAME,
      `{Company Name} = ${escapeAirtableFormulaString(companyName)}`,
      debugId
    );
    console.log(
      "[GMAIL_INBOUND] ensureCompany lookup by name",
      safeLog({ debugId, companyName, found: !!rec, recId: rec?.id })
    );
  }

  // Not found: create new company
  if (!rec) {
    const created = await airtableCreateRecord(COMPANIES_TABLE_NAME, {
      "Company Name": companyName || companyKey || "Unknown Company",
      "Company Key": companyKey || "",
    }, debugId);
    rec = created?.records?.[0];
    console.log(
      "[GMAIL_INBOUND] ensureCompany created",
      safeLog({ debugId, companyId: rec?.id, companyKey, companyName })
    );
  }

  // Decisive verification: GET the record to confirm it exists
  await airtableFindRecord(COMPANIES_TABLE_NAME, rec.id, debugId);
  console.log(
    "[GMAIL_INBOUND] ✅ Company verified",
    safeLog({ debugId, companyId: rec.id })
  );

  return rec.id as string;
}

// ============================================================================
// Route Handler
// ============================================================================

export async function POST(req: Request) {
  const debugId = `dbg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  try {
    // -------------------------------------------------------------------------
    // Auth
    // -------------------------------------------------------------------------
    const secret = req.headers.get("x-hive-secret") || "";
    if (!HIVE_INBOUND_SECRET || secret !== HIVE_INBOUND_SECRET) {
      return NextResponse.json(
        { ok: false, debugId, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // -------------------------------------------------------------------------
    // Parse payload
    // -------------------------------------------------------------------------
    const body = await req.json().catch(() => ({}));

    const subject = asStr(body.subject || "(No subject)").trim();
    const fromEmail = asStr(body?.from?.email || body?.from || "").trim();
    const domain = extractDomain(fromEmail);

    const companyName = asStr(body.companyName || "").trim();
    const companyKey =
      domain || (companyName ? `name:${companyName.toLowerCase()}` : "");
    const companyLabel = companyName || domain || "Unknown Company";

    console.log(
      "[GMAIL_INBOUND] inbound",
      safeLog({
        debugId,
        subject,
        fromEmail,
        domain,
        companyKey,
        companyName,
        gmailThreadId: body.gmailThreadId,
        gmailMessageId: body.gmailMessageId,
      })
    );

    // -------------------------------------------------------------------------
    // 1) Ensure company exists in OS base
    // -------------------------------------------------------------------------
    const companyId = await ensureCompanyInOS(debugId, companyKey, companyLabel);

    // -------------------------------------------------------------------------
    // 2) Resolve the correct link FIELD ID on Opportunities via Meta API
    // -------------------------------------------------------------------------
    const { linkFieldId, linkFieldName } =
      await resolveCompanyLinkFieldId(debugId);

    // -------------------------------------------------------------------------
    // 3) Create Opportunity — use FIELD ID for the link, not field name
    // -------------------------------------------------------------------------
    const opportunityFields: Record<string, unknown> = {
      // Primary field (adjust name if yours differs)
      Name: `${companyLabel} — ${subject}`.slice(0, 120),

      // ✅ KEY FIX: Write the link using FIELD ID, not field name
      [linkFieldId]: [companyId],

      // Optional metadata fields (only if they exist in your table)
      Source: "Gmail Inbound",
      "Gmail Thread Id": asStr(body.gmailThreadId || ""),
      "Gmail Message Id": asStr(body.gmailMessageId || ""),
      "Received At": asStr(body.receivedAt || ""),
      "From Email": fromEmail,
      "Gmail URL": asStr(body.gmailUrl || ""),
    };

    console.log(
      "[GMAIL_INBOUND] Creating Opportunity",
      safeLog({
        debugId,
        companyId,
        linkFieldId,
        linkFieldName,
        linkValue: [companyId],
        opportunityFields: Object.keys(opportunityFields),
      })
    );

    const created = await airtableCreateRecord(
      OPPORTUNITIES_TABLE_NAME,
      opportunityFields,
      debugId
    );
    const oppRec = created?.records?.[0];

    console.log(
      "[GMAIL_INBOUND] ✅ Opportunity created",
      safeLog({ debugId, opportunityId: oppRec?.id })
    );

    // -------------------------------------------------------------------------
    // Success response
    // -------------------------------------------------------------------------
    return NextResponse.json({
      ok: true,
      status: "success",
      debugId,
      company: {
        id: companyId,
        name: companyLabel,
        key: companyKey,
      },
      opportunity: {
        id: oppRec?.id,
        name: opportunityFields.Name,
      },
    });
  } catch (err: any) {
    console.error(
      "[GMAIL_INBOUND_ERROR]",
      safeLog({
        debugId,
        error: err?.message || String(err),
        status: err?.status,
        payload: err?.payload,
        stack: err?.stack,
      })
    );

    return NextResponse.json(
      {
        ok: false,
        status: "error",
        debugId,
        message: err?.message || "Internal server error",
      },
      { status: err?.status || 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    route: "os/inbound/gmail",
    description: "Gmail inbound webhook for creating Opportunities",
  });
}
