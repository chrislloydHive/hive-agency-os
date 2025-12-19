import { NextResponse } from "next/server";

/**
 * Gmail Inbound Endpoint
 * POST /api/os/inbound/gmail
 *
 * Creates or attaches Opportunities by Gmail Thread ID.
 * Links Activities to Opportunities.
 *
 * Uses existing Hive OS table mappings:
 * - Opportunities: "A-Lead Tracker" (AIRTABLE_OPPORTUNITIES_TABLE)
 * - Activities: "Activities" (AIRTABLE_ACTIVITIES_TABLE)
 * - Companies: "Companies"
 */

// ============================================================================
// Config - Aligned with existing lib/airtable mappings
// ============================================================================

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY!;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID!;
const HIVE_INBOUND_EMAIL_SECRET = process.env.HIVE_INBOUND_EMAIL_SECRET!;

// Table names - must match existing lib/airtable mappings
const TABLE_COMPANIES = "Companies";
const TABLE_ACTIVITIES = process.env.AIRTABLE_ACTIVITIES_TABLE || "Activities";
const TABLE_OPPORTUNITIES = process.env.AIRTABLE_OPPORTUNITIES_TABLE || "A-Lead Tracker";

// Personal email domains to block
const PERSONAL_DOMAINS = new Set([
  "gmail.com",
  "yahoo.com",
  "yahoo.co.uk",
  "hotmail.com",
  "hotmail.co.uk",
  "outlook.com",
  "live.com",
  "msn.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
  "zoho.com",
  "yandex.com",
  "mail.com",
  "gmx.com",
  "fastmail.com",
]);

// ============================================================================
// Types
// ============================================================================

interface GmailPayload {
  gmailMessageId: string;
  gmailThreadId: string;
  from: { email: string; name?: string | null };
  to?: string[];
  cc?: string[];
  subject?: string;
  snippet?: string;
  bodyText?: string;
  gmailUrl?: string;
  receivedAt: string;
  direction?: "inbound" | "outbound";
}

interface AirtableRecord {
  id: string;
  fields: Record<string, unknown>;
}

// ============================================================================
// Airtable REST Helpers
// ============================================================================

async function airtableRequest<T>(
  method: string,
  table: string,
  path: string = "",
  body?: Record<string, unknown>
): Promise<T> {
  const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(table)}${path}`;

  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${AIRTABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });

  const text = await response.text();

  if (!response.ok) {
    let errorMessage = `Airtable ${response.status}`;
    try {
      const errorJson = JSON.parse(text);
      errorMessage = errorJson?.error?.message || errorMessage;
    } catch {
      errorMessage = text || errorMessage;
    }
    throw new Error(errorMessage);
  }

  return (text ? JSON.parse(text) : null) as T;
}

async function findRecord(
  table: string,
  formula: string
): Promise<AirtableRecord | null> {
  const params = new URLSearchParams({
    maxRecords: "1",
    filterByFormula: formula,
  });

  const result = await airtableRequest<{ records: AirtableRecord[] }>(
    "GET",
    table,
    `?${params.toString()}`
  );

  return result.records?.[0] || null;
}

async function createRecord(
  table: string,
  fields: Record<string, unknown>
): Promise<AirtableRecord> {
  return airtableRequest<AirtableRecord>("POST", table, "", { fields });
}

// ============================================================================
// Helpers
// ============================================================================

function extractDomain(email: string): string {
  const parts = email.toLowerCase().trim().split("@");
  return parts.length === 2 ? parts[1] : "";
}

function domainToCompanyName(domain: string): string {
  if (!domain) return "Unknown Company";
  const name = domain.split(".")[0];
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function generateDebugId(): string {
  return `dbg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ============================================================================
// Route Handler
// ============================================================================

export async function POST(request: Request) {
  const debugId = generateDebugId();

  try {
    // -------------------------------------------------------------------------
    // Auth
    // -------------------------------------------------------------------------
    const secret =
      request.headers.get("x-hive-secret") ||
      request.headers.get("X-Hive-Secret");

    if (!secret || secret !== HIVE_INBOUND_EMAIL_SECRET) {
      return NextResponse.json(
        { status: "error", message: "Unauthorized", debugId },
        { status: 401 }
      );
    }

    // -------------------------------------------------------------------------
    // Parse payload
    // -------------------------------------------------------------------------
    const payload: GmailPayload = await request.json();

    const {
      gmailMessageId,
      gmailThreadId,
      from,
      to = [],
      cc = [],
      subject = "",
      snippet = "",
      bodyText = "",
      gmailUrl = "",
      receivedAt,
      direction = "inbound",
    } = payload;

    if (!gmailMessageId || !gmailThreadId || !from?.email) {
      return NextResponse.json(
        {
          status: "error",
          message: "Missing required fields: gmailMessageId, gmailThreadId, from.email",
          debugId,
        },
        { status: 400 }
      );
    }

    // -------------------------------------------------------------------------
    // Dedupe: Check if Activity already exists for this message
    // Field name: "External Message ID" (from lib/airtable/activities.ts)
    // -------------------------------------------------------------------------
    const existingActivity = await findRecord(
      TABLE_ACTIVITIES,
      `AND({Source} = "gmail-addon", {External Message ID} = "${gmailMessageId}")`
    );

    if (existingActivity) {
      return NextResponse.json({
        status: "duplicate",
        message: "This email has already been logged.",
        activity: { id: existingActivity.id },
      });
    }

    // -------------------------------------------------------------------------
    // Personal email guard
    // -------------------------------------------------------------------------
    const domain = extractDomain(from.email);

    if (!domain || PERSONAL_DOMAINS.has(domain)) {
      return NextResponse.json({
        status: "personal_email",
        message: `Cannot create opportunity from personal email: ${domain || "unknown"}`,
      });
    }

    // -------------------------------------------------------------------------
    // Company: Find or create by domain
    // -------------------------------------------------------------------------
    let company = await findRecord(
      TABLE_COMPANIES,
      `LOWER({Domain}) = "${domain.toLowerCase()}"`
    );

    if (!company) {
      company = await createRecord(TABLE_COMPANIES, {
        Name: domainToCompanyName(domain),
        Domain: domain,
      });
    }

    // -------------------------------------------------------------------------
    // Opportunity: Find by External Thread ID or create new
    // Check if any Activity in this thread is linked to an Opportunity
    // -------------------------------------------------------------------------
    let opportunity: AirtableRecord | null = null;
    let isNewOpportunity = false;

    // First, find existing activity in this thread that has an Opportunity link
    const threadActivity = await findRecord(
      TABLE_ACTIVITIES,
      `AND({Source} = "gmail-addon", {External Thread ID} = "${gmailThreadId}")`
    );

    if (threadActivity) {
      // Get the linked opportunity ID from the activity
      const oppLinks = threadActivity.fields["Opportunity"] as string[] | undefined;
      if (oppLinks?.[0]) {
        // Fetch the opportunity record
        const oppResult = await airtableRequest<AirtableRecord>(
          "GET",
          TABLE_OPPORTUNITIES,
          `/${oppLinks[0]}`
        );
        opportunity = oppResult;
      }
    }

    // If no opportunity found via thread, create a new one
    if (!opportunity) {
      isNewOpportunity = true;
      const oppName = subject?.trim() || "Email Opportunity";

      opportunity = await createRecord(TABLE_OPPORTUNITIES, {
        "Deliverable Name": oppName,
        Stage: "Discovery",
        Company: [company.id],
        "Rep Notes": `Created from Gmail\nFrom: ${from.email}\nThread: ${gmailThreadId}`,
      });
    }

    // -------------------------------------------------------------------------
    // Activity: Create linked to Company and Opportunity
    // Field names from lib/airtable/activities.ts mapping
    // -------------------------------------------------------------------------
    const activity = await createRecord(TABLE_ACTIVITIES, {
      // Core fields
      Type: "email",
      Direction: direction,
      Title: subject || "Inbound email",
      Source: "gmail-addon",

      // Links
      Opportunity: [opportunity.id],
      Company: [company.id],

      // Email content fields
      Subject: subject,
      "From Name": from.name || "",
      "From Email": from.email,
      To: to.join(", "),
      CC: cc.join(", "),
      Snippet: snippet,
      "Body Text": bodyText ? bodyText.slice(0, 10000) : "",

      // External IDs (correct field names from mapping)
      "External Message ID": gmailMessageId,
      "External Thread ID": gmailThreadId,
      "External URL": gmailUrl,

      // Timestamp
      "Received At": receivedAt,

      // Debug payload
      "Raw Payload (JSON)": JSON.stringify(payload),
    });

    // -------------------------------------------------------------------------
    // Response
    // -------------------------------------------------------------------------
    return NextResponse.json({
      status: isNewOpportunity ? "success" : "attached",
      company: {
        id: company.id,
        name: company.fields?.Name || domainToCompanyName(domain),
        domain: company.fields?.Domain || domain,
        isNew: !company.fields?.Name,
      },
      opportunity: {
        id: opportunity.id,
        name: opportunity.fields?.["Deliverable Name"] || subject || "Email Opportunity",
        stage: opportunity.fields?.Stage || "Discovery",
      },
      activity: {
        id: activity.id,
      },
    });
  } catch (err) {
    console.error("[GMAIL_INBOUND_ERROR]", {
      debugId,
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });

    return NextResponse.json(
      {
        status: "error",
        message: err instanceof Error ? err.message : "Internal server error",
        debugId,
      },
      { status: 500 }
    );
  }
}
