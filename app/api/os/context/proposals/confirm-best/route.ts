// app/api/os/context/proposals/confirm-best/route.ts
// Confirm Best per Domain API
//
// POST: Confirms the highest-ranked proposal per domain group
//       and rejects all other proposals in that domain.
//
// V4 Convergence Feature - requires CONTEXT_V4_CONVERGENCE_ENABLED=true

import { NextRequest, NextResponse } from 'next/server';
import {
  loadPendingProposals,
  acceptProposal,
  rejectProposal,
  loadProposalBatch,
} from '@/lib/contextGraph/nodes';
import { loadContextGraph, saveContextGraph } from '@/lib/contextGraph/storage';
import { applyProposalToContextGraph } from '@/lib/contextGraph/nodes/applyProposal';
import {
  broadcastProposalAccepted,
  broadcastProposalRejected,
  getRegistryEntry,
  invalidateStrategySection,
} from '@/lib/os/registry';
import {
  isConvergenceEnabled,
  getProposalRankingScore,
  getDomainGroup,
  groupProposalsByDomain,
} from '@/lib/contextGraph/v4/convergence';
import type { ContextProposal, ContextProposalBatch } from '@/lib/contextGraph/nodes/types';

// ============================================================================
// Types
// ============================================================================

interface ConfirmBestRequest {
  companyId: string;
  /** Optional: Only process specific domains */
  domains?: string[];
  /** Who is confirming */
  userId: string;
}

interface ConfirmBestResponse {
  success: boolean;
  confirmedCount: number;
  rejectedCount: number;
  domainsProcessed: string[];
  /** Details of what was confirmed per domain */
  confirmed: Array<{
    domain: string;
    fieldPath: string;
    proposalId: string;
    rankingScore: number;
  }>;
  /** Proposals that were rejected */
  rejected: Array<{
    domain: string;
    fieldPath: string;
    proposalId: string;
  }>;
}

// ============================================================================
// POST - Confirm Best per Domain
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    // Check feature flag
    if (!isConvergenceEnabled()) {
      return NextResponse.json(
        {
          error: 'V4 Convergence is not enabled',
          code: 'FEATURE_DISABLED',
          hint: 'Set CONTEXT_V4_CONVERGENCE_ENABLED=true to enable this feature',
        },
        { status: 403 }
      );
    }

    const body = (await request.json()) as ConfirmBestRequest;
    const { companyId, domains, userId } = body;

    // Validation
    if (!companyId) {
      return NextResponse.json({ error: 'Missing companyId' }, { status: 400 });
    }

    const resolvedBy = userId || 'system';

    // Load all pending proposals for the company
    const batches = await loadPendingProposals(companyId);

    if (batches.length === 0) {
      return NextResponse.json({
        success: true,
        confirmedCount: 0,
        rejectedCount: 0,
        domainsProcessed: [],
        confirmed: [],
        rejected: [],
        message: 'No pending proposals to process',
      });
    }

    // Flatten all pending proposals with batch info
    const allProposals: Array<{
      proposal: ContextProposal;
      batch: ContextProposalBatch;
    }> = [];

    for (const batch of batches) {
      for (const proposal of batch.proposals) {
        if (proposal.status === 'pending') {
          allProposals.push({ proposal, batch });
        }
      }
    }

    if (allProposals.length === 0) {
      return NextResponse.json({
        success: true,
        confirmedCount: 0,
        rejectedCount: 0,
        domainsProcessed: [],
        confirmed: [],
        rejected: [],
        message: 'No pending proposals to process',
      });
    }

    // Group proposals by domain
    const proposalsByDomain = new Map<string, typeof allProposals>();

    for (const item of allProposals) {
      const domain = getDomainGroup(item.proposal.fieldPath);
      const group = proposalsByDomain.get(domain) || [];
      group.push(item);
      proposalsByDomain.set(domain, group);
    }

    // Filter to requested domains if specified
    const domainsToProcess = domains
      ? Array.from(proposalsByDomain.keys()).filter(d =>
          domains.map(x => x.toLowerCase()).includes(d.toLowerCase())
        )
      : Array.from(proposalsByDomain.keys());

    // Process each domain: confirm best, reject rest
    const confirmed: ConfirmBestResponse['confirmed'] = [];
    const rejected: ConfirmBestResponse['rejected'] = [];
    const sectionsToInvalidate = new Set<string>();

    for (const domain of domainsToProcess) {
      const domainProposals = proposalsByDomain.get(domain) || [];

      if (domainProposals.length === 0) continue;

      // Rank proposals in this domain
      const rankedProposals = [...domainProposals].sort((a, b) => {
        const scoreA = getProposalRankingScore({
          decisionImpact: a.proposal.decisionImpact,
          confidence: a.proposal.confidence,
          specificityScore: a.proposal.specificityScore,
          createdAt: a.proposal.createdAt,
          source: a.batch.trigger,
        });
        const scoreB = getProposalRankingScore({
          decisionImpact: b.proposal.decisionImpact,
          confidence: b.proposal.confidence,
          specificityScore: b.proposal.specificityScore,
          createdAt: b.proposal.createdAt,
          source: b.batch.trigger,
        });
        return scoreB - scoreA; // Descending
      });

      // Best proposal is first
      const [best, ...rest] = rankedProposals;

      // Confirm the best proposal
      if (best) {
        const confirmSuccess = await acceptProposal(
          best.batch.id,
          best.proposal.id,
          resolvedBy
        );

        if (confirmSuccess) {
          // Apply to context graph
          await applyProposalValueToContext(
            companyId,
            best.proposal.fieldPath,
            best.proposal.proposedValue,
            'user',
            false
          );

          const rankingScore = getProposalRankingScore({
            decisionImpact: best.proposal.decisionImpact,
            confidence: best.proposal.confidence,
            specificityScore: best.proposal.specificityScore,
            createdAt: best.proposal.createdAt,
            source: best.batch.trigger,
          });

          confirmed.push({
            domain,
            fieldPath: best.proposal.fieldPath,
            proposalId: best.proposal.id,
            rankingScore,
          });

          // Broadcast event
          broadcastProposalAccepted(
            companyId,
            best.batch.id,
            best.proposal.id,
            best.proposal.fieldPath,
            best.proposal.proposedValue
          );

          // Track section for invalidation
          const field = getRegistryEntry(best.proposal.fieldPath);
          if (field?.strategySection) {
            sectionsToInvalidate.add(field.strategySection);
          }
        }
      }

      // Reject the rest
      for (const item of rest) {
        const rejectSuccess = await rejectProposal(
          item.batch.id,
          item.proposal.id,
          resolvedBy
        );

        if (rejectSuccess) {
          rejected.push({
            domain,
            fieldPath: item.proposal.fieldPath,
            proposalId: item.proposal.id,
          });

          // Broadcast event
          broadcastProposalRejected(
            companyId,
            item.batch.id,
            item.proposal.id,
            item.proposal.fieldPath
          );

          const field = getRegistryEntry(item.proposal.fieldPath);
          if (field?.strategySection) {
            sectionsToInvalidate.add(field.strategySection);
          }
        }
      }
    }

    // Invalidate affected strategy sections
    for (const section of sectionsToInvalidate) {
      invalidateStrategySection(
        companyId,
        section as 'businessReality' | 'constraints' | 'competition' | 'executionCapabilities',
        'proposal_accepted'
      );
    }

    console.log(
      `[API] confirm-best: Processed ${domainsToProcess.length} domains for ${companyId}. ` +
      `Confirmed: ${confirmed.length}, Rejected: ${rejected.length}`
    );

    const response: ConfirmBestResponse = {
      success: true,
      confirmedCount: confirmed.length,
      rejectedCount: rejected.length,
      domainsProcessed: domainsToProcess,
      confirmed,
      rejected,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[API] confirm-best error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to confirm best proposals' },
      { status: 500 }
    );
  }
}

// ============================================================================
// Helpers
// ============================================================================

async function applyProposalValueToContext(
  companyId: string,
  fieldPath: string,
  value: unknown,
  source: string,
  isEdited: boolean = false
): Promise<boolean> {
  try {
    const graph = await loadContextGraph(companyId);
    if (!graph) {
      console.warn(`[applyProposalValueToContext] No graph found for ${companyId}`);
      return false;
    }

    // Apply the value using the dedicated function
    const updatedGraph = await applyProposalToContextGraph(
      graph,
      fieldPath,
      value,
      source,
      { isEdited }
    );

    // Save the updated graph
    await saveContextGraph(updatedGraph, source);

    console.log(
      `[applyProposalValueToContext] Applied ${fieldPath} = ${JSON.stringify(value).slice(0, 50)}...`
    );
    return true;
  } catch (error) {
    console.error(`[applyProposalValueToContext] Failed to apply ${fieldPath}:`, error);
    return false;
  }
}
