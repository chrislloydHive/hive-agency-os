// app/api/inbound/ingest/route.ts
// API endpoint for automatic prospect ingestion from inbound leads

import { NextRequest, NextResponse } from 'next/server';
import { createInboundLead, linkLeadToCompany, updateLeadAssignee, updateLeadStatus } from '@/lib/airtable/inboundLeads';
import { createOrMatchCompanyFromInboundLead } from '@/lib/pipeline/createOrMatchCompany';
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
  // Optional: skip specific steps
  skipCompanyCreation?: boolean;
  skipRouting?: boolean;
  skipGapSnapshot?: boolean;
}

interface IngestResult {
  success: boolean;
  lead: InboundLeadItem | null;
  company: {
    id: string;
    name: string;
    isNew: boolean;
  } | null;
  routing: {
    assignee: string;
    rule: string | null;
  } | null;
  gapSnapshot: {
    triggered: boolean;
    runId?: string;
  };
}

export async function POST(request: NextRequest) {
  try {
    const body: IngestRequest = await request.json();
    console.log('[Ingest] Processing inbound lead:', body);

    const result: IngestResult = {
      success: false,
      lead: null,
      company: null,
      routing: null,
      gapSnapshot: { triggered: false },
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
    } else {
      // Create new lead
      lead = await createInboundLead({
        name: body.name,
        email: body.email,
        website: body.website,
        companyName: body.companyName,
        leadSource: body.source || 'Inbound',
        status: 'New',
        notes: body.notes,
      });

      if (!lead) {
        return NextResponse.json(
          { error: 'Failed to create inbound lead' },
          { status: 500 }
        );
      }
    }

    result.lead = lead;
    console.log(`[Ingest] Lead created/loaded: ${lead.id}`);

    // Step 2: Create or match company
    if (!body.skipCompanyCreation && (lead.website || lead.companyName)) {
      try {
        const { company, isNew, matchedBy } = await createOrMatchCompanyFromInboundLead(lead);

        result.company = {
          id: company.id,
          name: company.name,
          isNew,
        };

        // Link lead to company
        await linkLeadToCompany(lead.id, company.id);
        console.log(`[Ingest] Linked lead ${lead.id} to company ${company.id} (${matchedBy})`);

        // Update lead status
        await updateLeadStatus(lead.id, isNew ? 'New' : 'Contacted');
      } catch (error) {
        console.error('[Ingest] Failed to create/match company:', error);
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

    // Step 4: Trigger GAP Snapshot if we have a company with website
    if (!body.skipGapSnapshot && result.company && lead.website) {
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/os/diagnostics/run/gap-snapshot`,
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
          console.log(`[Ingest] Triggered GAP Snapshot for company ${result.company.id}`);
        } else {
          console.error('[Ingest] GAP Snapshot request failed:', await response.text());
        }
      } catch (error) {
        console.error('[Ingest] Failed to trigger GAP Snapshot:', error);
      }
    }

    result.success = true;

    console.log('[Ingest] Completed:', {
      leadId: result.lead?.id,
      companyId: result.company?.id,
      companyIsNew: result.company?.isNew,
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
