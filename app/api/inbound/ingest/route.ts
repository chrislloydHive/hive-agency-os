// app/api/inbound/ingest/route.ts
// API endpoint for automatic prospect ingestion from inbound leads
//
// LEAD-FIRST DESIGN:
// - Leads are created in the Inbound Leads table
// - Companies are only LINKED if they already exist (never created here)
// - To create a company from a lead, use the convert-lead-to-company endpoint

import { NextRequest, NextResponse } from 'next/server';
import { createInboundLead, linkLeadToCompany, updateLeadAssignee, updateLeadStatus } from '@/lib/airtable/inboundLeads';
import { matchCompanyForLead } from '@/lib/pipeline/createOrMatchCompany';
import { matchLeadToRule, DEFAULT_OWNER } from '@/lib/pipeline/routingConfig';
import type { InboundLeadItem } from '@/lib/types/pipeline';

export const maxDuration = 120;

interface IngestRequest {
  // Lead can be provided by ID (existing) or data (new)
  leadId?: string;
  // Or provide lead data directly
  name?: string;
  email?: string;
  website?: string;
  companyName?: string;
  source?: string;
  notes?: string;
  // UTM tracking
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
  // Optional: skip specific steps
  skipCompanyMatching?: boolean;
  skipRouting?: boolean;
  skipGapSnapshot?: boolean;
}

interface IngestResult {
  success: boolean;
  lead: InboundLeadItem | null;
  company: {
    id: string;
    name: string;
    isNew: false; // Companies are never created in lead ingest
    matchedBy: 'domain' | 'name';
  } | null;
  routing: {
    assignee: string;
    rule: string | null;
  } | null;
  gapSnapshot: {
    triggered: boolean;
    runId?: string;
  };
  // Telemetry
  telemetry: {
    lead_created: boolean;
    lead_updated: boolean;
    company_linked: boolean;
    company_created: false; // Always false - leads don't create companies
  };
}

export async function POST(request: NextRequest) {
  try {
    const body: IngestRequest = await request.json();
    console.log('[Ingest] Processing inbound lead (lead-first mode):', body);

    const result: IngestResult = {
      success: false,
      lead: null,
      company: null,
      routing: null,
      gapSnapshot: { triggered: false },
      telemetry: {
        lead_created: false,
        lead_updated: false,
        company_linked: false,
        company_created: false, // Always false - lead-first design
      },
    };

    // Step 1: Create or get lead
    let lead: InboundLeadItem | null = null;

    if (body.leadId) {
      // Existing lead - fetch it (would need getInboundLeadById)
      // For now, we'll just track the ID
      lead = {
        id: body.leadId,
        name: body.name || null,
        email: body.email || null,
        website: body.website || null,
        companyName: body.companyName || null,
        leadSource: body.source || null,
        status: 'New',
        assignee: null,
        notes: body.notes || null,
        companyId: null,
        gapIaRunId: null,
        createdAt: null,
      };
      result.telemetry.lead_updated = true;
    } else {
      // Create new lead with all fields including UTM
      lead = await createInboundLead({
        name: body.name,
        email: body.email,
        website: body.website,
        companyName: body.companyName,
        leadSource: body.source || 'Inbound',
        status: 'New',
        notes: body.notes,
        // UTM tracking
        utmSource: body.utmSource,
        utmMedium: body.utmMedium,
        utmCampaign: body.utmCampaign,
        utmTerm: body.utmTerm,
        utmContent: body.utmContent,
      });

      if (!lead) {
        return NextResponse.json(
          { error: 'Failed to create inbound lead' },
          { status: 500 }
        );
      }
      result.telemetry.lead_created = true;
    }

    result.lead = lead;
    console.log(`[Ingest] Lead created/loaded: ${lead.id} (lead_created=${result.telemetry.lead_created})`);

    // Step 2: Match existing company ONLY (no creation)
    // This is the key change: we NEVER create a company during lead ingest
    if (!body.skipCompanyMatching && (lead.website || lead.companyName)) {
      try {
        const { company, matchedBy } = await matchCompanyForLead(lead);

        if (company && matchedBy) {
          // Found existing company - link it
          result.company = {
            id: company.id,
            name: company.name,
            isNew: false, // Always false - we only match, never create
            matchedBy,
          };

          // Link lead to company
          await linkLeadToCompany(lead.id, company.id);
          result.telemetry.company_linked = true;
          console.log(`[Ingest] Linked lead ${lead.id} to existing company ${company.id} (${matchedBy})`);
        } else {
          // No matching company found - lead stays unlinked
          // The lead has all info needed for later conversion
          console.log(`[Ingest] No existing company found - lead ${lead.id} will remain unlinked until converted`);
        }
      } catch (error) {
        console.error('[Ingest] Failed to match company:', error);
        // Continue without company - not a fatal error
      }
    }

    // Step 3: Route lead to owner
    if (!body.skipRouting) {
      try {
        // Get company details for routing
        const routingMatch = matchLeadToRule({
          industry: undefined, // Would need to fetch from company
          companyType: undefined,
          sizeBand: undefined,
          leadSource: lead.leadSource,
        });

        const assignee = routingMatch?.owner || DEFAULT_OWNER;

        await updateLeadAssignee(lead.id, assignee);

        result.routing = {
          assignee,
          rule: routingMatch?.label || null,
        };

        console.log(`[Ingest] Routed lead ${lead.id} to ${assignee}`);
      } catch (error) {
        console.error('[Ingest] Failed to route lead:', error);
      }
    }

    // Step 4: Trigger GAP IA only if we have a LINKED company with website
    // Note: We only trigger GAP if there's an existing company to attach results to
    if (!body.skipGapSnapshot && result.company && lead.website) {
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/os/diagnostics/run/gap-snapshot`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              companyId: result.company.id,
              url: lead.website,
            }),
          }
        );

        if (response.ok) {
          const data = await response.json();
          result.gapSnapshot = {
            triggered: true,
            runId: data.run?.id,
          };
          console.log(`[Ingest] Triggered GAP IA for company ${result.company.id}`);
        } else {
          console.error('[Ingest] GAP IA request failed:', await response.text());
        }
      } catch (error) {
        console.error('[Ingest] Failed to trigger GAP IA:', error);
      }
    }

    result.success = true;

    console.log('[Ingest] Completed:', {
      leadId: result.lead?.id,
      companyId: result.company?.id,
      companyLinked: result.telemetry.company_linked,
      companyCreated: result.telemetry.company_created, // Always false
      assignee: result.routing?.assignee,
      gapSnapshotTriggered: result.gapSnapshot.triggered,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('[Ingest] Error processing inbound lead:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
