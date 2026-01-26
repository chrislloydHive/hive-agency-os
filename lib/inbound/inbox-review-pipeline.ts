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
 * Normalize a linked record ID for Airtable Web API.
 * Airtable expects linked record fields as an array of record ID strings: ["recXXXXXXXXXXXXXX"]
 *
 * @param id - Record ID string, undefined, or null
 * @returns [] if invalid, [id] if valid record ID string
 */
function normalizeLinkedRecordId(id: string | undefined | null): string[] {
  if (typeof id !== "string" || !id.startsWith("rec")) {
    return [];
  }
  return [id];
}

/**
 * Extract ALL valid record IDs from a value (handles arrays, nested objects, etc.)
 * Returns an array of unique record ID strings.
 */
function extractAllRecordIds(value: any): string[] {
  const ids: string[] = [];

  if (!value) return ids;

  // Case 1: String starting with "rec"
  if (typeof value === "string" && value.startsWith("rec")) {
    ids.push(value);
    return ids;
  }

  // Case 2: Array - extract from all elements
  if (Array.isArray(value)) {
    for (const item of value) {
      ids.push(...extractAllRecordIds(item));
    }
    return [...new Set(ids)]; // dedupe
  }

  // Case 3: Object
  if (typeof value === "object" && value !== null) {
    const id = value.id;

    // Direct id property is a string
    if (typeof id === "string" && id.startsWith("rec")) {
      ids.push(id);
    }
    // Nested { id: { id: "recXXX" } }
    else if (typeof id === "object" && id !== null) {
      ids.push(...extractAllRecordIds(id));
    }
  }

  return [...new Set(ids)]; // dedupe
}

/**
 * Check if a value "looks like" a linked record (or array of linked records).
 * Returns true if the value contains structure that suggests it's a linked record.
 */
function looksLikeLinkedRecord(value: any): boolean {
  if (!value) return false;

  // String starting with "rec" = linked record ID
  if (typeof value === "string" && value.startsWith("rec")) {
    return true;
  }

  // Array of items that look like linked records
  if (Array.isArray(value)) {
    return value.some((item) => looksLikeLinkedRecord(item));
  }

  // Object with `id` property (Airtable record or linked record reference)
  if (typeof value === "object" && value !== null) {
    if ("id" in value) {
      const id = value.id;
      // id is a rec string
      if (typeof id === "string" && id.startsWith("rec")) {
        return true;
      }
      // id is an object (nested)
      if (typeof id === "object" && id !== null) {
        return looksLikeLinkedRecord(id);
      }
    }
  }

  return false;
}

/**
 * Check if a value would stringify to "[object Object]" if coerced to string.
 * This helps identify problematic fields before sending to Airtable.
 */
function wouldStringifyToObjectObject(value: any): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value !== "object") return false;
  if (Array.isArray(value)) return false;

  // Plain object would stringify to "[object Object]"
  return String(value) === "[object Object]";
}

/**
 * Get a compact preview of a value for logging.
 */
function compactPreview(value: any, maxLen: number = 100): string {
  try {
    const str = JSON.stringify(value);
    if (str.length > maxLen) {
      return str.slice(0, maxLen) + "...";
    }
    return str;
  } catch {
    return String(value).slice(0, maxLen);
  }
}

/**
 * GENERIC sanitizer that walks through EVERY field and normalizes any value
 * that looks like a linked record into Airtable Web API format: ["recXXX"]
 *
 * If a field looks like a linked record but contains no valid "rec" IDs,
 * it is REMOVED from the payload.
 *
 * Primitive types (strings that aren't rec IDs, numbers, booleans) are left alone.
 */
function sanitizeAllLinkedRecordFields(
  fields: Record<string, any>,
  debugId: string,
  recordLabel: string
): Record<string, any> {
  const sanitized: Record<string, any> = {};
  const suspectFields: Array<{ field: string; reason: string; preview: string }> = [];
  const removedFields: string[] = [];
  const normalizedFields: string[] = [];

  for (const [fieldName, value] of Object.entries(fields)) {
    // Skip null/undefined
    if (value === null || value === undefined) {
      continue;
    }

    // Check if this value looks like a linked record
    if (looksLikeLinkedRecord(value)) {
      const extractedIds = extractAllRecordIds(value);

      if (extractedIds.length > 0) {
        // Normalize to Airtable Web API format: ["recXXX", ...]
        sanitized[fieldName] = extractedIds;
        normalizedFields.push(fieldName);
      } else {
        // Looks like linked record but no valid IDs - remove it
        removedFields.push(fieldName);
        suspectFields.push({
          field: fieldName,
          reason: "looks like linked record but no valid rec IDs",
          preview: compactPreview(value),
        });
      }
    }
    // Check if it's an object that would stringify to "[object Object]"
    else if (wouldStringifyToObjectObject(value)) {
      // This is a problem - object in a non-linked-record field
      removedFields.push(fieldName);
      suspectFields.push({
        field: fieldName,
        reason: "object would stringify to [object Object]",
        preview: compactPreview(value),
      });
    }
    // Check if it's an array containing objects
    else if (Array.isArray(value) && value.some((item) => wouldStringifyToObjectObject(item))) {
      // Array contains objects that aren't linked records
      removedFields.push(fieldName);
      suspectFields.push({
        field: fieldName,
        reason: "array contains objects that would stringify to [object Object]",
        preview: compactPreview(value),
      });
    }
    // Safe value - keep as-is
    else {
      sanitized[fieldName] = value;
    }
  }

  // Log suspect fields
  if (suspectFields.length > 0) {
    console.warn(
      `[INBOX_REVIEW_PIPELINE] ${recordLabel} SUSPECT FIELDS DETECTED:`,
      JSON.stringify(suspectFields, null, 2)
    );
  }

  // Log removed fields
  if (removedFields.length > 0) {
    console.warn(
      `[INBOX_REVIEW_PIPELINE] ${recordLabel} REMOVED FIELDS:`,
      removedFields.join(", ")
    );
  }

  // Log normalized fields
  if (normalizedFields.length > 0) {
    console.log(
      `[INBOX_REVIEW_PIPELINE] ${recordLabel} NORMALIZED LINKED FIELDS:`,
      normalizedFields.join(", ")
    );
  }

  return sanitized;
}

/**
 * Scan fields for potential problems and log detailed diagnostics.
 */
function logFieldDiagnostics(
  fields: Record<string, any>,
  recordIdx: number,
  label: string
): void {
  console.log(`[INBOX_REVIEW_PIPELINE] ${label} Record ${recordIdx} field diagnostics:`);

  for (const [fieldName, value] of Object.entries(fields)) {
    const typeOf = typeof value;
    const isArray = Array.isArray(value);
    const wouldBeObjectObject = wouldStringifyToObjectObject(value);
    const looksLinked = looksLikeLinkedRecord(value);

    if (typeOf === "object" && value !== null) {
      console.log(
        `  - "${fieldName}": type=${typeOf}, isArray=${isArray}, wouldBeObjectObject=${wouldBeObjectObject}, looksLinked=${looksLinked}, preview=${compactPreview(value, 80)}`
      );
    }
  }
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

// ============================================================================
// Inbox Item Normalizer
// ============================================================================

/**
 * Filler words to remove from inbox items
 */
const FILLER_WORDS = new Set([
  "the", "a", "an", "to", "for", "with", "on", "of", "and", "or",
  "in", "at", "by", "from", "up", "about", "into", "over", "after",
  "is", "are", "was", "were", "be", "been", "being",
  "has", "have", "had", "do", "does", "did",
  "this", "that", "these", "those",
  "it", "its", "their", "our", "your",
]);

/**
 * Normalize a single inbox item to be glanceable (3-5 words max)
 *
 * Transformations:
 * - Trim whitespace
 * - Remove all punctuation
 * - Split into words
 * - Remove filler words
 * - Limit to first 5 words
 *
 * @returns normalized item or null if too short (< 2 words)
 */
function normalizeInboxItem(item: string): string | null {
  // Step 1: Trim and lowercase for processing
  let text = item.trim();

  // Step 2: Remove all punctuation
  text = text.replace(/[^\w\s]/g, "");

  // Step 3: Split into words
  const words = text.split(/\s+/).filter((w) => w.length > 0);

  // Step 4: Remove filler words (but keep first word if it's a verb)
  const filtered: string[] = [];
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const wordLower = word.toLowerCase();

    // Always keep the first word (should be the verb)
    if (i === 0) {
      // Capitalize first letter of first word
      filtered.push(word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
    } else if (!FILLER_WORDS.has(wordLower)) {
      // Keep non-filler words, preserve original case but lowercase
      filtered.push(word.toLowerCase());
    }
  }

  // Step 5: Limit to first 5 words
  const limited = filtered.slice(0, 5);

  // Step 6: If result is < 2 words, return null (will be dropped)
  if (limited.length < 2) {
    return null;
  }

  return limited.join(" ");
}

/**
 * Normalize all inbox items for glanceable task list display
 *
 * - Normalizes each item (removes punctuation, filler words, limits to 5 words)
 * - Drops items with < 2 words
 * - Deduplicates (case-insensitive)
 * - Falls back to ["Review email"] if no valid items remain
 */
function normalizeInboxItems(items: string[]): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const item of items) {
    const norm = normalizeInboxItem(item);

    if (norm) {
      const key = norm.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        normalized.push(norm);
      }
    }
  }

  // Fallback if no valid items
  if (normalized.length === 0) {
    return ["Review email"];
  }

  return normalized;
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
You are "Inbox GPT" for Hive OS.

Analyze an inbound email and extract actionable inbox items.
These items will appear as task-like records in a productivity inbox.
They must be extremely short, glanceable, and command-style.

You MUST respond with STRICT JSON ONLY.
No markdown. No explanation. No commentary. JSON only.

────────────────────────
RESPONSE FORMAT
────────────────────────
{
  "summary": "A concise 1–3 sentence summary of the email intent and key points",
  "inbox_items": [
    "Verb noun noun",
    "Verb noun"
  ]
}

────────────────────────
HARD RULES FOR inbox_items (MANDATORY)
────────────────────────
- 3–5 words MAXIMUM per item (hard cap)
- Verb-first imperative phrasing ONLY
- NO punctuation of any kind
- NO filler words:
  (the, a, an, to, for, with, on, of, and, or, whether, please, etc)

────────────────────────
VERB WHITELIST (PREFER THESE)
────────────────────────
Use one of these verbs whenever possible:

Approve
Review
Confirm
Decide
Send
Provide
Update
Schedule
Share
Request
Prepare
Finalize
Check
Align
Discuss

Avoid inventing new verbs unless absolutely necessary.

────────────────────────
DEDUPLICATION RULE
────────────────────────
If multiple actions are similar, collapse them into ONE item.
Prefer the most decisive verb (Approve > Review > Discuss).

────────────────────────
GOOD EXAMPLES
────────────────────────
- Approve revised budget
- Confirm GTM installed
- Decide audio launch
- Review social display
- Send asset update
- Schedule intro call
- Provide campaign assets
- Update IO

────────────────────────
EMAIL CONTEXT
────────────────────────
Subject: ${subject || "—"}
From: ${fromName ? `${fromName} <${fromEmail}>` : fromEmail || "—"}
Received At: ${receivedAt || "—"}
Gmail URL: ${gmailUrl || "—"}

Snippet:
${truncate(snippet, 800) || "—"}

Body:
${truncate(bodyText, 8000) || "—"}

────────────────────────
FINAL INSTRUCTION
────────────────────────
Respond with JSON ONLY.
No prose. No explanation. No extra keys.
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
  const rawInboxItems = extraction.inbox_items;

  console.log(
    "[INBOX_REVIEW_PIPELINE] raw extraction",
    safeLog({ debugId, summaryLength: summary.length, rawItemCount: rawInboxItems.length, rawItems: rawInboxItems })
  );

  // -------------------------------------------------------------------------
  // STEP 2.5: Normalize inbox items for glanceable display
  // -------------------------------------------------------------------------
  // Removes punctuation, filler words, limits to 5 words max
  // Deduplicates and falls back to ["Review email"] if empty
  const inbox_items = normalizeInboxItems(rawInboxItems);

  console.log(
    "[INBOX_REVIEW_PIPELINE] normalized items",
    safeLog({ debugId, normalizedCount: inbox_items.length, items: inbox_items })
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

  const childRecordsFields: Record<string, any>[] = inbox_items.map((itemTitle, idx) => {
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

    // Log BEFORE sanitization to see raw fields
    console.log(`[INBOX_REVIEW_PIPELINE] CHILD ${idx} BEFORE sanitization:`);
    logFieldDiagnostics(childFields, idx, "BEFORE");

    // Apply sanitizers:
    // 1. sanitizeInboxFields - removes forbidden fields, validates select values
    const afterInboxSanitize = sanitizeInboxFields(childFields);

    // 2. sanitizeAllLinkedRecordFields - GENERIC sanitizer for ALL fields
    //    Normalizes any linked-record-like values, removes problematic objects
    const fullySanitized = sanitizeAllLinkedRecordFields(
      afterInboxSanitize,
      debugId,
      `CHILD ${idx}`
    );

    // Log AFTER sanitization
    console.log(`[INBOX_REVIEW_PIPELINE] CHILD ${idx} AFTER sanitization:`);
    logFieldDiagnostics(fullySanitized, idx, "AFTER");

    return fullySanitized;
  });

  // FINAL CHECK: Scan all records for any remaining objects that would cause issues
  // Airtable Web API expects linked record fields as string arrays ["recXXX"], not object arrays
  console.log("[INBOX_REVIEW_PIPELINE] FINAL CHECK - scanning for problematic fields:");
  childRecordsFields.forEach((fields, idx) => {
    for (const [fieldName, value] of Object.entries(fields)) {
      if (wouldStringifyToObjectObject(value)) {
        console.error(
          `[INBOX_REVIEW_PIPELINE] CRITICAL: Record ${idx} field "${fieldName}" is STILL an object!`,
          compactPreview(value)
        );
      }
      if (Array.isArray(value)) {
        value.forEach((item, itemIdx) => {
          // Linked record arrays should contain strings only, not objects
          if (wouldStringifyToObjectObject(item)) {
            console.error(
              `[INBOX_REVIEW_PIPELINE] CRITICAL: Record ${idx} field "${fieldName}"[${itemIdx}] is an object (should be string for linked records)!`,
              compactPreview(item)
            );
          }
        });
      }
    }
  });

  // Log final payload
  console.log(
    "[INBOX_REVIEW_PIPELINE] FINAL PAYLOAD for batch create:",
    JSON.stringify(childRecordsFields, null, 2)
  );

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
