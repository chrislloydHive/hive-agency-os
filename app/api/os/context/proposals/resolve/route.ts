// app/api/os/context/proposals/resolve/route.ts
// Resolve Context Proposals API
//
// POST: Accept, reject, or edit a proposal
//
// EVENTS: Broadcasts context-strategy events on accept/reject for instant UI updates

import { NextRequest, NextResponse } from 'next/server';
import {
  acceptProposal,
  rejectProposal,
  editAndAcceptProposal,
  acceptAllProposals,
  rejectAllProposals,
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

// ============================================================================
// POST - Resolve proposal(s)
// ============================================================================

interface ResolveProposalRequest {
  batchId: string;
  proposalId?: string; // Optional - if not provided, applies to all
  action: 'accept' | 'reject' | 'edit' | 'accept_all' | 'reject_all';
  editedValue?: unknown; // Required if action is 'edit'
  userId: string; // Who is resolving
  // For local-only proposals (not saved to Airtable), client provides these:
  fieldPath?: string;
  proposedValue?: unknown;
  companyId?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ResolveProposalRequest;

    const { batchId, proposalId, action, editedValue, userId, fieldPath, proposedValue, companyId: providedCompanyId } = body;

    // Validation
    if (!batchId) {
      return NextResponse.json({ error: 'Missing batchId' }, { status: 400 });
    }

    if (!action || !['accept', 'reject', 'edit', 'accept_all', 'reject_all'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be accept, reject, edit, accept_all, or reject_all' },
        { status: 400 }
      );
    }

    if ((action === 'accept' || action === 'reject' || action === 'edit') && !proposalId) {
      return NextResponse.json(
        { error: 'proposalId required for individual actions' },
        { status: 400 }
      );
    }

    if (action === 'edit' && editedValue === undefined) {
      return NextResponse.json(
        { error: 'editedValue required for edit action' },
        { status: 400 }
      );
    }

    const resolvedBy = userId || 'system';

    // Load the batch to get company ID
    // Note: batch may be null for local-only proposals (when Airtable table doesn't exist)
    const batch = await loadProposalBatch(batchId);

    // For local-only proposals, we still allow the operation to succeed
    // The client handles local state updates
    const isLocalOnly = !batch;

    if (isLocalOnly) {
      console.log(`[API] context/proposals/resolve: Batch ${batchId} is local-only (not in Airtable)`);

      // If client provided proposal details, apply the value to context graph
      if (action === 'accept' && providedCompanyId && fieldPath && proposedValue !== undefined) {
        console.log(`[API] context/proposals/resolve: Applying local-only proposal to context graph`);
        console.log(`[API] context/proposals/resolve: fieldPath=${fieldPath}, value=${JSON.stringify(proposedValue).slice(0, 100)}`);

        const appliedToContext = await applyProposalValueToContext(
          providedCompanyId,
          fieldPath,
          proposedValue,
          'user'
        );

        console.log(`[API] context/proposals/resolve: Applied to context graph: ${appliedToContext}`);

        return NextResponse.json({
          success: true,
          action,
          batchId,
          proposalId,
          appliedToContext,
          isLocalOnly: true,
        });
      }

      // No proposal details provided - return success but value not applied
      console.warn(`[API] context/proposals/resolve: Local-only proposal missing details for context application`);
      return NextResponse.json({
        success: true,
        action,
        batchId,
        proposalId,
        appliedToContext: false,
        isLocalOnly: true,
      });
    }

    let success = false;
    let appliedToContext = false;

    switch (action) {
      case 'accept': {
        success = await acceptProposal(batchId, proposalId!, resolvedBy);
        if (success) {
          // Apply accepted proposal to context graph
          appliedToContext = await applyAcceptedProposal(
            batch.companyId,
            proposalId!,
            batch
          );

          // Broadcast events for instant UI updates
          const proposal = batch.proposals.find(p => p.id === proposalId);
          if (proposal) {
            broadcastProposalAccepted(
              batch.companyId,
              batchId,
              proposalId!,
              proposal.fieldPath,
              proposal.proposedValue
            );
            // Invalidate strategy section if this field belongs to one
            const field = getRegistryEntry(proposal.fieldPath);
            if (field?.strategySection) {
              invalidateStrategySection(batch.companyId, field.strategySection, 'proposal_accepted');
            }
          }
        }
        break;
      }

      case 'reject': {
        success = await rejectProposal(batchId, proposalId!, resolvedBy);
        if (success) {
          // Broadcast reject event
          const proposal = batch.proposals.find(p => p.id === proposalId);
          if (proposal) {
            broadcastProposalRejected(
              batch.companyId,
              batchId,
              proposalId!,
              proposal.fieldPath
            );
            // Invalidate strategy section if this field belongs to one
            const field = getRegistryEntry(proposal.fieldPath);
            if (field?.strategySection) {
              invalidateStrategySection(batch.companyId, field.strategySection, 'proposal_rejected');
            }
          }
        }
        break;
      }

      case 'edit': {
        success = await editAndAcceptProposal(batchId, proposalId!, editedValue, resolvedBy);
        if (success) {
          // Apply edited proposal to context graph
          appliedToContext = await applyEditedProposal(
            batch.companyId,
            proposalId!,
            editedValue,
            batch
          );

          // Broadcast events for instant UI updates
          const proposal = batch.proposals.find(p => p.id === proposalId);
          if (proposal) {
            broadcastProposalAccepted(
              batch.companyId,
              batchId,
              proposalId!,
              proposal.fieldPath,
              editedValue // Use edited value
            );
            const field = getRegistryEntry(proposal.fieldPath);
            if (field?.strategySection) {
              invalidateStrategySection(batch.companyId, field.strategySection, 'proposal_accepted');
            }
          }
        }
        break;
      }

      case 'accept_all': {
        success = await acceptAllProposals(batchId, resolvedBy);
        if (success) {
          // Apply all proposals to context graph
          appliedToContext = await applyAllProposals(batch.companyId, batch);

          // Broadcast events for each proposal
          const sectionsToInvalidate = new Set<string>();
          for (const proposal of batch.proposals) {
            if (proposal.status === 'pending') {
              broadcastProposalAccepted(
                batch.companyId,
                batchId,
                proposal.id,
                proposal.fieldPath,
                proposal.proposedValue
              );
              const field = getRegistryEntry(proposal.fieldPath);
              if (field?.strategySection) {
                sectionsToInvalidate.add(field.strategySection);
              }
            }
          }
          // Invalidate affected sections
          for (const section of sectionsToInvalidate) {
            invalidateStrategySection(batch.companyId, section as 'businessReality' | 'constraints' | 'competition' | 'executionCapabilities', 'proposal_accepted');
          }
        }
        break;
      }

      case 'reject_all': {
        success = await rejectAllProposals(batchId, resolvedBy);
        if (success) {
          // Broadcast reject events for each proposal
          const sectionsToInvalidate = new Set<string>();
          for (const proposal of batch.proposals) {
            if (proposal.status === 'pending') {
              broadcastProposalRejected(
                batch.companyId,
                batchId,
                proposal.id,
                proposal.fieldPath
              );
              const field = getRegistryEntry(proposal.fieldPath);
              if (field?.strategySection) {
                sectionsToInvalidate.add(field.strategySection);
              }
            }
          }
          // Invalidate affected sections
          for (const section of sectionsToInvalidate) {
            invalidateStrategySection(batch.companyId, section as 'businessReality' | 'constraints' | 'competition' | 'executionCapabilities', 'proposal_rejected');
          }
        }
        break;
      }
    }

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to resolve proposal' },
        { status: 500 }
      );
    }

    console.log(
      `[API] context/proposals/resolve: ${action} on batch ${batchId}${proposalId ? ` proposal ${proposalId}` : ''}`
    );

    return NextResponse.json({
      success: true,
      action,
      batchId,
      proposalId,
      appliedToContext,
    });
  } catch (error) {
    console.error('[API] context/proposals/resolve error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to resolve proposal' },
      { status: 500 }
    );
  }
}

// ============================================================================
// Helpers - Apply proposals to context graph
// ============================================================================

async function applyAcceptedProposal(
  companyId: string,
  proposalId: string,
  batch: Awaited<ReturnType<typeof loadProposalBatch>>
): Promise<boolean> {
  if (!batch) return false;

  const proposal = batch.proposals.find((p) => p.id === proposalId);
  if (!proposal) return false;

  return applyProposalValueToContext(
    companyId,
    proposal.fieldPath,
    proposal.proposedValue,
    'user' // Accepted by user = confirmed
  );
}

async function applyEditedProposal(
  companyId: string,
  proposalId: string,
  editedValue: unknown,
  batch: Awaited<ReturnType<typeof loadProposalBatch>>
): Promise<boolean> {
  if (!batch) return false;

  const proposal = batch.proposals.find((p) => p.id === proposalId);
  if (!proposal) return false;

  return applyProposalValueToContext(
    companyId,
    proposal.fieldPath,
    editedValue,
    'user' // Edited by user = confirmed
  );
}

async function applyAllProposals(
  companyId: string,
  batch: Awaited<ReturnType<typeof loadProposalBatch>>
): Promise<boolean> {
  if (!batch) return false;

  for (const proposal of batch.proposals) {
    if (proposal.status === 'pending') {
      await applyProposalValueToContext(
        companyId,
        proposal.fieldPath,
        proposal.proposedValue,
        'user'
      );
    }
  }

  return true;
}

async function applyProposalValueToContext(
  companyId: string,
  fieldPath: string,
  value: unknown,
  source: string
): Promise<boolean> {
  try {
    const graph = await loadContextGraph(companyId);
    if (!graph) {
      console.warn(`[applyProposalValueToContext] No graph found for ${companyId}`);
      return false;
    }

    // Apply the value using the dedicated function
    const updatedGraph = await applyProposalToContextGraph(graph, fieldPath, value, source);

    // Save the updated graph
    await saveContextGraph(updatedGraph, source);

    console.log(`[applyProposalValueToContext] Applied ${fieldPath} = ${JSON.stringify(value).slice(0, 50)}...`);
    return true;
  } catch (error) {
    console.error(`[applyProposalValueToContext] Failed to apply ${fieldPath}:`, error);
    return false;
  }
}
