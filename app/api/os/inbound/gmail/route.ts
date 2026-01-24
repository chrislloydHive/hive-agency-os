import { NextResponse } from "next/server";

/**
 * Gmail Inbound Endpoint
 * POST /api/os/inbound/gmail
 *
 * Idempotent Opportunity creation from Gmail threads.
 *
 * Required env vars:
 * - AIRTABLE_API_KEY
 * - AIRTABLE_OS_BASE_ID
 * - HIVE_INBOUND_SECRET
 *
 * Airtable contract:
 * - Base: AIRTABLE_OS_BASE_ID
 * - Tables:
 *   - Companies (fields: Company Name, Company Key)
 *   - Opportunities (fields: Opportunity, Company, Source, Gmail Thread Id, Inbound Context)
 */

// ============================================================================
// Environment Validation
// ============================================================================

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY || "";
const AIRTABLE_OS_BASE_ID = process.env.AIRTABLE_OS_BASE_ID || "";
const HIVE_INBOUND_SECRET = process.env.HIVE_INBOUND_SECRET || "";

if (!AIRTABLE_API_KEY) {
  throw new Error("Missing AIRTABLE_API_KEY environment variable.");
}
if (!AIRTABLE_OS_BASE_ID) {
  throw new Error("Missing AIRTABLE_OS_BASE_ID environment variable.");
}
if (!HIVE_INBOUND_SECRET) {
  throw new Error("Missing HIVE_INBOUND_SECRET environment variable.");
}

const COMPANIES_TABLE = "Companies";
const OPPORTUNITIES_TABLE = "Opportunities";
const AIRTABLE_BASE_URL = `https://api.airtable.com/v0/${AIRTABLE_OS_BASE_ID}`;

// ============================================================================
// Helpers
// ============================================================================

function asStr(v: unknown): string {
  return v === undefined || v === null ? "" : String(v);
}

function safeLog(obj: unknown): string {
  try {
    return JSON.stringify(obj, (_k, val) => {
      if (typeof val === "string" && val.length > 800) return val.slice(0, 800) + "...";
      return val;
    });
  } catch {
    return String(obj);
  }
}

function escapeFormula(s: string): string {
  return `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function extractDomain(email: string): string {
  const e = (email || "").toLowerCase().trim();
  const at = e.lastIndexOf("@");
  if (at === -1) return "";
  return e.slice(at + 1).replace(/>$/, "").trim();
}

// ============================================================================
// Airtable API
// ============================================================================

async function airtableFetch(
  url: string,
  init?: RequestInit,
  debugId?: string
): Promise<any> {
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
  } catch {}

  if (!res.ok) {
    console.log("[GMAIL_INBOUND_AIRTABLE_ERROR]", safeLog({
      debugId,
      url,
      status: res.status,
      body: text,
    }));
    const msg = json?.error?.message || json?.error || text || `Airtable error (${res.status})`;
    const err: any = new Error(msg);
    err.status = res.status;
    throw err;
  }

  return json;
}

async function findFirst(
  table: string,
  formula: string,
  debugId?: string
): Promise<any> {
  const qs = new URLSearchParams({ maxRecords: "1", filterByFormula: formula });
  const url = `${AIRTABLE_BASE_URL}/${encodeURIComponent(table)}?${qs}`;
  const data = await airtableFetch(url, { method: "GET" }, debugId);
  return data?.records?.[0] || null;
}

async function getRecord(
  table: string,
  recordId: string,
  debugId?: string
): Promise<any> {
  const url = `${AIRTABLE_BASE_URL}/${encodeURIComponent(table)}/${encodeURIComponent(recordId)}`;
  return airtableFetch(url, { method: "GET" }, debugId);
}

async function createRecord(
  table: string,
  fields: Record<string, unknown>,
  debugId?: string
): Promise<any> {
  const url = `${AIRTABLE_BASE_URL}/${encodeURIComponent(table)}`;
  const data = await airtableFetch(url, {
    method: "POST",
    body: JSON.stringify({ records: [{ fields }] }),
  }, debugId);
  return data?.records?.[0] || null;
}

// ============================================================================
// Company Management
// ============================================================================

async function ensureCompany(
  debugId: string,
  companyKey: string,
  companyName: string
): Promise<string> {
  // 1. Lookup by Company Key (domain)
  if (companyKey) {
    const byKey = await findFirst(
      COMPANIES_TABLE,
      `{Company Key} = ${escapeFormula(companyKey)}`,
      debugId
    );
    if (byKey?.id) {
      console.log("[GMAIL_INBOUND] Company found by key", safeLog({ debugId, companyKey, companyId: byKey.id }));
      return byKey.id;
    }
  }

  // 2. Fallback: lookup by Company Name
  if (companyName) {
    const byName = await findFirst(
      COMPANIES_TABLE,
      `{Company Name} = ${escapeFormula(companyName)}`,
      debugId
    );
    if (byName?.id) {
      console.log("[GMAIL_INBOUND] Company found by name", safeLog({ debugId, companyName, companyId: byName.id }));
      return byName.id;
    }
  }

  // 3. Create new company
  const created = await createRecord(COMPANIES_TABLE, {
    "Company Name": companyName || companyKey || "Unknown Company",
    "Company Key": companyKey || "",
  }, debugId);

  console.log("[GMAIL_INBOUND] Company created", safeLog({ debugId, companyId: created?.id }));

  // 4. Verify it exists
  await getRecord(COMPANIES_TABLE, created.id, debugId);
  return created.id;
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
    if (secret !== HIVE_INBOUND_SECRET) {
      return NextResponse.json({ ok: false, debugId, error: "Unauthorized" }, { status: 401 });
    }

    // -------------------------------------------------------------------------
    // Parse payload
    // -------------------------------------------------------------------------
    const body = await req.json().catch(() => ({}));

    const gmailThreadId = asStr(body.gmailThreadId || "").trim();
    const gmailMessageId = asStr(body.gmailMessageId || "").trim();
    const subject = asStr(body.subject || "(No subject)").trim();
    const fromEmail = asStr(body?.from?.email || body?.from || "").trim();
    const snippet = asStr(body.snippet || "").trim();
    const receivedAt = asStr(body.receivedAt || "").trim();
    const gmailUrl = asStr(body.gmailUrl || "").trim();

    const domain = extractDomain(fromEmail);
    const companyName = asStr(body.companyName || "").trim();
    const companyKey = domain || (companyName ? `name:${companyName.toLowerCase()}` : "");
    const companyLabel = companyName || domain || "Unknown Company";

    console.log("[GMAIL_INBOUND] Request", safeLog({
      debugId,
      gmailThreadId,
      fromEmail,
      subject,
      companyKey,
    }));

    // -------------------------------------------------------------------------
    // 1) Ensure Company exists
    // -------------------------------------------------------------------------
    const companyId = await ensureCompany(debugId, companyKey, companyLabel);

    // -------------------------------------------------------------------------
    // 2) Idempotency: Check for existing Opportunity by Gmail Thread Id
    // -------------------------------------------------------------------------
    if (gmailThreadId) {
      const existing = await findFirst(
        OPPORTUNITIES_TABLE,
        `{Gmail Thread Id} = ${escapeFormula(gmailThreadId)}`,
        debugId
      );

      if (existing?.id) {
        console.log("[GMAIL_INBOUND] Existing Opportunity found (dedupe)", safeLog({
          debugId,
          gmailThreadId,
          opportunityId: existing.id,
        }));

        return NextResponse.json({
          ok: true,
          status: "existing",
          debugId,
          deduped: true,
          company: { id: companyId, name: companyLabel },
          opportunity: { id: existing.id },
        });
      }
    }

    // -------------------------------------------------------------------------
    // 3) Create Opportunity
    // -------------------------------------------------------------------------
    const inboundContext = JSON.stringify({
      gmailThreadId,
      gmailMessageId,
      fromEmail,
      subject,
      snippet,
      receivedAt,
      gmailUrl,
    });

    const opportunityFields = {
      Opportunity: `${companyLabel} — ${subject}`.slice(0, 120),
      Company: [companyId],
      Source: "Inbound",
      "Gmail Thread Id": gmailThreadId,
      "Inbound Context": inboundContext,
    };

    const created = await createRecord(OPPORTUNITIES_TABLE, opportunityFields, debugId);

    console.log("[GMAIL_INBOUND] Opportunity created", safeLog({
      debugId,
      gmailThreadId,
      opportunityId: created?.id,
    }));

    return NextResponse.json({
      ok: true,
      status: "created",
      debugId,
      company: { id: companyId, name: companyLabel },
      opportunity: { id: created?.id, name: opportunityFields.Opportunity },
    });

  } catch (err: any) {
    console.error("[GMAIL_INBOUND_ERROR]", safeLog({
      debugId,
      error: err?.message || String(err),
      status: err?.status,
    }));

    return NextResponse.json(
      { ok: false, debugId, error: err?.message || "Internal server error" },
      { status: err?.status || 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    route: "os/inbound/gmail",
    description: "Idempotent Gmail inbound webhook for Opportunities",
  });
}
