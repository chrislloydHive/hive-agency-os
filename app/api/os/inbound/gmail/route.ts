import { NextResponse } from "next/server";
import { z } from "zod";

/**
 * ✅ Gmail Inbound Endpoint
 * POST /api/os/inbound/gmail
 *
 * Auth:
 * - Header: X-Hive-Secret must match process.env.HIVE_INBOUND_EMAIL_SECRET
 *
 * Storage:
 * - Airtable REST API (no internal libs required)
 *
 * Contract returned to add-on:
 * - { status: "success", opportunity, company, activity }
 * - { status: "duplicate", opportunity?, activity? }
 * - { status: "attached", opportunity, activity }
 * - { status: "personal_email", message }
 * - { status: "error", message, debugId?, details? }
 */

/* -------------------------------------------------------------------------- */
/* Env + Config                                                               */
/* -------------------------------------------------------------------------- */

const ENV = z
  .object({
    HIVE_INBOUND_EMAIL_SECRET: z.string().min(1),
    AIRTABLE_API_KEY: z.string().min(1),
    AIRTABLE_BASE_ID: z.string().min(1),

    // Optional overrides
    AIRTABLE_TABLE_COMPANIES: z.string().optional(),
    AIRTABLE_TABLE_OPPORTUNITIES: z.string().optional(),
    AIRTABLE_TABLE_ACTIVITIES: z.string().optional(),

    // Airtable field names (optional overrides)
    AIRTABLE_FIELD_COMPANY_NAME: z.string().optional(),
    AIRTABLE_FIELD_COMPANY_DOMAIN: z.string().optional(),

    AIRTABLE_FIELD_OPP_NAME: z.string().optional(),
    AIRTABLE_FIELD_OPP_STAGE: z.string().optional(),
    AIRTABLE_FIELD_OPP_COMPANY: z.string().optional(),
    AIRTABLE_FIELD_OPP_THREAD_ID: z.string().optional(),

    AIRTABLE_FIELD_ACTIVITY_OPP: z.string().optional(),
    AIRTABLE_FIELD_ACTIVITY_TYPE: z.string().optional(),
    AIRTABLE_FIELD_ACTIVITY_DIRECTION: z.string().optional(),
    AIRTABLE_FIELD_ACTIVITY_FROM: z.string().optional(),
    AIRTABLE_FIELD_ACTIVITY_TO: z.string().optional(),
    AIRTABLE_FIELD_ACTIVITY_SUBJECT: z.string().optional(),
    AIRTABLE_FIELD_ACTIVITY_SNIPPET: z.string().optional(),
    AIRTABLE_FIELD_ACTIVITY_BODY: z.string().optional(),
    AIRTABLE_FIELD_ACTIVITY_GMAIL_MESSAGE_ID: z.string().optional(),
    AIRTABLE_FIELD_ACTIVITY_GMAIL_THREAD_ID: z.string().optional(),
    AIRTABLE_FIELD_ACTIVITY_GMAIL_URL: z.string().optional(),
    AIRTABLE_FIELD_ACTIVITY_RECEIVED_AT: z.string().optional(),
  })
  .parse(process.env);

const TABLES = {
  companies: ENV.AIRTABLE_TABLE_COMPANIES || "Companies",
  opportunities: ENV.AIRTABLE_TABLE_OPPORTUNITIES || "Opportunities",
  activities: ENV.AIRTABLE_TABLE_ACTIVITIES || "Activities",
};

const FIELDS = {
  company: {
    name: ENV.AIRTABLE_FIELD_COMPANY_NAME || "Name",
    domain: ENV.AIRTABLE_FIELD_COMPANY_DOMAIN || "Domain",
  },
  opp: {
    name: ENV.AIRTABLE_FIELD_OPP_NAME || "Name",
    stage: ENV.AIRTABLE_FIELD_OPP_STAGE || "Stage",
    company: ENV.AIRTABLE_FIELD_OPP_COMPANY || "Company", // linked record
    threadId: ENV.AIRTABLE_FIELD_OPP_THREAD_ID || "Gmail Thread ID",
  },
  activity: {
    opp: ENV.AIRTABLE_FIELD_ACTIVITY_OPP || "Opportunity", // linked record
    type: ENV.AIRTABLE_FIELD_ACTIVITY_TYPE || "Type",
    direction: ENV.AIRTABLE_FIELD_ACTIVITY_DIRECTION || "Direction",
    from: ENV.AIRTABLE_FIELD_ACTIVITY_FROM || "From",
    to: ENV.AIRTABLE_FIELD_ACTIVITY_TO || "To",
    subject: ENV.AIRTABLE_FIELD_ACTIVITY_SUBJECT || "Subject",
    snippet: ENV.AIRTABLE_FIELD_ACTIVITY_SNIPPET || "Snippet",
    body: ENV.AIRTABLE_FIELD_ACTIVITY_BODY || "Body",
    gmailMessageId:
      ENV.AIRTABLE_FIELD_ACTIVITY_GMAIL_MESSAGE_ID || "Gmail Message ID",
    gmailThreadId:
      ENV.AIRTABLE_FIELD_ACTIVITY_GMAIL_THREAD_ID || "Gmail Thread ID",
    gmailUrl: ENV.AIRTABLE_FIELD_ACTIVITY_GMAIL_URL || "Gmail URL",
    receivedAt: ENV.AIRTABLE_FIELD_ACTIVITY_RECEIVED_AT || "Received At",
  },
};

// Domains you consider "personal" (block creating opportunities from)
const PERSONAL_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "yahoo.com",
  "outlook.com",
  "hotmail.com",
  "icloud.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
]);

/* -------------------------------------------------------------------------- */
/* Schema                                                                     */
/* -------------------------------------------------------------------------- */

const PayloadSchema = z.object({
  mode: z.enum(["create_or_attach", "log_only"]).default("create_or_attach"),

  gmailMessageId: z.string().min(1),
  gmailThreadId: z.string().min(1),

  from: z.object({
    email: z.string().min(1),
    name: z.string().nullable().optional(),
  }),

  to: z.array(z.string()).default([]),
  cc: z.array(z.string()).default([]),

  subject: z.string().default(""),
  snippet: z.string().default(""),
  bodyText: z.string().default(""),

  receivedAt: z.string().min(1), // ISO string
  gmailUrl: z.string().min(1),

  direction: z.enum(["inbound", "outbound"]).default("inbound"),
});

/* -------------------------------------------------------------------------- */
/* Airtable REST helpers                                                      */
/* -------------------------------------------------------------------------- */

type AirtableRecord<TFields extends Record<string, unknown>> = {
  id: string;
  createdTime?: string;
  fields: TFields;
};

function airtableUrl(tableName: string, query?: string) {
  const base = `https://api.airtable.com/v0/${ENV.AIRTABLE_BASE_ID}/${encodeURIComponent(
    tableName
  )}`;
  return query ? `${base}?${query}` : base;
}

async function airtableFetch<T>(
  url: string,
  init?: RequestInit
): Promise<T> {
  const resp = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${ENV.AIRTABLE_API_KEY}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });

  const text = await resp.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    // not JSON
  }

  if (!resp.ok) {
    const errorJson = json as { error?: { message?: string } } | null;
    throw new Error(
      `Airtable error ${resp.status}: ${
        errorJson?.error?.message || text || "Unknown"
      }`
    );
  }

  return json as T;
}

async function findFirstByFormula<TFields extends Record<string, unknown>>(
  table: string,
  formula: string
): Promise<AirtableRecord<TFields> | null> {
  const query = new URLSearchParams({
    maxRecords: "1",
    filterByFormula: formula,
  }).toString();

  const data = await airtableFetch<{ records: AirtableRecord<TFields>[] }>(
    airtableUrl(table, query)
  );

  return data.records?.[0] || null;
}

async function createRecord<TFields extends Record<string, unknown>>(
  table: string,
  fields: TFields
): Promise<AirtableRecord<TFields>> {
  const data = await airtableFetch<AirtableRecord<TFields>>(airtableUrl(table), {
    method: "POST",
    body: JSON.stringify({ fields }),
  });
  return data;
}

/* -------------------------------------------------------------------------- */
/* Business logic                                                             */
/* -------------------------------------------------------------------------- */

function getDomain(email: string): string {
  const parts = (email || "").toLowerCase().split("@");
  return parts.length === 2 ? parts[1].trim() : "";
}

function companyNameFromDomain(domain: string): string {
  if (!domain) return "Unknown Company";
  const root = domain.split(".")[0] || domain;
  return root.charAt(0).toUpperCase() + root.slice(1);
}

function safeJsonError(err: unknown) {
  if (err instanceof Error) {
    return { message: err.message, stack: err.stack };
  }
  return { message: String(err) };
}

/* -------------------------------------------------------------------------- */
/* Route                                                                      */
/* -------------------------------------------------------------------------- */

export async function POST(req: Request) {
  const debugId = `dbg_${Date.now()}_${Math.random().toString(16).slice(2)}`;

  try {
    // --- Auth ---
    const secret = req.headers.get("x-hive-secret") || req.headers.get("X-Hive-Secret");
    if (!secret || secret !== ENV.HIVE_INBOUND_EMAIL_SECRET) {
      return NextResponse.json(
        { status: "error", message: "Unauthorized", debugId },
        { status: 401 }
      );
    }

    const raw = await req.json();
    const payload = PayloadSchema.parse(raw);

    const fromDomain = getDomain(payload.from.email);

    // --- Personal email guard ---
    if (PERSONAL_EMAIL_DOMAINS.has(fromDomain)) {
      return NextResponse.json(
        {
          status: "personal_email",
          message: `Blocked personal email domain: ${fromDomain}`,
        },
        { status: 200 }
      );
    }

    // --- Idempotency: duplicate message check ---
    const existingActivity = await findFirstByFormula<Record<string, unknown>>(
      TABLES.activities,
      `({${FIELDS.activity.gmailMessageId}} = "${payload.gmailMessageId}")`
    );

    if (existingActivity) {
      // If we can also find the linked opp, include it.
      return NextResponse.json(
        {
          status: "duplicate",
          message: "This Gmail message has already been logged.",
          activity: {
            id: existingActivity.id,
          },
        },
        { status: 200 }
      );
    }

    // --- Company: find or create by domain ---
    const company =
      (await findFirstByFormula<Record<string, unknown>>(
        TABLES.companies,
        `LOWER({${FIELDS.company.domain}}) = "${fromDomain.toLowerCase()}"`
      )) ||
      (await createRecord<Record<string, unknown>>(TABLES.companies, {
        [FIELDS.company.name]: companyNameFromDomain(fromDomain),
        [FIELDS.company.domain]: fromDomain,
      }));

    // --- Opportunity: attach by thread id if exists ---
    let opportunity =
      await findFirstByFormula<Record<string, unknown>>(
        TABLES.opportunities,
        `({${FIELDS.opp.threadId}} = "${payload.gmailThreadId}")`
      );

    const shouldCreateOpp = payload.mode === "create_or_attach" && !opportunity;

    if (shouldCreateOpp) {
      const oppName =
        payload.subject?.trim()
          ? payload.subject.trim()
          : `Opportunity – ${companyNameFromDomain(fromDomain)}`;

      opportunity = await createRecord<Record<string, unknown>>(TABLES.opportunities, {
        [FIELDS.opp.name]: oppName,
        [FIELDS.opp.stage]: "qualification",
        [FIELDS.opp.company]: [company.id], // linked record
        [FIELDS.opp.threadId]: payload.gmailThreadId,
      });
    }

    // If log_only and no opp exists, you can either:
    // - create a "Thread-only" opp, OR
    // - return an error saying there's nothing to attach to
    // Here: we create a lightweight opp for log_only too (safer UX).
    if (!opportunity) {
      const oppName =
        payload.subject?.trim()
          ? payload.subject.trim()
          : `Thread – ${companyNameFromDomain(fromDomain)}`;

      opportunity = await createRecord<Record<string, unknown>>(TABLES.opportunities, {
        [FIELDS.opp.name]: oppName,
        [FIELDS.opp.stage]: "qualification",
        [FIELDS.opp.company]: [company.id],
        [FIELDS.opp.threadId]: payload.gmailThreadId,
      });
    }

    // --- Activity: create ---
    const activity = await createRecord<Record<string, unknown>>(TABLES.activities, {
      [FIELDS.activity.opp]: [opportunity.id],
      [FIELDS.activity.type]: "email",
      [FIELDS.activity.direction]: payload.direction,
      [FIELDS.activity.from]:
        payload.from.name
          ? `${payload.from.name} <${payload.from.email}>`
          : payload.from.email,
      [FIELDS.activity.to]: (payload.to || []).join(", "),
      [FIELDS.activity.subject]: payload.subject || "",
      [FIELDS.activity.snippet]: payload.snippet || "",
      [FIELDS.activity.body]: payload.bodyText || "",
      [FIELDS.activity.gmailMessageId]: payload.gmailMessageId,
      [FIELDS.activity.gmailThreadId]: payload.gmailThreadId,
      [FIELDS.activity.gmailUrl]: payload.gmailUrl,
      [FIELDS.activity.receivedAt]: payload.receivedAt,
    });

    // --- Contract ---
    const wasAttached = !shouldCreateOpp;

    return NextResponse.json(
      {
        status: wasAttached ? "attached" : "success",
        company: {
          id: company.id,
          name: company.fields?.[FIELDS.company.name] || null,
          domain: company.fields?.[FIELDS.company.domain] || null,
        },
        opportunity: {
          id: opportunity.id,
          name: opportunity.fields?.[FIELDS.opp.name] || null,
          stage: opportunity.fields?.[FIELDS.opp.stage] || null,
          url: null, // optional: set if you have a Hive OS URL pattern
        },
        activity: {
          id: activity.id,
        },
      },
      { status: 200 }
    );
  } catch (err) {
    // ✅ Log full error in Vercel
    console.error("[INBOUND_GMAIL_ERROR]", {
      debugId,
      error: safeJsonError(err),
    });

    // ✅ Return real error message (temporarily) so you can debug fast
    const details = safeJsonError(err);

    return NextResponse.json(
      {
        status: "error",
        message: details.message || "Failed to create opportunity",
        debugId,
        // NOTE: You can remove `details` once stable.
        details,
      },
      { status: 500 }
    );
  }
}
