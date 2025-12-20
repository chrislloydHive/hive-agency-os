import { NextResponse } from "next/server";
import { getCompanyById, updateCompany, findCompanyByDomain, createCompany, domainToCompanyName } from "@/lib/airtable/companies";

/**
 * Gmail Inbound - Company Only Endpoint
 * POST /api/os/inbound/gmail/company
 *
 * Creates or finds a Company by domain without creating an Opportunity.
 * Useful for tracking companies before they become deals.
 */

const HIVE_INBOUND_EMAIL_SECRET = process.env.HIVE_INBOUND_EMAIL_SECRET!;

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

interface GmailCompanyPayload {
  from: { email: string; name?: string | null };
  subject?: string;
}

function extractDomain(email: string): string {
  const parts = email.toLowerCase().trim().split("@");
  return parts.length === 2 ? parts[1] : "";
}

function generateDebugId(): string {
  return `dbg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function POST(request: Request) {
  const debugId = generateDebugId();

  try {
    // Auth
    const secret =
      request.headers.get("x-hive-secret") ||
      request.headers.get("X-Hive-Secret");

    if (!secret || secret !== HIVE_INBOUND_EMAIL_SECRET) {
      return NextResponse.json(
        { status: "error", message: "Unauthorized", debugId },
        { status: 401 }
      );
    }

    // Parse payload
    const payload: GmailCompanyPayload = await request.json();

    if (!payload.from?.email) {
      return NextResponse.json(
        {
          status: "error",
          message: "Missing required field: from.email",
          debugId,
        },
        { status: 400 }
      );
    }

    // Extract domain
    const domain = extractDomain(payload.from.email);

    if (!domain || PERSONAL_DOMAINS.has(domain)) {
      return NextResponse.json({
        status: "personal_email",
        message: `Cannot create company from personal email: ${domain || "unknown"}`,
      });
    }

    // Find or create company by domain
    let company = await findCompanyByDomain(domain);
    let isNew = false;

    if (!company) {
      isNew = true;
      company = await createCompany({
        name: domainToCompanyName(domain),
        domain: domain,
        website: `https://${domain}`,
        primaryContactName: payload.from.name || undefined,
        primaryContactEmail: payload.from.email,
      });
    } else {
      // Update primary contact if not already set
      if (!company.primaryContactEmail && payload.from.email) {
        await updateCompany(company.id, {
          primaryContactName: payload.from.name || undefined,
          primaryContactEmail: payload.from.email,
        });
        // Refresh company data
        company = await getCompanyById(company.id);
      }
    }

    if (!company) {
      return NextResponse.json(
        { status: "error", message: "Failed to create company", debugId },
        { status: 500 }
      );
    }

    // Build response with URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000';

    return NextResponse.json({
      status: isNew ? "created" : "existing",
      company: {
        id: company.id,
        name: company.name,
        domain: company.domain,
        isNew,
        url: `${baseUrl}/c/${company.id}`,
      },
    });
  } catch (err) {
    console.error("[GMAIL_COMPANY_ERROR]", {
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
