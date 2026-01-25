// lib/inbound/inbox-review-pipeline.ts
// Shared pipeline for Gmail inbox review + summarization
//
// Used by:
// - /api/os/inbound/gmail-inbox-review
// - /api/os/inbound/gmail-inbox-review-opportunity

// ============================================================================
// Types
// ============================================================================

export interface InboxReviewInput {
  subject: string;
  snippet: string;
  bodyText: string;
  fromEmail: string;
  fromName: string;
  fromDomain: string;
  gmailThreadId: string;
  gmailMessageId: string;
  receivedAt: string;
  gmailUrl: string;
  debugId: string;
}

export interface InboxReviewResult {
  inboxItemId: string;
  summary: string;
}

// ============================================================================
// Environment
// ============================================================================

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY || "";
const AIRTABLE_OS_BASE_ID = process.env.AIRTABLE_OS_BASE_ID || "";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

const INBOX_TABLE_NAME = "Inbox";

// ============================================================================
// Helpers
// ============================================================================

function asStr(v: any): string {
  return v === undefined || v === null ? "" : String(v);
}

function safeLog(obj: any): string {
  try {
    return JSON.stringify(obj, (_k, val) => {
      if (typeof val === "string" && val.length > 800) return val.slice(0, 800) + "...";
      return val;
    });
  } catch {
    return String(obj);
  }
}

function truncate(s: string, n: number): string {
  s = asStr(s);
  return s.length > n ? s.slice(0, n) + "..." : s;
}

export function extractDomain(email: string): string {
  const e = (email || "").toLowerCase().trim();
  const at = e.lastIndexOf("@");
  if (at === -1) return "";
  return e.slice(at + 1).replace(/>$/, "").trim();
}

// ============================================================================
// Inbox Field Sanitizers
// ============================================================================

const ALLOWED_INBOX_SELECT_VALUES: Record<string, string[]> = {
  "Status": ["New", "Reviewed"],
  "Disposition": ["New", "Logged"],
};

const FORBIDDEN_INBOX_FIELDS = [
  "Source",
  "Item Type",
  "People",
  "Company",
  "Opportunity",
  "Client",
  "Project",
];

function sanitizeInboxFields(fields: Record<string, any>): Record<string, any> {
  const sanitized: Record<string, any> = {};

  for (const [key, value] of Object.entries(fields)) {
    if (FORBIDDEN_INBOX_FIELDS.includes(key)) {
      continue;
    }

    if (key in ALLOWED_INBOX_SELECT_VALUES) {
      const allowed = ALLOWED_INBOX_SELECT_VALUES[key];
      if (!allowed.includes(value)) {
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
      "[INBOX_REVIEW_PIPELINE_AIRTABLE_CREATE_ERROR]",
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
      "[INBOX_REVIEW_PIPELINE_AIRTABLE_UPDATE_ERROR]",
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
    console.log("[INBOX_REVIEW_PIPELINE_OPENAI_ERROR]", safeLog({ debugId, status: res.status, body: text }));
    const msg = json?.error?.message || json?.error || text || `OpenAI error (${res.status})`;
    throw new Error(msg);
  }

  const content = json?.choices?.[0]?.message?.content;
  return asStr(content).trim();
}

// ============================================================================
// Main Pipeline
// ============================================================================

/**
 * Run the inbox review pipeline:
 * 1. Create Inbox record with safe fields
 * 2. Summarize with OpenAI
 * 3. Update record with summary + flip Status/Disposition
 *
 * @param input - Email data and debugId
 * @returns { inboxItemId, summary }
 */
export async function runInboxReviewPipeline(input: InboxReviewInput): Promise<InboxReviewResult> {
  const {
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
  } = input;

  // Validate env
  if (!AIRTABLE_API_KEY) throw new Error("Missing AIRTABLE_API_KEY");
  if (!AIRTABLE_OS_BASE_ID) throw new Error("Missing AIRTABLE_OS_BASE_ID");
  if (!OPENAI_API_KEY) throw new Error("Missing OPENAI_API_KEY");

  // Step 1: Create Inbox record
  const createFields: Record<string, any> = {
    "Title": subject || "(No subject)",
    "Subject": subject || "(No subject)",
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
  const inboxItemId = inboxRec?.id;

  if (!inboxItemId) {
    throw new Error("Failed to create Inbox record - no ID returned");
  }

  console.log(
    "[INBOX_REVIEW_PIPELINE] created",
    safeLog({ debugId, inboxItemId })
  );

  // Step 2: Summarize with OpenAI
  const summary = await openaiSummarizeEmail({
    subject: subject || "(No subject)",
    fromEmail,
    fromName,
    receivedAt,
    gmailUrl,
    snippet,
    bodyText,
    debugId,
  });

  console.log(
    "[INBOX_REVIEW_PIPELINE] summarized",
    safeLog({ debugId, inboxItemId, summaryLength: summary.length })
  );

  // Step 3: Update record with summary
  const updateFields: Record<string, any> = {
    "Description": summary,
    "Status": "Reviewed",
    "Disposition": "Logged",
  };

  const sanitizedUpdateFields = sanitizeInboxFields(updateFields);
  await airtableUpdateRecord(inboxItemId, sanitizedUpdateFields, debugId);

  console.log(
    "[INBOX_REVIEW_PIPELINE] updated",
    safeLog({ debugId, inboxItemId })
  );

  return {
    inboxItemId,
    summary,
  };
}
