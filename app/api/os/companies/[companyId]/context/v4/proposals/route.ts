// app/api/os/companies/[companyId]/context/v4/proposals/route.ts
// GET: List Context V4 proposals for a company
//
// Returns proposals grouped by field key with evidence, confidence, and source.

import { NextRequest, NextResponse } from 'next/server';
import { getBase } from '@/lib/airtable';
import { AIRTABLE_TABLES } from '@/lib/airtable/tables';
import type { ContextProposal, ListProposalsResponse } from '@/lib/types/contextProposal';
import type { PromotionSourceType } from '@/lib/contextGraph/v4/promotion/promotableFields';

// ============================================================================
// Route Handler
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  try {
    const { companyId } = await params;

    if (!companyId) {
      return NextResponse.json(
        { error: 'Company ID is required' },
        { status: 400 }
      );
    }

    // Get query params
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status'); // 'proposed', 'confirmed', 'rejected', or null for all
    const limit = parseInt(searchParams.get('limit') || '100', 10);

    console.log('[ProposalsList] Fetching proposals:', {
      companyId,
      statusFilter,
      limit,
    });

    // Build filter formula
    let filterFormula = `{Company ID} = "${companyId}"`;
    if (statusFilter) {
      filterFormula = `AND(${filterFormula}, {Status} = "${statusFilter}")`;
    }

    // Load proposals from Airtable
    const base = getBase();
    const records = await base(AIRTABLE_TABLES.CONTEXT_PROPOSALS)
      .select({
        filterByFormula: filterFormula,
        maxRecords: limit,
        sort: [{ field: 'Created At', direction: 'desc' }],
      })
      .all();

    // Map to proposals
    const proposals: ContextProposal[] = records.map(record => ({
      id: record.id,
      companyId: (record.fields['Company ID'] as string) || companyId,
      fieldKey: (record.fields['Field Key'] as string) || '',
      proposedValue: (record.fields['Proposed Value'] as string) || '',
      status: (record.fields['Status'] as any) || 'proposed',
      sourceType: (record.fields['Source Type'] as PromotionSourceType) || 'manual',
      sourceRunId: (record.fields['Source Run ID'] as string) || undefined,
      evidence: (record.fields['Evidence'] as string) || '',
      confidence: (record.fields['Confidence'] as number) || 0,
      createdAt: (record.fields['Created At'] as string) || new Date().toISOString(),
      decidedAt: (record.fields['Decided At'] as string) || undefined,
      decidedBy: (record.fields['Decided By'] as string) || undefined,
    }));

    // Group by field key
    const proposalsByField: Record<string, ContextProposal[]> = {};
    const byStatus = { proposed: 0, confirmed: 0, rejected: 0 };
    const bySource: Record<string, number> = {};

    for (const proposal of proposals) {
      // Group by field
      if (!proposalsByField[proposal.fieldKey]) {
        proposalsByField[proposal.fieldKey] = [];
      }
      proposalsByField[proposal.fieldKey].push(proposal);

      // Count by status
      if (proposal.status in byStatus) {
        byStatus[proposal.status as keyof typeof byStatus]++;
      }

      // Count by source
      const source = proposal.sourceType || 'unknown';
      bySource[source] = (bySource[source] || 0) + 1;
    }

    const response: ListProposalsResponse = {
      success: true,
      proposalsByField,
      totalCount: proposals.length,
      byStatus,
      bySource,
    };

    console.log('[ProposalsList] Found proposals:', {
      total: proposals.length,
      fields: Object.keys(proposalsByField).length,
    });

    return NextResponse.json(response);
  } catch (error) {
    console.error('[ProposalsList] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
