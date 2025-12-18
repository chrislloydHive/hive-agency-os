// app/api/os/inbound/gmail/route.ts
// Gmail Add-on inbound endpoint
//
// Receives email data from Gmail Add-on and creates/updates opportunities.
// Supports:
// - Deduplication by message ID
// - Thread attachment to existing open opportunities
// - log_only mode: create activity without creating new opportunity

import { NextRequest, NextResponse } from 'next/server';
import {
  findActivityByExternalMessageId,
  findActivitiesByExternalThreadId,
  createActivity,
} from '@/lib/airtable/activities';
import { findOrCreateCompanyByDomain } from '@/lib/airtable/companies';
import {
  createOpportunity,
  updateOpportunity,
  getOpportunityById,
} from '@/lib/airtable/opportunities';
import { extractDomainFromEmail, isPersonalEmailDomain } from '@/lib/utils/emailDomains';

export const maxDuration = 60;

// ============================================================================
// Types
// ============================================================================

type GmailInboundMode = 'default' | 'log_only';

interface GmailInboundRequest {
  gmailMessageId: string;
  gmailThreadId: string;
  from: { email: string; name?: string | null };
  to: string[];
  cc?: string[];
  subject: string;
  snippet: string;
  bodyText?: string;
  receivedAt: string;
  gmailUrl?: string;
  mode?: GmailInboundMode;
}

interface GmailInboundResponse {
  status: 'success' | 'duplicate' | 'attached' | 'logged' | 'personal_email' | 'error';
  company?: { id: string; name: string; isNew: boolean };
  opportunity?: { id: string; name: string; stage: string; url: string };
  activity?: { id: string };
  message?: string;
}

// Closed stages - opportunities in these stages are not considered "open"
const CLOSED_STAGES = ['closed_won', 'closed_lost', 'won', 'lost'];

// ============================================================================
// Auth
// ============================================================================

function validateAuth(request: NextRequest): boolean {
  const secret = request.headers.get('X-Hive-Secret');
  const expectedSecret = process.env.HIVE_INBOUND_EMAIL_SECRET;

  if (!expectedSecret) {
    console.error('[Gmail Inbound] HIVE_INBOUND_EMAIL_SECRET not configured');
    return false;
  }

  return secret === expectedSecret;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Check if an opportunity is open (not in a closed stage)
 */
function isOpportunityOpen(stage: string | null | undefined): boolean {
  if (!stage) return true; // Assume open if no stage
  return !CLOSED_STAGES.includes(stage.toLowerCase());
}

/**
 * Build opportunity URL
 */
function buildOpportunityUrl(opportunityId: string): string {
  return `${process.env.NEXT_PUBLIC_APP_URL || ''}/pipeline/${opportunityId}`;
}

// ============================================================================
// POST Handler
// ============================================================================

export async function POST(request: NextRequest) {
  // =========================================================================
  // Step 0: Auth + Validation
  // =========================================================================
  if (!validateAuth(request)) {
    return NextResponse.json(
      { status: 'error', message: 'Unauthorized' } as GmailInboundResponse,
      { status: 401 }
    );
  }

  try {
    const body: GmailInboundRequest = await request.json();
    const mode: GmailInboundMode = body.mode || 'default';

    // Debug: Log raw payload for troubleshooting
    console.log('[GMAIL INBOUND PAYLOAD]', JSON.stringify(body, null, 2));

    console.log('[Gmail Inbound] Processing email:', {
      messageId: body.gmailMessageId,
      threadId: body.gmailThreadId,
      from: body.from?.email,
      subject: body.subject,
      mode,
    });

    // Validate required fields
    if (!body.gmailMessageId) {
      return NextResponse.json(
        { status: 'error', message: 'gmailMessageId is required' } as GmailInboundResponse,
        { status: 400 }
      );
    }

    if (!body.from?.email) {
      return NextResponse.json(
        { status: 'error', message: 'from.email is required' } as GmailInboundResponse,
        { status: 400 }
      );
    }

    // =========================================================================
    // Step 1: Deduplication (ALWAYS)
    // =========================================================================
    const existingActivity = await findActivityByExternalMessageId(
      'gmail-addon',
      body.gmailMessageId
    );

    if (existingActivity) {
      console.log('[Gmail Inbound] Duplicate message detected:', body.gmailMessageId);

      // Try to get linked opportunity if any
      let opportunity = null;
      if (existingActivity.opportunityId) {
        opportunity = await getOpportunityById(existingActivity.opportunityId);
      }

      const response: GmailInboundResponse = {
        status: 'duplicate',
        message: 'This email has already been added',
        activity: { id: existingActivity.activity.id },
      };

      if (opportunity) {
        response.opportunity = {
          id: opportunity.id,
          name: opportunity.deliverableName || 'Untitled',
          stage: opportunity.stage,
          url: buildOpportunityUrl(opportunity.id),
        };
      }

      return NextResponse.json(response);
    }

    // =========================================================================
    // Step 2: Thread Attachment Check (ALWAYS)
    // =========================================================================
    let threadOpportunityId: string | null = null;
    let threadOpportunity: Awaited<ReturnType<typeof getOpportunityById>> = null;

    if (body.gmailThreadId) {
      // Find all activities in this thread
      const threadActivities = await findActivitiesByExternalThreadId(
        'gmail-addon',
        body.gmailThreadId
      );

      // Find the first activity linked to an OPEN opportunity
      for (const activity of threadActivities) {
        if (activity.opportunityId) {
          const opp = await getOpportunityById(activity.opportunityId);
          if (opp && isOpportunityOpen(opp.stage)) {
            threadOpportunityId = activity.opportunityId;
            threadOpportunity = opp;
            console.log('[Gmail Inbound] Found open opportunity in thread:', threadOpportunityId);
            break;
          }
        }
      }
    }

    // If we found an open opportunity in the thread, attach to it
    if (threadOpportunityId && threadOpportunity) {
      // Create activity linked to existing opportunity
      const activity = await createActivity({
        opportunityId: threadOpportunityId,
        companyId: threadOpportunity.companyId || undefined,
        type: 'email',
        direction: 'inbound',
        title: body.subject || 'Inbound email',
        subject: body.subject,
        fromName: body.from.name || undefined,
        fromEmail: body.from.email,
        to: body.to,
        cc: body.cc,
        snippet: body.snippet,
        bodyText: body.bodyText,
        receivedAt: body.receivedAt,
        source: 'gmail-addon',
        externalMessageId: body.gmailMessageId,
        externalThreadId: body.gmailThreadId,
        externalUrl: body.gmailUrl,
        rawPayload: body as unknown as Record<string, unknown>,
      });

      if (!activity) {
        return NextResponse.json(
          { status: 'error', message: 'Failed to create activity' } as GmailInboundResponse,
          { status: 500 }
        );
      }

      // Update opportunity lastActivityAt
      try {
        await updateOpportunity(threadOpportunityId, {});
      } catch (error) {
        console.error('[Gmail Inbound] Failed to update opportunity lastActivityAt:', error);
      }

      console.log('[Gmail Inbound] Attached to existing thread opportunity');

      return NextResponse.json({
        status: 'attached',
        message: 'Added to existing conversation',
        activity: { id: activity.id },
        opportunity: {
          id: threadOpportunity.id,
          name: threadOpportunity.deliverableName || 'Untitled',
          stage: threadOpportunity.stage,
          url: buildOpportunityUrl(threadOpportunity.id),
        },
      } as GmailInboundResponse);
    }

    // =========================================================================
    // Step 3: Mode-specific handling
    // =========================================================================

    if (mode === 'log_only') {
      // =====================================================================
      // LOG_ONLY MODE: Create activity without creating opportunity
      // =====================================================================

      // Optionally resolve company (but don't block on personal email)
      let companyId: string | undefined;
      const senderDomain = extractDomainFromEmail(body.from.email);

      if (senderDomain && !isPersonalEmailDomain(senderDomain)) {
        try {
          const companyResult = await findOrCreateCompanyByDomain(senderDomain, {
            stage: 'Prospect',
          });
          companyId = companyResult.companyRecord.id;
          console.log('[Gmail Inbound] Resolved company for log_only:', companyId);
        } catch (error) {
          console.error('[Gmail Inbound] Failed to resolve company, continuing without:', error);
        }
      }
      // Note: For personal email domains in log_only mode, we skip company resolution
      // but still create the activity

      // Create standalone activity (no opportunity link)
      const activity = await createActivity({
        opportunityId: undefined, // No opportunity
        companyId,
        type: 'email',
        direction: 'inbound',
        title: body.subject || 'Inbound email',
        subject: body.subject,
        fromName: body.from.name || undefined,
        fromEmail: body.from.email,
        to: body.to,
        cc: body.cc,
        snippet: body.snippet,
        bodyText: body.bodyText,
        receivedAt: body.receivedAt,
        source: 'gmail-addon',
        externalMessageId: body.gmailMessageId,
        externalThreadId: body.gmailThreadId,
        externalUrl: body.gmailUrl,
        rawPayload: body as unknown as Record<string, unknown>,
      });

      if (!activity) {
        return NextResponse.json(
          { status: 'error', message: 'Failed to create activity' } as GmailInboundResponse,
          { status: 500 }
        );
      }

      console.log('[Gmail Inbound] Created standalone activity (log_only):', activity.id);

      return NextResponse.json({
        status: 'success',
        message: 'Logged activity (no opportunity created)',
        activity: { id: activity.id },
      } as GmailInboundResponse);
    }

    // =========================================================================
    // DEFAULT MODE: Create company + opportunity + activity
    // =========================================================================

    // Check for personal email domain - block in default mode
    const senderDomain = extractDomainFromEmail(body.from.email);
    if (!senderDomain || isPersonalEmailDomain(senderDomain)) {
      console.log('[Gmail Inbound] Personal email domain, skipping opportunity creation');
      return NextResponse.json({
        status: 'personal_email',
        message: 'Cannot create opportunity from personal email address. Use "Log Activity Only" instead.',
      } as GmailInboundResponse);
    }

    // Resolve or create company by domain
    const companyResult = await findOrCreateCompanyByDomain(senderDomain, {
      stage: 'Prospect',
    });

    const companyId = companyResult.companyRecord.id;
    const companyName = companyResult.companyRecord.name;
    const companyIsNew = companyResult.isNew;

    console.log('[Gmail Inbound] Company resolved:', {
      id: companyId,
      name: companyName,
      isNew: companyIsNew,
      domain: senderDomain,
    });

    // Create opportunity
    const oppName = body.subject || `Inbound: ${body.from.name || body.from.email}`;
    const newOpp = await createOpportunity({
      companyId,
      name: oppName,
      stage: 'qualification',
      owner: process.env.DEFAULT_OPP_OWNER_ID || 'Chris',
      notes: `Created from Gmail\nFrom: ${body.from.email}\nSubject: ${body.subject}`,
    });

    if (!newOpp) {
      return NextResponse.json(
        { status: 'error', message: 'Failed to create opportunity' } as GmailInboundResponse,
        { status: 500 }
      );
    }

    console.log('[Gmail Inbound] Created opportunity:', {
      id: newOpp.id,
      name: newOpp.deliverableName,
    });

    // Create activity linked to opportunity
    const activity = await createActivity({
      opportunityId: newOpp.id,
      companyId,
      type: 'email',
      direction: 'inbound',
      title: body.subject || 'Inbound email',
      subject: body.subject,
      fromName: body.from.name || undefined,
      fromEmail: body.from.email,
      to: body.to,
      cc: body.cc,
      snippet: body.snippet,
      bodyText: body.bodyText,
      receivedAt: body.receivedAt,
      source: 'gmail-addon',
      externalMessageId: body.gmailMessageId,
      externalThreadId: body.gmailThreadId,
      externalUrl: body.gmailUrl,
      rawPayload: body as unknown as Record<string, unknown>,
    });

    if (!activity) {
      return NextResponse.json(
        { status: 'error', message: 'Failed to create activity' } as GmailInboundResponse,
        { status: 500 }
      );
    }

    console.log('[Gmail Inbound] Created activity:', activity.id);

    // Update opportunity lastActivityAt
    try {
      await updateOpportunity(newOpp.id, {});
    } catch (error) {
      console.error('[Gmail Inbound] Failed to update opportunity lastActivityAt:', error);
    }

    // Return success
    return NextResponse.json({
      status: 'success',
      message: 'Opportunity created successfully',
      company: {
        id: companyId,
        name: companyName,
        isNew: companyIsNew,
      },
      opportunity: {
        id: newOpp.id,
        name: newOpp.deliverableName || oppName,
        stage: newOpp.stage,
        url: buildOpportunityUrl(newOpp.id),
      },
      activity: {
        id: activity.id,
      },
    } as GmailInboundResponse);
    // =========================================================================
    // Fallthrough guard - should never reach here
    // =========================================================================
    console.error('[GMAIL INBOUND ERROR] Unhandled execution path reached');
    return NextResponse.json(
      { status: 'error', message: 'Unhandled execution path' } as GmailInboundResponse,
      { status: 500 }
    );
  } catch (error) {
    console.error('[GMAIL INBOUND ERROR]', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      {
        status: 'error',
        message: error instanceof Error ? error.message : 'Unhandled error',
      } as GmailInboundResponse,
      { status: 500 }
    );
  }
}
