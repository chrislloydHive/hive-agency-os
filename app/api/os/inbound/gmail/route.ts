import { NextResponse } from "next/server";
import { getOpportunitiesTableName, getActivitiesTableName, validateAirtableConfig } from "@/lib/airtable/config";

/**
 * Gmail Inbound Endpoint
 * POST /api/os/inbound/gmail
 *
 * Creates or attaches Opportunities by Gmail Thread ID.
 * Links Activities to Opportunities.
 *
 * Uses existing Hive OS table mappings:
 * - Opportunities: AIRTABLE_OPPORTUNITIES_TABLE (default: "Opportunities")
 * - Activities: AIRTABLE_ACTIVITIES_TABLE (default: "Activities")
 * - Companies: "Companies"
 */

// ============================================================================
// Config - Aligned with existing lib/airtable mappings
// ============================================================================

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY!;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID!;
const HIVE_INBOUND_EMAIL_SECRET = process.env.HIVE_INBOUND_EMAIL_SECRET!;

// Table names - use centralized config helpers
const TABLE_COMPANIES = "Companies";
const TABLE_ACTIVITIES = getActivitiesTableName();
const TABLE_OPPORTUNITIES = getOpportunitiesTableName();

// ============================================================================
// Known Airtable Fields (defensive - strip unknown keys before write)
// ============================================================================

const KNOWN_COMPANY_FIELDS = new Set([
  'Company Name',
  'Domain',
  'Website',
  'Industry',
  'Company Type',
  'Stage',
  'Owner',
  'Notes',
  'Primary Contact Name',
  'Primary Contact Email',
  'Source',
  'Company ID',
]);

const KNOWN_ACTIVITY_FIELDS = new Set([
  'Title',
  'Type',
  'Direction',
  'Source',
  'Subject',
  'From Name',
  'From Email',
  'To',
  'CC',
  'Snippet',
  'Body Text',
  'Received At',
  'External Message ID',
  'External Thread ID',
  'External URL',
  'Raw Payload (JSON)',
  'Opportunities',
  'Company',
]);

const KNOWN_OPPORTUNITY_FIELDS = new Set([
  'Deliverable Name',
  'Stage',
  'Company',
  'Rep Notes',
  'Value',
  'Close Date',
  'Owner',
]);

/**
 * Filter fields to only include known Airtable fields
 */
function filterKnownFields(
  fields: Record<string, unknown>,
  knownFields: Set<string>
): Record<string, unknown> {
  const filtered: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (knownFields.has(key)) {
      filtered[key] = value;
    } else {
      console.warn(`[GMAIL_INBOUND] Stripping unknown field: ${key}`);
    }
  }
  return filtered;
}

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
      // Check if this activity has a linked Opportunities
      const oppLinks = existingActivity.fields["Opportunities"] as string[] | undefined;

      if (oppLinks?.[0]) {
        // Fetch the linked Opportunity record
        const oppRecord = await airtableRequest<AirtableRecord>(
          "GET",
          TABLE_OPPORTUNITIES,
          `/${oppLinks[0]}`
        );

        return NextResponse.json({
          status: "duplicate",
          opportunity: {
            id: oppRecord.id,
            name: oppRecord.fields?.["Deliverable Name"] || "Email Opportunity",
            stage: oppRecord.fields?.Stage || "Discovery",
            url: null,
          },
          activity: { id: existingActivity.id },
        });
      }

      // No linked opportunity - return activity only
      return NextResponse.json({
        status: "duplicate",
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
      company = await createRecord(
        TABLE_COMPANIES,
        filterKnownFields(
          {
            'Company Name': domainToCompanyName(domain),
            Domain: domain,
          },
          KNOWN_COMPANY_FIELDS
        )
      );
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
      const oppLinks = threadActivity.fields["Opportunities"] as string[] | undefined;
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

      opportunity = await createRecord(
        TABLE_OPPORTUNITIES,
        filterKnownFields(
          {
            "Deliverable Name": oppName,
            Stage: "Discovery",
            Company: [company.id],
            "Rep Notes": `Created from Gmail\nFrom: ${from.email}\nThread: ${gmailThreadId}`,
          },
          KNOWN_OPPORTUNITY_FIELDS
        )
      );
    }

    // -------------------------------------------------------------------------
    // Activity: Create linked to Company and Opportunity
    // Field names from lib/airtable/activities.ts mapping
    // Primary field is "Title" (NOT "Name")
    // -------------------------------------------------------------------------
    const activityTitle = subject?.trim() || snippet?.slice(0, 50) || "Inbound email";

    const activity = await createRecord(
      TABLE_ACTIVITIES,
      filterKnownFields(
        {
          // Core fields - Title is primary field
          Title: `Email: ${activityTitle}`,
          Type: "email",
          Direction: direction,
          Source: "gmail-addon",

          // Links
          Opportunities: [opportunity.id],
          Company: [company.id],

          // Email content fields
          Subject: subject || "",
          "From Name": from.name || "",
          "From Email": from.email,
          To: to.join(", "),
          CC: cc.join(", "),
          Snippet: snippet || "",
          "Body Text": bodyText ? bodyText.slice(0, 10000) : "",

          // External IDs (correct field names from mapping)
          "External Message ID": gmailMessageId,
          "External Thread ID": gmailThreadId,
          "External URL": gmailUrl,

          // Timestamp
          "Received At": receivedAt,

          // Debug payload
          "Raw Payload (JSON)": JSON.stringify(payload),
        },
        KNOWN_ACTIVITY_FIELDS
      )
    );

    // -------------------------------------------------------------------------
    // Response
    // -------------------------------------------------------------------------
    return NextResponse.json({
      status: isNewOpportunity ? "success" : "attached",
      company: {
        id: company.id,
        name: company.fields?.['Company Name'] || company.fields?.Name || domainToCompanyName(domain),
        domain: company.fields?.Domain || domain,
        isNew: !company.fields?.['Company Name'] && !company.fields?.Name,
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
