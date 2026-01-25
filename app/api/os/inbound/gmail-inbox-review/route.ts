import { NextResponse } from "next/server";
import { runInboxReviewPipeline, extractDomain } from "@/lib/inbound/inbox-review-pipeline";

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

const HIVE_INBOUND_SECRET = process.env.HIVE_INBOUND_SECRET || "";

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

// ============================================================================
// Route Handler
// ============================================================================

export async function POST(req: Request) {
  const debugId = `dbg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  try {
    // env sanity
    if (!HIVE_INBOUND_SECRET) throw new Error("Missing HIVE_INBOUND_SECRET");

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

    // Run the shared inbox review pipeline
    const result = await runInboxReviewPipeline({
      subject,
      snippet,
      bodyText,
      fromEmail,
      fromName,
      fromDomain,
      gmailThreadId,
      gmailMessageId,
      receivedAt,
      gmailUrl,
      debugId,
    });

    console.log(
      "[GMAIL_INBOX_REVIEW] complete",
      safeLog({ debugId, inboxItemId: result.inboxItemId })
    );

    return NextResponse.json({
      ok: true,
      status: "summarized",
      inboxItem: { id: result.inboxItemId },
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
