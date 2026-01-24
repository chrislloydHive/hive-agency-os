import { NextResponse } from "next/server";

/**
 * Gmail Inbox Review Endpoint
 * POST /api/os/inbound/gmail-inbox-review
 *
 * Creates Inbox items from Gmail add-on for review.
 *
 * Required env vars:
 * - AIRTABLE_API_KEY
 * - AIRTABLE_OS_BASE_ID
 * - HIVE_INBOUND_SECRET
 *
 * Airtable contract:
 * - Base: AIRTABLE_OS_BASE_ID
 * - Table: Inbox
 * - Fields: Title, Source, Status, Trace ID, Gmail Message ID,
 *           Gmail Thread ID, Gmail URL, From Email, From Name, From Domain,
 *           Received At, Subject, Snippet, Body Text, Disposition, Description
 */

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY || "";
const AIRTABLE_OS_BASE_ID = process.env.AIRTABLE_OS_BASE_ID || "";
const HIVE_INBOUND_SECRET = process.env.HIVE_INBOUND_SECRET || "";

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
      "[GMAIL_INBOX_REVIEW_AIRTABLE_ERROR]",
      safeLog({ debugId, url, status: res.status, body: text })
    );
    const msg = json?.error?.message || json?.error || text || `Airtable error (${res.status})`;
    throw new Error(msg);
  }

  return json;
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

    // auth
    const secret = req.headers.get("x-hive-secret") || "";
    if (secret !== HIVE_INBOUND_SECRET) {
      return NextResponse.json({ ok: false, debugId, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));

    const subject = asStr(body.subject || "(No subject)").trim();
    const snippet = asStr(body.snippet || "").trim();
    const bodyText = asStr(body.bodyText || "").trim();

    const fromEmail = asStr(body?.from?.email || body?.fromEmail || "").trim();
    const fromName = asStr(body?.from?.name || body?.fromName || "").trim();
    const domain = extractDomain(fromEmail);

    const gmailThreadId = asStr(body.gmailThreadId || "").trim();
    const gmailMessageId = asStr(body.gmailMessageId || "").trim();
    const receivedAt = asStr(body.receivedAt || "").trim();
    const gmailUrl = asStr(body.gmailUrl || "").trim();

    console.log(
      "[GMAIL_INBOX_REVIEW] inbound",
      safeLog({ debugId, subject, fromEmail, gmailThreadId, gmailMessageId })
    );

    const description =
      `From: ${fromName ? `${fromName} <${fromEmail}>` : fromEmail}\n` +
      `Subject: ${subject}\n` +
      (gmailUrl ? `Gmail: ${gmailUrl}\n` : "") +
      (snippet ? `\nSnippet:\n${truncate(snippet, 600)}` : "");

    const fields: Record<string, any> = {
      "Title": subject || "(No subject)",
      "Source": "Inbound",
      "Status": "New",
      "Trace ID": debugId,

      "Gmail Message ID": gmailMessageId,
      "Gmail Thread ID": gmailThreadId,
      "Gmail URL": gmailUrl,

      "From Email": fromEmail,
      "From Name": fromName,
      "From Domain": domain,

      "Received At": receivedAt,
      "Subject": subject,
      "Snippet": truncate(snippet, 1000),
      "Body Text": truncate(bodyText, 10000),

      "Description": description,

      "Disposition": "Logged",
    };

    const created = await airtableCreateRecord(fields, debugId);
    const inboxRec = created?.records?.[0];

    console.log(
      "[GMAIL_INBOX_REVIEW] created",
      safeLog({ debugId, inboxItemId: inboxRec?.id })
    );

    return NextResponse.json({
      ok: true,
      status: "logged",
      inboxItem: { id: inboxRec?.id || null },
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
    description: "Gmail add-on - logs emails to Inbox for review",
  });
}
