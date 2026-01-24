import { NextResponse } from "next/server";

/**
 * Gmail Inbound Endpoint
 * POST /api/os/inbound/gmail
 *
 * Creates Opportunities linked to Companies in Airtable OS base.
 *
 * Required env vars:
 * - AIRTABLE_API_KEY (PAT with data.records:read, data.records:write)
 * - AIRTABLE_OS_BASE_ID
 * - HIVE_INBOUND_SECRET (or HIVE_INBOUND_EMAIL_SECRET for backwards compat)
 *
 * Optional:
 * - AIRTABLE_COMPANIES_TABLE (default: "Companies")
 * - AIRTABLE_OPPORTUNITIES_TABLE (default: "Opportunities")
 */

const AIRTABLE_API_KEY =
  process.env.AIRTABLE_INBOUND_API_KEY ||
  process.env.AIRTABLE_API_KEY ||
  "";

if (!AIRTABLE_API_KEY) {
  throw new Error(
    "Missing Airtable API key. Set AIRTABLE_INBOUND_API_KEY or AIRTABLE_API_KEY environment variable."
  );
}

const AIRTABLE_OS_BASE_ID =
  process.env.AIRTABLE_OS_BASE_ID ||
  process.env.AIRTABLE_BASE_ID ||
  "";

if (!AIRTABLE_OS_BASE_ID) {
  throw new Error(
    "Missing Airtable base ID. Set AIRTABLE_OS_BASE_ID or AIRTABLE_BASE_ID environment variable."
  );
}
const HIVE_INBOUND_SECRET =
  process.env.HIVE_INBOUND_SECRET ||
  process.env.HIVE_INBOUND_EMAIL_SECRET!;

const COMPANIES_TABLE_NAME =
  process.env.AIRTABLE_COMPANIES_TABLE || "Companies";
const OPPORTUNITIES_TABLE_NAME =
  process.env.AIRTABLE_OPPORTUNITIES_TABLE || "Opportunities";

const AIRTABLE_DATA_BASE = `https://api.airtable.com/v0/${AIRTABLE_OS_BASE_ID}`;

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

  // --- Data table probes ---
  try {
    // Probe Companies table
    const companiesProbeUrl = `${AIRTABLE_DATA_BASE}/${encodeURIComponent(COMPANIES_TABLE_NAME)}?maxRecords=1`;
    const companiesProbe = await fetch(companiesProbeUrl, {
      method: "GET",
      headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` },
      cache: "no-store",
    });
    const companiesBody = await companiesProbe.text();
    console.log("[GMAIL_INBOUND_DATA_PROBE]", safeLog({
      debugId,
      label: "Companies",
      url: companiesProbeUrl,
      status: companiesProbe.status,
      body: companiesBody,
    }));
    if (!companiesProbe.ok) {
      return NextResponse.json(
        { ok: false, debugId, error: "Data probe failed", label: "Companies", status: companiesProbe.status, body: companiesBody },
        { status: 500 }
      );
    }

    // Probe Opportunities table
    const oppProbeUrl = `${AIRTABLE_DATA_BASE}/${encodeURIComponent(OPPORTUNITIES_TABLE_NAME)}?maxRecords=1`;
    const oppProbe = await fetch(oppProbeUrl, {
      method: "GET",
      headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` },
      cache: "no-store",
    });
    const oppBody = await oppProbe.text();
    console.log("[GMAIL_INBOUND_DATA_PROBE]", safeLog({
      debugId,
      label: "Opportunities",
      url: oppProbeUrl,
      status: oppProbe.status,
      body: oppBody,
    }));
    if (!oppProbe.ok) {
      return NextResponse.json(
        { ok: false, debugId, error: "Data probe failed", label: "Opportunities", status: oppProbe.status, body: oppBody },
        { status: 500 }
      );
    }
  } catch (e: any) {
    console.log("[GMAIL_INBOUND_DATA_PROBE_ERROR]", safeLog({ debugId, error: e?.message || String(e) }));
    return NextResponse.json(
      { ok: false, debugId, error: "Data probe exception", detail: e?.message || String(e) },
      { status: 500 }
    );
  }
  // --- end probes ---

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
    // 2) Create Opportunity with Company link
    // -------------------------------------------------------------------------
    const opportunityFields: Record<string, unknown> = {
      // Primary field (adjust name if yours differs)
      Name: `${companyLabel} — ${subject}`.slice(0, 120),

      // Link to Company using field name
      Company: [companyId],

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
