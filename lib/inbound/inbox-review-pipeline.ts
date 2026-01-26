// lib/inbound/inbox-review-pipeline.ts
// Shared pipeline for Gmail inbox review + summarization
//
// Used by:
// - /api/os/inbound/gmail-inbox-review
// - /api/os/inbound/gmail-inbox-review-opportunity
//
// Behavior:
// 1. Create ONE "source" Inbox record representing the email itself
// 2. Extract actionable items with OpenAI (returns strict JSON)
// 3. Create child Inbox records for each actionable item, linked to source

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
  childItemIds: string[];
}

/**
 * OpenAI response shape for inbox extraction
 */
interface InboxExtractionResponse {
  summary: string;
  inbox_items: string[];
}

// ============================================================================
// Environment
// ============================================================================

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY || "";
const AIRTABLE_OS_BASE_ID = process.env.AIRTABLE_OS_BASE_ID || "";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

const INBOX_TABLE_NAME = "Inbox";

// Airtable batch limit
const AIRTABLE_BATCH_SIZE = 10;

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
// Linked Record ID Helper
// ============================================================================

/**
 * Normalize a linked record ID for Airtable REST API.
 * Airtable requires linked record fields as: [{ id: "recXXXXXXXXXXXXXX" }]
 *
 * @param id - Record ID string, undefined, or null
 * @returns [] if invalid, [{ id }] if valid record ID string
 */
function normalizeLinkedRecordId(id: string | undefined | null): Array<{ id: string }> {
  if (typeof id !== "string" || !id.startsWith("rec")) {
    return [];
  }
  return [{ id }];
}

/**
 * Extract a valid record ID string from various malformed inputs.
 * Handles cases where the value might be:
 * - A string "recXXX" → returns "recXXX"
 * - An object { id: "recXXX" } → returns "recXXX"
 * - An object { id: { id: "recXXX" } } → returns "recXXX"
 * - A full record object { id: "recXXX", fields: {...} } → returns "recXXX"
 * - An array [{ id: "recXXX" }] → returns "recXXX"
 *
 * @param value - Any value that might contain a record ID
 * @returns The extracted record ID string, or null if none found
 */
function extractRecordId(value: any): string | null {
  if (!value) return null;

  // Case 1: Already a valid string ID
  if (typeof value === "string" && value.startsWith("rec")) {
    return value;
  }

  // Case 2: Array - extract from first element
  if (Array.isArray(value) && value.length > 0) {
    return extractRecordId(value[0]);
  }

  // Case 3: Object with id property
  if (typeof value === "object" && value !== null) {
    const id = value.id;
    if (typeof id === "string" && id.startsWith("rec")) {
      return id;
    }
    // Case 4: Nested object { id: { id: "recXXX" } }
    if (typeof id === "object" && id !== null && typeof id.id === "string" && id.id.startsWith("rec")) {
      return id.id;
    }
  }

  return null;
}

// Known linked-record field names used in child Inbox records
const LINKED_RECORD_FIELDS = [
  "Source Inbox Item",
  // These are in FORBIDDEN list but adding for safety:
  "Company",
  "Opportunity",
  "Client",
  "Project",
  "People",
  "Owner",
  "Assignee",
];

/**
 * Sanitize linked-record fields in a fields object.
 * Ensures all linked-record fields are in the correct format: [{ id: "recXXX" }]
 * Removes invalid linked-record fields from the payload.
 *
 * @param fields - The fields object to sanitize
 * @returns Sanitized fields object
 */
function sanitizeLinkedRecordFields(fields: Record<string, any>): Record<string, any> {
  const sanitized: Record<string, any> = { ...fields };

  for (const fieldName of LINKED_RECORD_FIELDS) {
    if (fieldName in sanitized) {
      const value = sanitized[fieldName];
      const recordId = extractRecordId(value);

      if (recordId) {
        // Valid ID found - normalize to correct format
        sanitized[fieldName] = [{ id: recordId }];
      } else if (value !== undefined && value !== null) {
        // Invalid value - log and remove
        console.warn(
          "[INBOX_REVIEW_PIPELINE] Removing invalid linked-record field",
          JSON.stringify({ fieldName, value, typeOf: typeof value })
        );
        delete sanitized[fieldName];
      }
    }
  }

  return sanitized;
}

// ============================================================================
// Inbox Field Sanitizers
// ============================================================================

const ALLOWED_INBOX_SELECT_VALUES: Record<string, string[]> = {
  "Status": ["New", "Reviewed"],
  "Disposition": ["New", "Logged"],
  "Source": ["Gmail", "Manual", "Slack", "Other"],
};

// Fields that should NEVER be written by this pipeline
// (linked fields that are managed elsewhere)
const FORBIDDEN_INBOX_FIELDS = [
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

/**
 * Batch create multiple Inbox records
 * Respects Airtable's 10-record batch limit
 */
async function airtableCreateRecordsBatch(
  recordsFields: Record<string, any>[],
  debugId: string
): Promise<string[]> {
  const url = `https://api.airtable.com/v0/${AIRTABLE_OS_BASE_ID}/${encodeURIComponent(INBOX_TABLE_NAME)}`;
  const createdIds: string[] = [];

  // Process in batches of AIRTABLE_BATCH_SIZE
  for (let i = 0; i < recordsFields.length; i += AIRTABLE_BATCH_SIZE) {
    const batch = recordsFields.slice(i, i + AIRTABLE_BATCH_SIZE);
    const records = batch.map((fields) => ({ fields }));

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${AIRTABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ records }),
      cache: "no-store",
    });

    const text = await res.text();
    let json: any = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {}

    if (!res.ok) {
      // Detailed error logging for debugging Airtable 422 errors
      console.error("[INBOX_REVIEW_PIPELINE_AIRTABLE_BATCH_CREATE_ERROR] ================");
      console.error("[INBOX_REVIEW_PIPELINE_AIRTABLE_BATCH_CREATE_ERROR] URL:", url);
      console.error("[INBOX_REVIEW_PIPELINE_AIRTABLE_BATCH_CREATE_ERROR] HTTP Status:", res.status);
      console.error("[INBOX_REVIEW_PIPELINE_AIRTABLE_BATCH_CREATE_ERROR] Batch Index:", i);
      console.error("[INBOX_REVIEW_PIPELINE_AIRTABLE_BATCH_CREATE_ERROR] debugId:", debugId);
      console.error("[INBOX_REVIEW_PIPELINE_AIRTABLE_BATCH_CREATE_ERROR] FULL RESPONSE BODY:", text);
      console.error("[INBOX_REVIEW_PIPELINE_AIRTABLE_BATCH_CREATE_ERROR] PAYLOAD SENT:", JSON.stringify({ records }, null, 2));
      console.error("[INBOX_REVIEW_PIPELINE_AIRTABLE_BATCH_CREATE_ERROR] ================");

      // Extract detailed error info
      const errorType = json?.error?.type || "UNKNOWN";
      const errorMessage = json?.error?.message || json?.error || text || `Airtable error (${res.status})`;
      const errorField = json?.error?.field || "unknown";

      console.error("[INBOX_REVIEW_PIPELINE_AIRTABLE_BATCH_CREATE_ERROR] Error Type:", errorType);
      console.error("[INBOX_REVIEW_PIPELINE_AIRTABLE_BATCH_CREATE_ERROR] Error Field:", errorField);
      console.error("[INBOX_REVIEW_PIPELINE_AIRTABLE_BATCH_CREATE_ERROR] Error Message:", errorMessage);

      throw new Error(`Airtable batch create failed: ${errorType} - ${errorMessage} (field: ${errorField})`);
    }

    // Collect created record IDs
    const createdRecords = json?.records || [];
    for (const rec of createdRecords) {
      if (rec?.id) {
        createdIds.push(rec.id);
      }
    }
  }

  return createdIds;
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
// OpenAI Extraction (Strict JSON)
// ============================================================================

/**
 * Parse OpenAI response defensively
 * - Try JSON.parse first
 * - If that fails, try to extract JSON between first '{' and last '}'
 */
function parseOpenAIResponse(content: string): InboxExtractionResponse {
  const trimmed = content.trim();

  // Attempt 1: Direct JSON.parse
  try {
    const parsed = JSON.parse(trimmed);
    return validateExtractionResponse(parsed);
  } catch {
    // Continue to fallback
  }

  // Attempt 2: Extract JSON between first '{' and last '}'
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");

  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    const jsonSubstring = trimmed.slice(firstBrace, lastBrace + 1);
    try {
      const parsed = JSON.parse(jsonSubstring);
      return validateExtractionResponse(parsed);
    } catch {
      // Continue to default
    }
  }

  // Fallback: Return default with empty inbox_items
  console.log("[INBOX_REVIEW_PIPELINE] Failed to parse OpenAI response, using fallback");
  return {
    summary: trimmed || "Unable to summarize email.",
    inbox_items: [],
  };
}

/**
 * Validate and normalize the extraction response
 */
function validateExtractionResponse(parsed: any): InboxExtractionResponse {
  const summary = typeof parsed.summary === "string" ? parsed.summary : "";
  let inbox_items: string[] = [];

  if (Array.isArray(parsed.inbox_items)) {
    inbox_items = parsed.inbox_items
      .filter((item: any) => typeof item === "string" && item.trim().length > 0)
      .map((item: string) => item.trim());
  }

  return { summary, inbox_items };
}

/**
 * Extract summary and actionable items from email using OpenAI
 * Returns strict JSON: { summary: string, inbox_items: string[] }
 */
async function openaiExtractInboxItems(input: {
  subject: string;
  fromEmail: string;
  fromName: string;
  receivedAt: string;
  gmailUrl: string;
  snippet: string;
  bodyText: string;
  debugId: string;
}): Promise<InboxExtractionResponse> {
  const { subject, fromEmail, fromName, receivedAt, gmailUrl, snippet, bodyText, debugId } = input;

  const prompt = `
You are "Inbox GPT" for Hive OS. Analyze an inbound email and extract actionable items.

You MUST respond with STRICT JSON ONLY. No markdown, no explanation, just the JSON object.

Response format:
{
  "summary": "A 1-3 sentence summary of the email content and intent",
  "inbox_items": [
    "Action item 1 - single sentence starting with strong verb",
    "Action item 2 - single sentence starting with strong verb"
  ]
}

Rules for inbox_items:
- Each item must be a single sentence
- Each item must start with a strong verb: Review, Approve, Confirm, Provide, Decide, Send, Update, Schedule, Follow up, Respond, Create, Prepare, etc.
- Each item must represent a concrete action, decision, or follow-up
- Extract 1-5 items maximum
- If no clear action items exist, return an empty array []

Email context:
- Subject: ${subject || "—"}
- From: ${fromName ? `${fromName} <${fromEmail}>` : fromEmail || "—"}
- Received At: ${receivedAt || "—"}
- Gmail URL: ${gmailUrl || "—"}

Snippet:
${truncate(snippet, 800) || "—"}

Body:
${truncate(bodyText, 8000) || "—"}

Respond with JSON only:`.trim();

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: "You are a JSON-only assistant. You extract actionable items from emails. Respond with valid JSON only, no markdown or explanation.",
        },
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
  const contentStr = asStr(content).trim();

  console.log(
    "[INBOX_REVIEW_PIPELINE] OpenAI raw response",
    safeLog({ debugId, contentLength: contentStr.length, contentPreview: truncate(contentStr, 200) })
  );

  return parseOpenAIResponse(contentStr);
}

// ============================================================================
// Main Pipeline
// ============================================================================

/**
 * Run the inbox review pipeline:
 *
 * 1. Create SOURCE Inbox record (Title = "EMAIL: {Subject}")
 * 2. Extract actionable items with OpenAI
 * 3. Update source record with summary
 * 4. Create CHILD Inbox records for each actionable item (linked to source)
 *
 * @param input - Email data and debugId
 * @returns { inboxItemId, summary, childItemIds }
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

  // -------------------------------------------------------------------------
  // STEP 1: Create SOURCE Inbox record (the email itself)
  // -------------------------------------------------------------------------
  const sourceTitle = `EMAIL: ${subject || "(No subject)"}`;

  const sourceFields: Record<string, any> = {
    "Title": sourceTitle,
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
    "Trace ID": debugId,
    "Source": "Gmail",
    "Status": "New",
    "Disposition": "New",
  };

  const sanitizedSourceFields = sanitizeInboxFields(sourceFields);
  const sourceCreated = await airtableCreateRecord(sanitizedSourceFields, debugId);
  const sourceRec = sourceCreated?.records?.[0];
  const sourceRecordId = sourceRec?.id;

  if (!sourceRecordId) {
    throw new Error("Failed to create source Inbox record - no ID returned");
  }

  // Defensive assertion: sourceRecordId must be a string starting with "rec"
  if (typeof sourceRecordId !== "string" || !sourceRecordId.startsWith("rec")) {
    console.error(
      "[INBOX_REVIEW_PIPELINE] INVALID sourceRecordId - expected string starting with 'rec'",
      safeLog({ debugId, sourceRecordId, typeOf: typeof sourceRecordId, value: JSON.stringify(sourceRecordId) })
    );
    throw new Error(`Invalid sourceRecordId: expected string starting with 'rec', got ${typeof sourceRecordId}: ${JSON.stringify(sourceRecordId)}`);
  }

  console.log(
    "[INBOX_REVIEW_PIPELINE] SOURCE record created",
    safeLog({ debugId, sourceRecordId, title: sourceTitle })
  );

  // -------------------------------------------------------------------------
  // STEP 2: Extract actionable items with OpenAI
  // -------------------------------------------------------------------------
  const extraction = await openaiExtractInboxItems({
    subject: subject || "(No subject)",
    fromEmail,
    fromName,
    receivedAt,
    gmailUrl,
    snippet,
    bodyText,
    debugId,
  });

  const { summary } = extraction;
  let { inbox_items } = extraction;

  // If no actionable items extracted, create a default one
  if (inbox_items.length === 0) {
    inbox_items = ["Review email and determine next step"];
    console.log("[INBOX_REVIEW_PIPELINE] No inbox_items extracted, using default");
  }

  console.log(
    "[INBOX_REVIEW_PIPELINE] extracted",
    safeLog({ debugId, summaryLength: summary.length, inboxItemCount: inbox_items.length })
  );

  // -------------------------------------------------------------------------
  // STEP 3: Update SOURCE record with summary
  // -------------------------------------------------------------------------
  const sourceDescription = `${summary}\n\n---\n\n**Snippet:**\n${truncate(snippet, 500)}`;

  const updateFields: Record<string, any> = {
    "Description": sourceDescription,
    "Status": "Reviewed",
    "Disposition": "Logged",
  };

  const sanitizedUpdateFields = sanitizeInboxFields(updateFields);
  await airtableUpdateRecord(sourceRecordId, sanitizedUpdateFields, debugId);

  console.log(
    "[INBOX_REVIEW_PIPELINE] SOURCE record updated with summary",
    safeLog({ debugId, sourceRecordId })
  );

  // -------------------------------------------------------------------------
  // STEP 4: Create CHILD Inbox records for each actionable item
  // -------------------------------------------------------------------------

  // Use helper to safely format linked record ID
  const sourceInboxItemLink = normalizeLinkedRecordId(sourceRecordId);

  console.log(
    "[INBOX_REVIEW_PIPELINE] Preparing CHILD records with linked field",
    safeLog({ debugId, sourceRecordId, sourceInboxItemLink })
  );

  const childRecordsFields: Record<string, any>[] = inbox_items.map((itemTitle) => {
    const childFields: Record<string, any> = {
      "Title": itemTitle,
      "Description": summary,
      "Subject": subject || "(No subject)",
      "From Name": fromName,
      "From Email": fromEmail,
      "Gmail URL": gmailUrl,
      "Received At": receivedAt,
      "Trace ID": debugId,
      "Source": "Gmail",
      // Link to source record - using normalizeLinkedRecordId helper
      "Source Inbox Item": sourceInboxItemLink,
      "Status": "New",
      "Disposition": "New",
    };

    // Apply both sanitizers:
    // 1. sanitizeInboxFields - removes forbidden fields, validates select values
    // 2. sanitizeLinkedRecordFields - ensures linked-record fields are in correct format
    const sanitized = sanitizeInboxFields(childFields);
    return sanitizeLinkedRecordFields(sanitized);
  });

  // DEBUG: Log the exact payload being sent to Airtable (with linked fields highlighted)
  console.log("[INBOX_REVIEW_PIPELINE] DEBUG - CHILD records payload before batch create:");
  childRecordsFields.forEach((fields, idx) => {
    console.log(`[INBOX_REVIEW_PIPELINE] DEBUG - Record ${idx}:`, JSON.stringify(fields));
    // Specifically log linked-record fields
    if (fields["Source Inbox Item"]) {
      console.log(
        `[INBOX_REVIEW_PIPELINE] DEBUG - Record ${idx} "Source Inbox Item":`,
        JSON.stringify(fields["Source Inbox Item"]),
        "type:", typeof fields["Source Inbox Item"],
        "isArray:", Array.isArray(fields["Source Inbox Item"])
      );
    }
  });

  const childItemIds = await airtableCreateRecordsBatch(childRecordsFields, debugId);

  console.log(
    "[INBOX_REVIEW_PIPELINE] CHILD records created",
    safeLog({ debugId, sourceRecordId, childCount: childItemIds.length, childItemIds })
  );

  // -------------------------------------------------------------------------
  // Return result
  // -------------------------------------------------------------------------
  return {
    inboxItemId: sourceRecordId,
    summary,
    childItemIds,
  };
}
