// app/api/pipeline/route-lead/route.ts
// Lead Routing API - Assigns leads to reps based on rules

import { NextRequest, NextResponse } from 'next/server';
import { getInboundLeadById, updateLeadAssignee, updateLeadStatus } from '@/lib/airtable/inboundLeads';
import { getCompanyById } from '@/lib/airtable/companies';
import { matchLeadToRule, DEFAULT_OWNER } from '@/lib/pipeline/routingConfig';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { leadId } = body;

    if (!leadId) {
      return NextResponse.json(
        { error: 'Missing leadId' },
        { status: 400 }
      );
    }

    // Fetch lead
    const lead = await getInboundLeadById(leadId);
    if (!lead) {
      return NextResponse.json(
        { error: 'Lead not found' },
        { status: 404 }
      );
    }

    // Fetch linked company if available
    const company = lead.companyId ? await getCompanyById(lead.companyId) : null;

    // Build matching context
    const matchContext = {
      industry: company?.industry || null,
      companyType: company?.companyType || null,
      sizeBand: company?.sizeBand || null,
      leadSource: lead.leadSource || null,
    };

    console.log('[RouteLead] Matching lead against rules:', matchContext);

    // Try to match against rules
    const matchedRule = matchLeadToRule(matchContext);

    let assignee: string;
    if (matchedRule) {
      assignee = matchedRule.owner;
      console.log(`[RouteLead] Matched rule: ${matchedRule.label} → ${assignee}`);
    } else {
      assignee = DEFAULT_OWNER;
      console.log(`[RouteLead] No rule matched, using default: ${assignee}`);
    }

    // Update lead in Airtable
    await updateLeadAssignee(leadId, assignee);
    await updateLeadStatus(leadId, 'Routed');

    console.log(`[RouteLead] Lead ${leadId} routed to ${assignee}`);

    return NextResponse.json({
      leadId,
      assignee,
      status: 'Routed',
      matchedRule: matchedRule?.label || null,
    });
  } catch (error) {
    console.error('[RouteLead] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}
