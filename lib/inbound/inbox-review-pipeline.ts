// lib/inbound/inbox-review-pipeline.ts
// Shared pipeline for Gmail inbox review + summarization (SIMPLIFIED)
//
// Used by:
// - /api/os/inbound/gmail-inbox-review
// - /api/os/inbound/gmail-inbox-review-opportunity
//
// Behavior (SIMPLIFIED):
// 1. Create ONE Inbox record representing the email (container record)
// 2. Extract work summary (one_liner, summary_bullets, category) with OpenAI
// 3. Update the same record with AI Work Summary and AI Work Category fields
//
// NOTE: No longer creates separate task records. One email = one Inbox record.

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
  // NOTE: Simplified workflow - no longer creates child task records
  // One email = one Inbox record with AI summary fields
}

/**
 * OpenAI response shape for inbox extraction (simplified)
 * Only extracts summary fields, no task breakdown
 */
interface InboxExtractionResponse {
  one_liner?: string;
  summary_bullets?: string[];
  category?: string;
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
  "Status": ["New", "Reviewed", "Promoted", "Archived"],
  "Disposition": ["New", "Logged", "Company Created", "Opportunity Created", "Duplicate", "Error"],
  "Source": ["Gmail", "Manual", "Slack", "Other"],
  "AI Work Category": ["Production", "Media Ops", "Reporting/Analytics", "Client Comms", "Project Management", "Finance/Billing", "Tech/Automation", "Other"],
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

  // Fallback: Return default with "Not specified" values
  console.log("[INBOX_REVIEW_PIPELINE] Failed to parse OpenAI response, using fallback");
  return {
    one_liner: "Not specified",
    summary_bullets: [],
    category: "Other",
  };
}

/**
 * DEPRECATED: Task-related functions no longer used in simplified workflow.
 * Kept for reference but not called.
 */
interface NormalizedInboxItem {
  title: string;
  description: string;
  status: string;
  disposition: string;
}

/**
 * DEPRECATED: No longer creates task records. Kept for reference.
 */
function coerceInboxItems(
  items: string[] | Array<{ title: string; description?: string; status?: string; disposition?: string }> | undefined
): NormalizedInboxItem[] {
  if (!Array.isArray(items)) {
    return [];
  }

  // Default values for backward compatibility
  const DEFAULT_STATUS = "New";
  const DEFAULT_DISPOSITION = "New";

  return items
    .map((item) => {
      // Legacy string format
      if (typeof item === "string") {
        const trimmed = item.trim();
        return trimmed.length > 0
          ? {
              title: trimmed,
              description: "",
              status: DEFAULT_STATUS,
              disposition: DEFAULT_DISPOSITION,
            }
          : null;
      }

      // Structured format { title, description?, status?, disposition? }
      if (typeof item === "object" && item !== null && "title" in item) {
        const title = typeof item.title === "string" ? item.title.trim() : "";
        const description = typeof item.description === "string" ? item.description.trim() : "";
        const status = typeof item.status === "string" ? item.status.trim() : DEFAULT_STATUS;
        const disposition = typeof item.disposition === "string" ? item.disposition.trim() : DEFAULT_DISPOSITION;
        return title.length > 0
          ? {
              title,
              description,
              status,
              disposition,
            }
          : null;
      }

      return null;
    })
    .filter((item): item is NormalizedInboxItem => item !== null);
}

/**
 * Coerce summary into string (handles both string and string[] formats)
 */
function coerceSummary(summary: string | string[] | undefined): string {
  if (typeof summary === "string") {
    return summary.trim();
  }
  if (Array.isArray(summary)) {
    return summary.filter((s) => typeof s === "string").join(" ").trim();
  }
  return "";
}

/**
 * Valid categories for AI Work Category
 */
const VALID_CATEGORIES = [
  "Production",
  "Media Ops",
  "Reporting/Analytics",
  "Client Comms",
  "Project Management",
  "Finance/Billing",
  "Tech/Automation",
  "Other",
] as const;

/**
 * Validate and normalize category
 */
function validateCategory(category: any): string {
  if (typeof category === "string") {
    const trimmed = category.trim();
    if (VALID_CATEGORIES.includes(trimmed as any)) {
      return trimmed;
    }
  }
  return "Other"; // Default fallback
}

/**
 * Coerce one_liner to string (max 140 chars)
 */
function coerceOneLiner(oneLiner: any): string {
  if (typeof oneLiner === "string") {
    const trimmed = oneLiner.trim();
    // Truncate to 140 chars if longer
    return trimmed.length > 140 ? trimmed.slice(0, 137) + "..." : trimmed;
  }
  return "Not specified";
}

/**
 * Coerce summary_bullets to array of strings
 */
function coerceSummaryBullets(bullets: any): string[] {
  if (Array.isArray(bullets)) {
    return bullets
      .filter((b) => typeof b === "string" && b.trim().length > 0)
      .map((b) => b.trim())
      .slice(0, 8); // Max 8 bullets
  }
  return [];
}

/**
 * Format AI Work Summary from one_liner and summary_bullets
 */
function formatAIWorkSummary(oneLiner: string, bullets: string[]): string {
  const parts: string[] = [];
  
  if (oneLiner && oneLiner !== "Not specified") {
    parts.push(oneLiner);
  }
  
  if (bullets.length > 0) {
    bullets.forEach((bullet) => {
      parts.push(`- ${bullet}`);
    });
  }
  
  return parts.join("\n") || "Not specified";
}

/**
 * Validate and normalize the extraction response (simplified - no tasks)
 */
function validateExtractionResponse(parsed: any): InboxExtractionResponse {
  const one_liner = coerceOneLiner(parsed.one_liner);
  const summary_bullets = coerceSummaryBullets(parsed.summary_bullets);
  const category = validateCategory(parsed.category);

  return {
    one_liner,
    summary_bullets,
    category,
  };
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
 * DEPRECATED: No longer creates task records. Kept for reference.
 * Normalize a single inbox item title to be glanceable (max 8 words)
 */
function normalizeInboxItemTitle(title: string): string | null {
  // Step 1: Trim and collapse whitespace
  let text = title.trim().replace(/\s+/g, " ");

  // Step 2: Split into words
  const words = text.split(/\s+/).filter((w) => w.length > 0);

  // Step 3: Remove filler words (but keep first word if it's a verb)
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

  // Step 4: Limit to first 8 words (increased from 5)
  const limited = filtered.slice(0, 8);

  // Step 5: If result is < 2 words, return null (will be dropped)
  if (limited.length < 2) {
    return null;
  }

  return limited.join(" ");
}

/**
 * DEPRECATED: No longer creates task records. Kept for reference.
 * Normalize all inbox items for task list display
 */
function normalizeInboxItems(
  items: NormalizedInboxItem[]
): NormalizedInboxItem[] {
  const seen = new Set<string>();
  const normalized: NormalizedInboxItem[] = [];
  const DEFAULT_STATUS = "New";
  const DEFAULT_DISPOSITION = "Task";

  for (const item of items) {
    const normalizedTitle = normalizeInboxItemTitle(item.title);

    if (normalizedTitle) {
      const key = normalizedTitle.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        normalized.push({
          title: normalizedTitle,
          description: item.description.trim(), // Preserve description, just trim
          status: item.status || DEFAULT_STATUS,
          disposition: item.disposition || DEFAULT_DISPOSITION,
        });
      }
    }
  }

  // Fallback if no valid items
  if (normalized.length === 0) {
    return [{ title: "Review email", description: "", status: DEFAULT_STATUS, disposition: DEFAULT_DISPOSITION }];
  }

  return normalized;
}

/**
 * Extract work summary from email using OpenAI (simplified - no tasks)
 * Returns JSON: { one_liner: string, summary_bullets: string[], category: string }
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

Analyze an inbound email and extract a concise work summary.
This summary will be stored on a single Inbox record for the email.

You MUST respond with STRICT JSON ONLY.
No markdown. No explanation. No commentary. JSON only.

────────────────────────
RESPONSE FORMAT
────────────────────────
{
  "one_liner": "Single sentence summary <= 140 characters describing the work to be done",
  "summary_bullets": [
    "Concrete bullet point 1 (no fluff, actionable)",
    "Concrete bullet point 2",
    "Concrete bullet point 3"
  ],
  "category": "Production|Media Ops|Reporting/Analytics|Client Comms|Project Management|Finance/Billing|Tech/Automation|Other"
}

────────────────────────
WORK SUMMARY REQUIREMENTS (MANDATORY)
────────────────────────
- one_liner: Maximum 140 characters. Single sentence describing what work needs to be done. Be specific and concrete.
- summary_bullets: Array of 2-8 bullet points. Each bullet should be:
  * Concrete and actionable (not vague)
  * No fluff or filler words
  * Focus on what needs to be done, not context
  * If information is missing, use "Not specified" rather than hallucinating
  * Include technical specs verbatim if present (e.g., "Resize Landscape Logo (4:1, rec 1200x300 px, min 512x128 px)")
- category: Must be exactly one of:
  * "Production" - Creative assets, designs, videos, graphics
  * "Media Ops" - Media buying, campaign management, ad operations
  * "Reporting/Analytics" - Reports, dashboards, data analysis
  * "Client Comms" - Client communication, meetings, updates
  * "Project Management" - Project planning, coordination, timelines
  * "Finance/Billing" - Invoicing, budgets, financial matters
  * "Tech/Automation" - Technical work, automation, integrations
  * "Other" - Use only if none of the above fit
- If category cannot be determined, use "Other"
- If one_liner cannot be determined, use "Not specified"
- If summary_bullets cannot be determined, use empty array []

────────────────────────
SPEC PRESERVATION RULE
────────────────────────
If the email contains technical specs (ratios, dimensions, sizes), preserve them VERBATIM in summary_bullets:
- Preserve all parentheses content verbatim: "(4:1, rec 1200x300 px, min 512x128 px)"
- Preserve ALL words exactly as written - do NOT truncate, abbreviate, or expand
- If source says "recommended", output "recommended" (NOT "rec")
- If source says "minimum", output "minimum" (NOT "min")
- If source says "rec", output "rec" (NOT "recommended")
- If source says "min", output "min" (NOT "minimum")
- Preserve all abbreviations: "rec", "min", "px" exactly as shown
- Preserve all full words: "recommended", "minimum", "recommended size", "minimum size" exactly as shown
- Preserve all spacing and punctuation
- Do NOT substitute words with abbreviations or vice versa
- Do NOT drop "px" units or any dimension values
- Do NOT rewrite or paraphrase - copy character-for-character
- ZERO word substitutions - copy every word exactly as it appears in the source

────────────────────────
GOOD EXAMPLES
────────────────────────
{
  "one_liner": "Resize logos and images for social media campaign",
  "summary_bullets": [
    "Resize Landscape Logo (4:1, rec 1200x300 px, min 512x128 px)",
    "Resize Square Logo (1:1, rec 1200x1200, min 128x128)",
    "Export Portrait Image (4:5, recommended 960x1200 px, minimum 480x600 px)"
  ],
  "category": "Production"
}

{
  "one_liner": "Schedule client meeting to discuss Q2 campaign performance",
  "summary_bullets": [
    "Schedule 30-minute meeting with client",
    "Prepare Q2 performance report",
    "Discuss campaign optimizations"
  ],
  "category": "Client Comms"
}

{
  "one_liner": "Update monthly analytics dashboard with latest metrics",
  "summary_bullets": [
    "Pull latest data from GA4",
    "Update dashboard visualizations",
    "Add new conversion tracking metrics"
  ],
  "category": "Reporting/Analytics"
}

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
${truncate(bodyText, 15000) || "—"}

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
 * Run the inbox review pipeline (simplified):
 *
 * 1. Create single Inbox record (Title = "EMAIL: {Subject}")
 * 2. Extract work summary (one_liner, summary_bullets, category) with OpenAI
 * 3. Update the same record with AI Work Summary and AI Work Category
 *
 * NOTE: Simplified workflow - no longer creates separate task records.
 * One email = one Inbox record with AI summary fields.
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
    // Trace ID removed - field no longer exists in Airtable
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

  console.log(
    "[INBOX_REVIEW_PIPELINE] AI extraction completed",
    safeLog({
      debugId,
      oneLiner: extraction.one_liner,
      bulletsCount: extraction.summary_bullets?.length || 0,
      category: extraction.category,
    })
  );

  // -------------------------------------------------------------------------
  // STEP 3: Update container record with AI work summary fields
  // -------------------------------------------------------------------------
  // Create a simple description from snippet (no longer using AI summary for Description field)
  const sourceDescription = `Email received from ${fromName || fromEmail || "unknown sender"}.\n\n**Snippet:**\n${truncate(snippet, 500)}`;

  // Format AI Work Summary from one_liner and summary_bullets
  const oneLiner = extraction.one_liner || "Not specified";
  const summaryBullets = extraction.summary_bullets || [];
  const aiWorkSummary = formatAIWorkSummary(oneLiner, summaryBullets);

  // Prepare AI Summary JSON for debugging (optional field)
  const aiSummaryJSON = JSON.stringify({
    one_liner: oneLiner,
    summary_bullets: summaryBullets,
    category: extraction.category || "Other",
  }, null, 2);

  console.log(
    "[INBOX_REVIEW_PIPELINE] AI work summary data",
    safeLog({
      debugId,
      oneLiner,
      bulletsCount: summaryBullets.length,
      bullets: summaryBullets,
      category: extraction.category,
      formattedSummary: aiWorkSummary,
      summaryLength: aiWorkSummary.length,
    })
  );

  const updateFields: Record<string, any> = {
    "Description": sourceDescription,
    "Status": "Reviewed",
    "Disposition": "Logged",
    // New AI work summary fields - ensure these are set
    "AI Work Summary": aiWorkSummary,
    "AI Work Category": extraction.category || "Other",
    "AI Summary JSON": aiSummaryJSON, // Optional: for debugging
  };

  // Log fields before sanitization to debug
  console.log(
    "[INBOX_REVIEW_PIPELINE] Container record update fields BEFORE sanitization",
    safeLog({
      debugId,
      sourceRecordId,
      fieldKeys: Object.keys(updateFields),
      aiWorkSummaryPresent: "AI Work Summary" in updateFields,
      aiWorkSummaryValue: updateFields["AI Work Summary"],
      aiWorkCategoryPresent: "AI Work Category" in updateFields,
      aiWorkCategoryValue: updateFields["AI Work Category"],
    })
  );

  const sanitizedUpdateFields = sanitizeInboxFields(updateFields);
  
  // Log fields after sanitization to debug
  console.log(
    "[INBOX_REVIEW_PIPELINE] Container record update fields AFTER sanitization",
    safeLog({
      debugId,
      sourceRecordId,
      fieldKeys: Object.keys(sanitizedUpdateFields),
      aiWorkSummaryPresent: "AI Work Summary" in sanitizedUpdateFields,
      aiWorkSummaryValue: sanitizedUpdateFields["AI Work Summary"],
      aiWorkCategoryPresent: "AI Work Category" in sanitizedUpdateFields,
      aiWorkCategoryValue: sanitizedUpdateFields["AI Work Category"],
      aiSummaryJSONPresent: "AI Summary JSON" in sanitizedUpdateFields,
    })
  );
  
  await airtableUpdateRecord(sourceRecordId, sanitizedUpdateFields, debugId);

  console.log(
    "[INBOX_REVIEW_PIPELINE] Container record updated with AI work summary",
    safeLog({
      debugId,
      sourceRecordId,
      oneLiner: extraction.one_liner,
      category: extraction.category,
      bulletsCount: extraction.summary_bullets?.length || 0,
      aiWorkSummaryWritten: "AI Work Summary" in sanitizedUpdateFields,
    })
  );

  // -------------------------------------------------------------------------
  // Return result (simplified - no child records)
  // -------------------------------------------------------------------------
  return {
    inboxItemId: sourceRecordId,
    summary: aiWorkSummary, // Return formatted summary instead of raw summary
  };
}
