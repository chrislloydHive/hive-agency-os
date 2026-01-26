import { NextResponse } from "next/server";
import { runInboxReviewPipeline, extractDomain } from "@/lib/inbound/inbox-review-pipeline";
import { findOrCreateCompanyByDomain, type CompanyRecord } from "@/lib/airtable/companies";
import { getAllOpportunities, createOpportunity, updateOpportunity } from "@/lib/airtable/opportunities";
import type { OpportunityItem } from "@/lib/types/pipeline";
import { createActivity, findActivityByExternalMessageId, type ActivitySource } from "@/lib/airtable/activities";
import { resolveOwnerPerson, type ResolvedOwner } from "@/lib/airtable/people";

/**
 * Gmail Inbox Review + Opportunity Endpoint
 * POST /api/os/inbound/gmail-inbox-review-opportunity
 *
 * Combined pipeline:
 * 1. Run inbox review (create inbox item + summarize)
 * 2. Resolve company from sender domain
 * 3. Find or create opportunity (attach-if-open else create)
 * 4. Log activity for tracking
 *
 * Required env vars:
 * - AIRTABLE_API_KEY
 * - AIRTABLE_OS_BASE_ID / AIRTABLE_BASE_ID
 * - HIVE_INBOUND_SECRET
 * - OPENAI_API_KEY
 *
 * Optional env vars:
 * - OPENAI_MODEL (default: "gpt-4o-mini")
 */

const HIVE_INBOUND_SECRET = process.env.HIVE_INBOUND_SECRET || "";
const AIRTABLE_OS_BASE_ID = process.env.AIRTABLE_OS_BASE_ID || process.env.AIRTABLE_BASE_ID || "";

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

// Personal email domains to block for company resolution
const PERSONAL_DOMAINS = [
  "gmail.com",
  "yahoo.com",
  "hotmail.com",
  "outlook.com",
  "icloud.com",
  "aol.com",
  "protonmail.com",
  "mail.com",
  "me.com",
  "live.com",
  "msn.com",
];

function isPersonalDomain(domain: string): boolean {
  return PERSONAL_DOMAINS.includes(domain.toLowerCase());
}

// Closed stages that indicate an opportunity is not "open"
const CLOSED_STAGES = ["won", "lost", "dormant"];

function isOpenOpportunity(opp: OpportunityItem): boolean {
  return !CLOSED_STAGES.includes(opp.stage);
}

// Build Airtable URL for record
// Format: https://airtable.com/{baseId}/{tableId}/{recordId}
// For generic URLs when we don't know the table ID, Airtable will redirect
function buildAirtableUrl(recordId: string, tableId?: string): string {
  if (tableId) {
    return `https://airtable.com/${AIRTABLE_OS_BASE_ID}/${tableId}/${recordId}`;
  }
  // Generic URL - Airtable handles routing
  return `https://airtable.com/${AIRTABLE_OS_BASE_ID}/rec/${recordId}`;
}

// Table IDs for known tables (can be overridden by env vars)
const INBOX_TABLE_ID = process.env.AIRTABLE_INBOX_TABLE_ID || "tblInbox";
const COMPANIES_TABLE_ID = process.env.AIRTABLE_COMPANIES_TABLE_ID || "tblCompanies";
const OPPORTUNITIES_TABLE_ID = process.env.AIRTABLE_OPPORTUNITIES_TABLE_ID || "tblOpportunities";

// ============================================================================
// Opportunity Resolution
// ============================================================================

/**
 * Find an open opportunity for a company
 * Returns the most recently created open opportunity
 */
async function findOpenOpportunityForCompany(
  companyRecordId: string
): Promise<OpportunityItem | null> {
  try {
    // Fetch all opportunities and filter client-side
    // This is more reliable than complex Airtable formulas
    const allOpps = await getAllOpportunities();

    const openOpps = allOpps
      .filter((opp) => {
        // Must be linked to this company
        if (opp.companyId !== companyRecordId) return false;
        // Must be open (not won/lost/dormant)
        return isOpenOpportunity(opp);
      })
      .sort((a, b) => {
        // Sort by created date descending (most recent first)
        const dateA = a.createdAt || "";
        const dateB = b.createdAt || "";
        return dateB.localeCompare(dateA);
      });

    return openOpps[0] || null;
  } catch (error) {
    console.error("[GMAIL_INBOX_REVIEW_OPP] Failed to find open opportunity:", error);
    return null;
  }
}

/**
 * Attach or create opportunity for a company
 * Returns { opportunity, action: "attached" | "created" }
 */
async function attachOrCreateOpportunity(params: {
  companyRecord: CompanyRecord;
  subject: string;
  gmailThreadId: string;
  debugId: string;
}): Promise<{
  opportunity: OpportunityItem;
  opportunityAction: "attached" | "created";
}> {
  const { companyRecord, subject, gmailThreadId, debugId } = params;

  // Step 1: Look for existing open opportunity
  const existingOpp = await findOpenOpportunityForCompany(companyRecord.id);

  if (existingOpp) {
    console.log(
      "[GMAIL_INBOX_REVIEW_OPP] found open opportunity",
      safeLog({ debugId, opportunityId: existingOpp.id, stage: existingOpp.stage })
    );

    // Update Last Activity At if the function supports it
    try {
      await updateOpportunity(existingOpp.id, {});
    } catch (e) {
      // Ignore update errors - just logging activity
    }

    return {
      opportunity: existingOpp,
      opportunityAction: "attached",
    };
  }

  // Step 2: No open opportunity - create new one
  console.log(
    "[GMAIL_INBOX_REVIEW_OPP] creating new opportunity",
    safeLog({ debugId, companyId: companyRecord.id, companyName: companyRecord.name })
  );

  const opportunityName = `${companyRecord.name} — ${subject || "Inbound Email"}`.slice(0, 120);

  const newOpp = await createOpportunity({
    companyId: companyRecord.id,
    name: opportunityName,
    stage: "interest_confirmed",
    source: "Gmail Inbound",
    opportunityType: "Inbound Interest",
    normalizedDomain: companyRecord.domain,
    nextStep: "Review email + respond",
  });

  if (!newOpp) {
    throw new Error("Failed to create opportunity");
  }

  console.log(
    "[GMAIL_INBOX_REVIEW_OPP] created opportunity",
    safeLog({ debugId, opportunityId: newOpp.id })
  );

  return {
    opportunity: newOpp,
    opportunityAction: "created",
  };
}

// ============================================================================
// Route Handler
// ============================================================================

export async function POST(req: Request) {
  const debugId = `dbg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  // Track partial results for error response
  let inboxResult: { inboxItemId: string; summary: string; childItemIds: string[] } | null = null;
  let tasksCreated = 0;

  try {
    // -------------------------------------------------------------------------
    // Auth
    // -------------------------------------------------------------------------
    if (!HIVE_INBOUND_SECRET) {
      throw new Error("Missing HIVE_INBOUND_SECRET");
    }

    const secret = req.headers.get("x-hive-secret") || "";
    if (secret !== HIVE_INBOUND_SECRET) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    // -------------------------------------------------------------------------
    // Parse payload
    // -------------------------------------------------------------------------
    const body = await req.json().catch(() => ({}));

    const subject = asStr(body.subject || "").trim() || "(No subject)";
    const snippet = asStr(body.snippet || body.body || "").trim();
    const bodyText = asStr(body.bodyText || body.body || "").trim();
    const fromEmail = asStr(body?.from?.email || body?.fromEmail || "").trim();
    const fromName = asStr(body?.from?.name || body?.fromName || "").trim();
    const fromDomain = extractDomain(fromEmail);
    const gmailThreadId = asStr(body.gmailThreadId || body.threadId || "").trim();
    const gmailMessageId = asStr(body.gmailMessageId || body.messageId || "").trim();
    const receivedAt = asStr(body.receivedAt || "").trim();
    const gmailUrl = asStr(body.gmailUrl || "").trim();

    console.log(
      "[GMAIL_INBOX_REVIEW_OPP] inbound",
      safeLog({ debugId, subject, fromEmail, fromDomain, gmailThreadId, gmailMessageId })
    );

    // -------------------------------------------------------------------------
    // Step A: Run Inbox Review Pipeline
    // -------------------------------------------------------------------------
    inboxResult = await runInboxReviewPipeline({
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
      "[GMAIL_INBOX_REVIEW_OPP] inbox review complete",
      safeLog({ debugId, inboxItemId: inboxResult.inboxItemId })
    );

    // -------------------------------------------------------------------------
    // Step B: Resolve Company + Find/Create Opportunity
    // -------------------------------------------------------------------------

    // Check for personal domain
    if (!fromDomain || isPersonalDomain(fromDomain)) {
      console.log(
        "[GMAIL_INBOX_REVIEW_OPP] personal domain - skipping opportunity",
        safeLog({ debugId, fromDomain })
      );

      return NextResponse.json({
        ok: true,
        status: "success",
        tasksCreated,
        inboxItem: {
          id: inboxResult.inboxItemId,
          url: buildAirtableUrl(inboxResult.inboxItemId, INBOX_TABLE_ID),
        },
        opportunityAction: "skipped" as const,
        summary: inboxResult.summary,
        reason: "personal_domain",
      });
    }

    // Resolve company
    console.log("[AIRTABLE_COMPANIES_CFG]", {
      base: (process.env.AIRTABLE_BASE_ID || "").slice(0, 6) + "…",
      token: (process.env.AIRTABLE_API_KEY || "").slice(0, 5) + "…",
      table: process.env.AIRTABLE_COMPANIES_TABLE || "Companies",
    });

    const { companyRecord, isNew: companyIsNew } = await findOrCreateCompanyByDomain(
      fromDomain,
      {
        companyName: undefined, // Let it derive from domain
        stage: "Prospect",
        source: "Inbound",
      }
    );

    console.log(
      "[GMAIL_INBOX_REVIEW_OPP] company resolved",
      safeLog({
        debugId,
        companyId: companyRecord.id,
        companyName: companyRecord.name,
        isNew: companyIsNew,
      })
    );

    // -------------------------------------------------------------------------
    // Step B.2: Idempotency Check - Has this message already been processed?
    // -------------------------------------------------------------------------
    if (gmailMessageId) {
      const existingActivity = await findActivityByExternalMessageId(
        "gmail-addon" as ActivitySource,
        gmailMessageId
      );

      if (existingActivity) {
        console.log(
          "[GMAIL_INBOX_REVIEW_OPP] activity already exists (dedupe)",
          safeLog({ debugId, activityId: existingActivity.activity.id, gmailMessageId })
        );

        // Return success with existing opportunity if available
        if (existingActivity.opportunityId) {
          return NextResponse.json({
            ok: true,
            status: "success",
            tasksCreated,
            opportunityAction: "attached" as const,
            opportunity: {
              id: existingActivity.opportunityId,
              url: buildAirtableUrl(existingActivity.opportunityId, OPPORTUNITIES_TABLE_ID),
            },
            company: {
              id: companyRecord.id,
              name: companyRecord.name,
              domain: companyRecord.domain,
              url: buildAirtableUrl(companyRecord.id, COMPANIES_TABLE_ID),
            },
            inboxItem: {
              id: inboxResult.inboxItemId,
              url: buildAirtableUrl(inboxResult.inboxItemId, INBOX_TABLE_ID),
            },
            summary: inboxResult.summary,
            deduped: true,
          });
        }
      }
    }

    // -------------------------------------------------------------------------
    // Step B.3: Find or Create Opportunity
    // -------------------------------------------------------------------------
    const { opportunity, opportunityAction } = await attachOrCreateOpportunity({
      companyRecord,
      subject,
      gmailThreadId,
      debugId,
    });

    // -------------------------------------------------------------------------
    // Step B.4: Create Activity for tracking
    // -------------------------------------------------------------------------
    const activity = await createActivity({
      opportunityId: opportunity.id,
      companyId: companyRecord.id,
      type: "email",
      direction: "inbound",
      title: subject,
      subject,
      fromName,
      fromEmail,
      snippet,
      bodyText: bodyText.slice(0, 10000),
      receivedAt,
      source: "gmail-addon",
      externalMessageId: gmailMessageId,
      externalThreadId: gmailThreadId,
      externalUrl: gmailUrl,
    });

    if (activity) {
      console.log(
        "[GMAIL_INBOX_REVIEW_OPP] activity created",
        safeLog({ debugId, activityId: activity.id })
      );
    }

    // -------------------------------------------------------------------------
    // Step B.5: Resolve Owner (if opportunity has one)
    // -------------------------------------------------------------------------
    let resolvedOwner: ResolvedOwner | null = null;
    if (opportunity.owner) {
      // Try to resolve owner from the opportunity's owner field
      // This could be an email or a name depending on the Airtable schema
      resolvedOwner = await resolveOwnerPerson({
        name: opportunity.owner,
      });
    }

    // -------------------------------------------------------------------------
    // Return Response
    // -------------------------------------------------------------------------
    const opportunityUrl = buildAirtableUrl(opportunity.id, OPPORTUNITIES_TABLE_ID);
    const companyUrl = buildAirtableUrl(companyRecord.id, COMPANIES_TABLE_ID);
    const inboxUrl = buildAirtableUrl(inboxResult.inboxItemId, INBOX_TABLE_ID);

    const response: Record<string, any> = {
      ok: true,
      status: "success",
      tasksCreated,
      opportunityAction,
      opportunity: {
        id: opportunity.id,
        name: opportunity.deliverableName || opportunity.companyName,
        stage: opportunity.stage,
        url: opportunityUrl,
      },
      company: {
        id: companyRecord.id,
        name: companyRecord.name,
        domain: companyRecord.domain,
        url: companyUrl,
      },
      inboxItem: {
        id: inboxResult.inboxItemId,
        url: inboxUrl,
      },
      summary: inboxResult.summary,
    };

    // Include owner only if resolved
    if (resolvedOwner) {
      response.owner = {
        id: resolvedOwner.id,
        name: resolvedOwner.name,
      };
    }

    return NextResponse.json(response);

  } catch (e: any) {
    console.error(
      "[GMAIL_INBOX_REVIEW_OPP_ERROR]",
      safeLog({ debugId, error: e?.message || String(e) })
    );

    // If inbox review succeeded but opportunity failed, return partial success
    if (inboxResult) {
      return NextResponse.json({
        ok: false,
        status: "partial",
        error: e?.message || String(e),
        tasksCreated,
        opportunityAction: "skipped" as const,
        inboxItem: {
          id: inboxResult.inboxItemId,
          url: buildAirtableUrl(inboxResult.inboxItemId, INBOX_TABLE_ID),
        },
        summary: inboxResult.summary,
        _config: {
          AIRTABLE_BASE_ID: (process.env.AIRTABLE_BASE_ID || "").slice(0, 8) || "(not set)",
          AIRTABLE_OS_BASE_ID: (process.env.AIRTABLE_OS_BASE_ID || "").slice(0, 8) || "(not set)",
          AIRTABLE_API_KEY: (process.env.AIRTABLE_API_KEY || "").slice(0, 6) || "(not set)",
        },
      });
    }

    return NextResponse.json(
      { ok: false, error: e?.message || String(e) },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    route: "os/inbound/gmail-inbox-review-opportunity",
    description: "Gmail add-on - inbox review + opportunity attach/create",
  });
}
