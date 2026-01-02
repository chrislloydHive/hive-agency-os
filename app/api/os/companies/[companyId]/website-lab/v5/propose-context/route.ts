// app/api/os/companies/[companyId]/website-lab/v5/propose-context/route.ts
// Propose Context from V5 Blocking Issues
//
// POST: Creates context proposals from blocking issues (with ingestion guards)

import { NextRequest, NextResponse } from 'next/server';
import type { V5BlockingIssue } from '@/lib/gap-heavy/modules/websiteLabV5';
import {
  checkBlockingIssueEligibility,
  buildBlockingIssueProposal,
} from '@/lib/contextGraph/v5/ingestionGuards';
import type { V5ContextProposal } from '@/lib/contextGraph/v5/types';

interface ProposeContextRequest {
  blockingIssues: V5BlockingIssue[];
  runId?: string;
}

type RouteContext = {
  params: Promise<{ companyId: string }>;
};

export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { companyId } = await context.params;
    const body = (await request.json()) as ProposeContextRequest;
    const { blockingIssues, runId } = body;

    if (!blockingIssues || blockingIssues.length === 0) {
      return NextResponse.json(
        { error: 'Missing required field: blockingIssues' },
        { status: 400 }
      );
    }

    console.log('[V5 Propose Context] Processing blocking issues:', {
      companyId,
      issuesCount: blockingIssues.length,
      runId,
    });

    const proposals: V5ContextProposal[] = [];
    const rejected: { issueId: number; reasons: string[] }[] = [];

    // Process each blocking issue through ingestion guards
    for (const issue of blockingIssues) {
      const eligibility = checkBlockingIssueEligibility(issue);

      if (eligibility.eligible) {
        // Build proposal for eligible issues
        const proposal = buildBlockingIssueProposal(issue, companyId, runId || 'unknown');
        if (proposal) {
          proposals.push(proposal);
        }
      } else {
        // Track rejected issues
        rejected.push({
          issueId: issue.id,
          reasons: eligibility.reasons,
        });
      }
    }

    console.log('[V5 Propose Context] Processing complete:', {
      proposalsCreated: proposals.length,
      rejected: rejected.length,
    });

    // In a full implementation, we would:
    // 1. Check for duplicates against existing context nodes
    // 2. Create context proposals in the database
    // 3. Add to review queue if human review required

    // For now, return the proposals as a response
    return NextResponse.json({
      success: true,
      proposalsCount: proposals.length,
      proposals: proposals.map(p => ({
        id: p.id,
        type: p.type,
        problem: p.problem,
        pagePath: p.pagePath,
        confidence: p.provenance.confidence,
        status: p.provenance.humanReviewStatus,
      })),
      rejected: rejected.length > 0 ? rejected : undefined,
    });
  } catch (error) {
    console.error('[V5 Propose Context] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
