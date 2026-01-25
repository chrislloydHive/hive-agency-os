import { NextResponse } from "next/server";

/**
 * Gmail Inbox Review Endpoint
 * POST /api/os/inbound/gmail-inbox-review
 *
 * Creates Inbox item, summarizes with OpenAI, and updates in one request.
 *
 * Required env vars:
 * - AIRTABLE_API_KEY
 * - AIRTABLE_OS_BASE_ID
 * - HIVE_INBOUND_SECRET
 * - OPENAI_API_KEY
 *
 * Optional env vars:
 * - OPENAI_MODEL (default: "gpt-4o-mini")
 *
 * Airtable contract:
 * - Base: AIRTABLE_OS_BASE_ID
 * - Table: Inbox
 * - Fields: Title, Subject, From Email, From Name, From Domain,
 *           Gmail URL, Gmail Thread ID, Gmail Message ID, Received At,
 *           Snippet, Body Text, Status, Disposition, Description
 */

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY || "";
const AIRTABLE_OS_BASE_ID = process.env.AIRTABLE_OS_BASE_ID || "";
const HIVE_INBOUND_SECRET = process.env.HIVE_INBOUND_SECRET || "";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

const INBOX_TABLE_NAME = "Inbox";

// ============================================================================
// Helpers
// ============================================================================

function asStr(v: any) {
  return v === undefined || v === null ? "" : String(v);
}

function safeLog(obj: any) {
  try {
    return JSON.stringify(obj, (_k, val) => {
      if (typeof val === "string" && val.length > 800) return val.slice(0, 800) + "...";
      return val;
    });
  } catch {
    return String(obj);
  }
}

function extractDomain(email: string) {
  const e = (email || "").toLowerCase().trim();
  const at = e.lastIndexOf("@");
  if (at === -1) return "";
  return e.slice(at + 1).replace(/>$/, "").trim();
}

function truncate(s: string, n: number) {
  s = asStr(s);
  return s.length > n ? s.slice(0, n) + "..." : s;
}

// ============================================================================
// Inbox Field Sanitizers
// ============================================================================

// Allowed values for single-select fields - prevents creating new options
const ALLOWED_INBOX_SELECT_VALUES: Record<string, string[]> = {
  "Status": ["New", "Reviewed"],
  "Disposition": ["New", "Logged"],
};

// Fields that must NEVER be sent in Inbox create/update payload
const FORBIDDEN_INBOX_FIELDS = [
  "Source",
  "Item Type",
  "People",
  "Company",
  "Opportunity",
  "Client",
  "Project",
];

/**
 * Sanitize Inbox fields before sending to Airtable.
 * - Removes forbidden fields (Source, Item Type, People, linked records)
 * - Removes select fields with values not in allowed list
 */
function sanitizeInboxFields(fields: Record<string, any>): Record<string, any> {
  const sanitized: Record<string, any> = {};

  for (const [key, value] of Object.entries(fields)) {
    // Skip forbidden fields
    if (FORBIDDEN_INBOX_FIELDS.includes(key)) {
      continue;
    }

    // Validate select fields against allowed values
    if (key in ALLOWED_INBOX_SELECT_VALUES) {
      const allowed = ALLOWED_INBOX_SELECT_VALUES[key];
      if (!allowed.includes(value)) {
        // Omit field if value not allowed
        continue;
      }
    }

    sanitized[key] = value;
  }

  return sanitized;
}

// ============================================================================
// Airtable API
// ============================================================================

async function airtableCreateRecord(fields: Record<string, any>, debugId: string) {
  const url = `https://api.airtable.com/v0/${AIRTABLE_OS_BASE_ID}/${encodeURIComponent(INBOX_TABLE_NAME)}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${AIRTABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ records: [{ fields }] }),
    cache: "no-store",
  });

  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {}

  if (!res.ok) {
    console.log(
      "[GMAIL_INBOX_REVIEW_AIRTABLE_CREATE_ERROR]",
      safeLog({ debugId, url, status: res.status, body: text })
    );
    const msg = json?.error?.message || json?.error || text || `Airtable error (${res.status})`;
    throw new Error(msg);
  }

  return json;
}

async function airtableUpdateRecord(recordId: string, fields: Record<string, any>, debugId: string) {
  const url = `https://api.airtable.com/v0/${AIRTABLE_OS_BASE_ID}/${encodeURIComponent(INBOX_TABLE_NAME)}`;

  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${AIRTABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ records: [{ id: recordId, fields }] }),
    cache: "no-store",
  });

  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {}

  if (!res.ok) {
    console.log(
      "[GMAIL_INBOX_REVIEW_AIRTABLE_UPDATE_ERROR]",
      safeLog({ debugId, recordId, status: res.status, body: text })
    );
    const msg = json?.error?.message || json?.error || text || `Airtable error (${res.status})`;
    throw new Error(msg);
  }

  return json;
}

// ============================================================================
// OpenAI Summarization
// ============================================================================

async function openaiSummarizeEmail(input: {
  subject: string;
  fromEmail: string;
  fromName: string;
  receivedAt: string;
  gmailUrl: string;
  snippet: string;
  bodyText: string;
  debugId: string;
}): Promise<string> {
  const { subject, fromEmail, fromName, receivedAt, gmailUrl, snippet, bodyText, debugId } = input;

  const prompt = `
You are "Inbox GPT" for Hive OS. Summarize an inbound email for an operator.

Return a concise summary in this exact markdown structure:

## Summary
- <1-3 bullets>

## What they want
- <bullets>

## Suggested next step
- <1-3 bullets>

## Entities
- People: <comma-separated or "—">
- Company: <best guess or "—">

Email context:
- Subject: ${subject || "—"}
- From: ${fromName ? `${fromName} <${fromEmail}>` : fromEmail || "—"}
- Received At: ${receivedAt || "—"}
- Gmail URL: ${gmailUrl || "—"}

Snippet:
${truncate(snippet, 800) || "—"}

Body:
${truncate(bodyText, 8000) || "—"}
`.trim();

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: 0.2,
      messages: [
        { role: "system", content: "You write crisp, operator-friendly summaries. No fluff." },
        { role: "user", content: prompt },
      ],
    }),
  });

  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {}

  if (!res.ok) {
    console.log("[GMAIL_INBOX_REVIEW_OPENAI_ERROR]", safeLog({ debugId, status: res.status, body: text }));
    const msg = json?.error?.message || json?.error || text || `OpenAI error (${res.status})`;
    throw new Error(msg);
  }

  const content = json?.choices?.[0]?.message?.content;
  return asStr(content).trim();
}

// ============================================================================
// Route Handler
// ============================================================================

export async function POST(req: Request) {
  const debugId = `dbg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  try {
    // env sanity
    if (!AIRTABLE_API_KEY) throw new Error("Missing AIRTABLE_API_KEY");
    if (!AIRTABLE_OS_BASE_ID) throw new Error("Missing AIRTABLE_OS_BASE_ID");
    if (!HIVE_INBOUND_SECRET) throw new Error("Missing HIVE_INBOUND_SECRET");
    if (!OPENAI_API_KEY) throw new Error("Missing OPENAI_API_KEY");

    // auth
    const secret = req.headers.get("x-hive-secret") || "";
    if (secret !== HIVE_INBOUND_SECRET) {
      return NextResponse.json({ ok: false, debugId, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));

    const subject = asStr(body.subject || "").trim() || "(No subject)";
    const snippet = asStr(body.snippet || "").trim();
    const bodyText = asStr(body.bodyText || "").trim();
    const fromEmail = asStr(body?.from?.email || body?.fromEmail || "").trim();
    const fromName = asStr(body?.from?.name || body?.fromName || "").trim();
    const fromDomain = extractDomain(fromEmail);
    const gmailThreadId = asStr(body.gmailThreadId || "").trim();
    const gmailMessageId = asStr(body.gmailMessageId || "").trim();
    const receivedAt = asStr(body.receivedAt || "").trim();
    const gmailUrl = asStr(body.gmailUrl || "").trim();

    console.log(
      "[GMAIL_INBOX_REVIEW] inbound",
      safeLog({ debugId, subject, fromEmail, gmailThreadId, gmailMessageId })
    );

    // -------------------------------------------------------------------------
    // Step 1: Create Inbox record with safe fields only
    // -------------------------------------------------------------------------
    const createFields: Record<string, any> = {
      "Title": subject,
      "Subject": subject,
      "From Email": fromEmail,
      "From Name": fromName,
      "From Domain": fromDomain,
      "Gmail URL": gmailUrl,
      "Gmail Thread ID": gmailThreadId,
      "Gmail Message ID": gmailMessageId,
      "Received At": receivedAt,
      "Snippet": truncate(snippet, 1000),
      "Body Text": truncate(bodyText, 10000),
      "Status": "New",
      "Disposition": "New",
    };

    const sanitizedCreateFields = sanitizeInboxFields(createFields);
    const created = await airtableCreateRecord(sanitizedCreateFields, debugId);
    const inboxRec = created?.records?.[0];
    const recordId = inboxRec?.id;

    if (!recordId) {
      throw new Error("Failed to create Inbox record - no ID returned");
    }

    console.log(
      "[GMAIL_INBOX_REVIEW] created",
      safeLog({ debugId, inboxItemId: recordId })
    );

    // -------------------------------------------------------------------------
    // Step 2: Summarize with OpenAI
    // -------------------------------------------------------------------------
    const summary = await openaiSummarizeEmail({
      subject,
      fromEmail,
      fromName,
      receivedAt,
      gmailUrl,
      snippet,
      bodyText,
      debugId,
    });

    console.log(
      "[GMAIL_INBOX_REVIEW] summarized",
      safeLog({ debugId, inboxItemId: recordId, summaryLength: summary.length })
    );

    // -------------------------------------------------------------------------
    // Step 3: Update record with summary and flip Status/Disposition
    // -------------------------------------------------------------------------
    const updateFields: Record<string, any> = {
      "Description": summary,
      "Status": "Reviewed",
      "Disposition": "Logged",
    };

    const sanitizedUpdateFields = sanitizeInboxFields(updateFields);
    await airtableUpdateRecord(recordId, sanitizedUpdateFields, debugId);

    console.log(
      "[GMAIL_INBOX_REVIEW] updated",
      safeLog({ debugId, inboxItemId: recordId })
    );

    // -------------------------------------------------------------------------
    // Step 4: Return response
    // -------------------------------------------------------------------------
    return NextResponse.json({
      ok: true,
      status: "summarized",
      inboxItem: { id: recordId },
      summarized: true,
    });
  } catch (e: any) {
    console.log(
      "[GMAIL_INBOX_REVIEW_ERROR]",
      safeLog({ debugId, error: e?.message || String(e) })
    );

    return NextResponse.json(
      { ok: false, debugId, error: e?.message || String(e) },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    route: "os/inbound/gmail-inbox-review",
    description: "Gmail add-on - creates Inbox item and summarizes with OpenAI",
  });
}
